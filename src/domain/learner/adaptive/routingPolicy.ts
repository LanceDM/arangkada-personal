// The routing policies' vocabulary: what a policy is shown, what it returns,
// and the threshold rule.
//
// A routing policy chooses one of the moves the routing FSM lists as legal
// (`legalTransitions`, src/domain/routing) and nothing else. It is pure: what
// it reads about the learner arrives as its observation, and what it knows
// about content arrives through the legal moves, which the machine derived
// from the content its caller measured. Which competency to aim at is a
// learner question, so the policies live here, beside the practice policy's
// table, and the machine itself never reads the learner.
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { RoutingContext, RoutingMove, RoutingState, RoutingTransition } from '@/domain/routing/routingTypes';
import { stateId, transitionId } from '@/domain/routing/routingTypes';
import { relatedCompetencies } from './relatedness';

/** What a policy is shown at one decision point. */
export interface RoutingChoice {
  readonly state: RoutingState;
  readonly context: RoutingContext;
  /** `legalTransitions(state, context)`. The policy returns one of these. */
  readonly legal: readonly RoutingMove[];
}

/** A routing policy: shown the legal moves and what it observes of the learner, it returns exactly one of the moves. */
export type RoutingPolicy<O> = (choice: RoutingChoice, observation: O) => RoutingMove;

/** What a transition adds to the plain move the pass guard already decided. */
export type AddOn = 'none' | 'practice' | 'review';

export const addOnOf = (transition: RoutingTransition): AddOn =>
  transition.kind === 'review' ? 'review' : aimOf(transition) === null ? 'none' : 'practice';

/** The competency a transition practises or reviews, or null for a move that adds nothing. */
export const aimOf = (transition: RoutingTransition): DrivingCompetency | null => {
  switch (transition.kind) {
    case 'retry':
    case 'advance':
      return transition.practice;
    case 'review':
      return transition.competency;
    case 'to_final':
    case 'return':
    case 'certify':
      return null;
  }
};

/** Whether `move` is one of `legal`: the same label, leading to the same state. */
export const isListed = (legal: readonly RoutingMove[], move: RoutingMove): boolean =>
  legal.some(
    candidate =>
      transitionId(candidate.transition) === transitionId(move.transition) && stateId(candidate.to) === stateId(move.to)
  );

/**
 * The move that adds nothing: the one the pass guard decided. Every state but
 * CERTIFIED lists exactly one, whatever the verdict and the content, so a
 * policy can always fall back to it.
 */
export const plainMove = (legal: readonly RoutingMove[]): RoutingMove => {
  const plain = legal.filter(move => addOnOf(move.transition) === 'none');
  if (plain.length !== 1) throw new Error(`a routing cell listed ${plain.length} plain moves, not one`);
  return plain[0];
};

/** The listed move that adds practice on `competency`, if there is one. */
export const practiceMove = (legal: readonly RoutingMove[], competency: DrivingCompetency): RoutingMove | undefined =>
  legal.find(move => addOnOf(move.transition) === 'practice' && aimOf(move.transition) === competency);

/** The listed reviews, of `competency` if one is named, in the order listed: review level ascending. */
export const reviewMoves = (legal: readonly RoutingMove[], competency?: DrivingCompetency): RoutingMove[] =>
  legal.filter(
    move => move.transition.kind === 'review' && (competency === undefined || move.transition.competency === competency)
  );

/** The competencies the listed moves of one kind aim at, once each, in the order listed. */
export const aimsOf = (legal: readonly RoutingMove[], addOn: Exclude<AddOn, 'none'>): DrivingCompetency[] => [
  ...new Set(legal.filter(move => addOnOf(move.transition) === addOn).map(move => aimOf(move.transition)!)),
];

/** The plain FSM, the Conventional group's: the pass guard's move and nothing added, every time. */
export const plainPolicy: RoutingPolicy<unknown> = ({ legal }) => plainMove(legal);

/** What an observer says about the learner's weakest competency. Null where it has nothing to say yet. */
export interface WeakestReading {
  readonly competency: DrivingCompetency;
  /** On the 0-100 scale the threshold is on. */
  readonly score: number;
}

/**
 * The routing design's threshold rule. While the weakest competency reads below
 * `threshold`: practise it if that is legal, else its first curriculum
 * relative that can legally be practised (`relatedCompetencies`, confirmed
 * edges first), else review it; otherwise, and whenever the reading is null
 * or at the threshold, the plain move. Of several legal reviews it takes the
 * highest level: the most recent one passed that teaches the competency.
 *
 * It can read BKT or, in simulation, the true skill. Only the
 * weakest competency is ever reviewed, never a relative.
 */
export const thresholdRule =
  (threshold: number): RoutingPolicy<WeakestReading | null> =>
  ({ legal }, weakest) => {
    if (!weakest || weakest.score >= threshold) return plainMove(legal);
    for (const competency of [weakest.competency, ...relatedCompetencies(weakest.competency)]) {
      const practice = practiceMove(legal, competency);
      if (practice) return practice;
    }
    return reviewMoves(legal, weakest.competency).at(-1) ?? plainMove(legal);
  };
