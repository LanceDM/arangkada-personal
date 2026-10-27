// The learned routing policy, the Optimized group's: a Q-learning policy over
// the routing FSM's moves. Its state, its four actions, and the table it is
// read from.
//
// The routing FSM decides what is legal (`legalTransitions`); this policy only
// chooses. Each of its four actions names one kind of move - nothing added,
// practice on BKT's weakest competency, practice on that competency's first
// curriculum relative that can be practised, or a review of it - and is masked
// wherever the machine lists no such move. A masked action is never taken, and
// a trainer never reads or updates its value there.
//
// The tables are trained in simulation, outside the game. The game reads one
// designated table, through admin's composition.
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { CourseLevel, Outcome, RoutingMove } from '@/domain/routing/routingTypes';
import { stateId } from '@/domain/routing/routingTypes';
import { MASTERY_BUCKETS, masteryBucket, type MasteryBucket } from './qLearningPolicy';
import { relatedCompetencies } from './relatedness';
import { plainMove, practiceMove, reviewMoves, type RoutingChoice, type RoutingPolicy, type WeakestReading } from './routingPolicy';

// --- the state: 3 x 3 x 2 x 2 = 36 ---------------------------------------------

/** Where in the course the level just played sits. */
export type RoutingStage = 'early' | 'middle' | 'late';
export const ROUTING_STAGES: readonly RoutingStage[] = ['early', 'middle', 'late'];

/**
 * Levels 0-4 early, 5-8 middle, 9-11 late. The routing design names Levels 1-4 as the
 * first stage; the tutorial joins it because the only choice it ever gives is
 * the add-on to Level 1, on passing it.
 */
export const routingStage = (level: CourseLevel): RoutingStage => (level <= 4 ? 'early' : level <= 8 ? 'middle' : 'late');

/** Whether more than half of the budget is still left. */
export type BudgetLeft = 'more' | 'less';
export const BUDGET_LEFT: readonly BudgetLeft[] = ['more', 'less'];

/** `spent` and `size` are in the budget's own unit: graded decisions for the learned policy's training. */
export const budgetLeft = ({ spent, size }: { spent: number; size: number }): BudgetLeft =>
  size - spent > size / 2 ? 'more' : 'less';

const OUTCOMES: readonly Outcome[] = ['passed', 'failed'];

export type RoutingQState = `${RoutingStage}:${MasteryBucket}:${Outcome}:${BudgetLeft}`;

/** Every state, in the order a table lists them. */
export const ROUTING_Q_STATES: readonly RoutingQState[] = ROUTING_STAGES.flatMap(stage =>
  MASTERY_BUCKETS.flatMap(mastery =>
    OUTCOMES.flatMap(outcome => BUDGET_LEFT.map(left => `${stage}:${mastery}:${outcome}:${left}` as RoutingQState))
  )
);

/** What the learned policy observes of the learner at a choice: BKT's weakest competency, and how much budget has been spent. */
export interface RoutingObservation {
  readonly weakest: WeakestReading;
  readonly budget: { readonly spent: number; readonly size: number };
}

/**
 * The state the learned policy reads at a choice: the stage of the level just played, the
 * weakest competency's mastery bucket (`masteryBucket`, fixed at 40 and 70
 * whatever tau is), the verdict on that level, and the budget left. Only a
 * course level offers it a choice, so the state is read at DRIVE(L) alone.
 */
export const routingQState = ({ state, context }: RoutingChoice, { weakest, budget }: RoutingObservation): RoutingQState => {
  if (state.kind !== 'DRIVE') throw new Error(`the learned policy was asked to choose at ${stateId(state)}, which offers no choice`);
  return `${routingStage(state.level)}:${masteryBucket(weakest.score)}:${context.outcome}:${budgetLeft(budget)}`;
};

// --- the actions: 4, masked -------------------------------------------------------

export type RoutingAction = 'none' | 'weakest' | 'related' | 'review';

/** In the order ties are broken in: nothing added first. */
export const ROUTING_ACTIONS: readonly RoutingAction[] = ['none', 'weakest', 'related', 'review'];

/**
 * The listed move `action` names, or undefined where the machine lists none:
 * the action is masked there.
 *
 * - `none`: the plain move, which every cell lists;
 * - `weakest`: `+ practice(weakest)`;
 * - `related`: `+ practice(r)` for the first r in `relatedCompetencies(weakest)`
 *   that has one, confirmed edges first;
 * - `review`: a review of the weakest competency at the highest passed level
 *   that teaches it, as the threshold rule takes it.
 */
export const routingActionMove = (
  action: RoutingAction,
  legal: readonly RoutingMove[],
  weakest: DrivingCompetency
): RoutingMove | undefined => {
  switch (action) {
    case 'none':
      return plainMove(legal);
    case 'weakest':
      return practiceMove(legal, weakest);
    case 'related':
      for (const relative of relatedCompetencies(weakest)) {
        const move = practiceMove(legal, relative);
        if (move) return move;
      }
      return undefined;
    case 'review':
      return reviewMoves(legal, weakest).at(-1);
  }
};

/** The actions not masked at this cell, in `ROUTING_ACTIONS` order. `none` is always among them. */
export const legalRoutingActions = (legal: readonly RoutingMove[], weakest: DrivingCompetency): RoutingAction[] =>
  ROUTING_ACTIONS.filter(action => routingActionMove(action, legal, weakest) !== undefined);

/**
 * Whether the learned policy is asked here: at least two of its actions are legal. Everywhere
 * else it takes the plain move unasked, and a trainer credits what follows to
 * the choice before.
 */
export const isRoutingChoice = (legal: readonly RoutingMove[], weakest: DrivingCompetency): boolean =>
  legalRoutingActions(legal, weakest).length >= 2;

// --- the table ----------------------------------------------------------------------

/**
 * A trained table: per state, the actions training tried there, best first,
 * ending at `none`. One action per state cannot be read under masking, where
 * the best may be illegal at a given cell; the policy takes the first one that
 * is legal. Anything after `none` could never be reached, since `none` always
 * is. A state training never visited has an empty row.
 */
export type RoutingTable = Record<RoutingQState, readonly RoutingAction[]>;

/**
 * One state's row, from its learned values `q` and how often each action was
 * taken there, `tried`, both indexed by `ROUTING_ACTIONS`. An action never
 * tried has no estimate, only its initial value, and is left out (the rule
 * for untrained entries). Ties go to the earlier action.
 */
export const routingTableRow = (q: ArrayLike<number>, tried: ArrayLike<number>): RoutingAction[] => {
  const ranked = ROUTING_ACTIONS.map((action, index) => ({ action, index }))
    .filter(({ index }) => tried[index] > 0)
    .sort((a, b) => q[b.index] - q[a.index] || a.index - b.index)
    .map(({ action }) => action);
  const none = ranked.indexOf('none');
  return none === -1 ? ranked : ranked.slice(0, none + 1);
};

/**
 * The learned policy, read from a trained table. Where it has no choice it returns the plain
 * move; otherwise the first action of its state's row that is legal here, and
 * the plain move where the row runs out - so an untrained row is the plain
 * FSM's move.
 */
export const routingTablePolicy =
  (table: RoutingTable): RoutingPolicy<RoutingObservation> =>
  (choice, observation) => {
    const { legal } = choice;
    const weakest = observation.weakest.competency;
    if (!isRoutingChoice(legal, weakest)) return plainMove(legal);
    for (const action of table[routingQState(choice, observation)]) {
      const move = routingActionMove(action, legal, weakest);
      if (move) return move;
    }
    return plainMove(legal);
  };
