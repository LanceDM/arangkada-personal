// The routing FSM's transition relation: a declarative table, and the two pure
// functions every caller goes through.
//
// The table is the routing design's, row for row. Each row names the states it leaves,
// the verdict it fires on, the labels it could offer from a state, the guard
// that decides which of them are legal under a context, and the state each
// leads to. The target is computed from the state and the label alone, so the
// same transition from the same state always lands in the same place, whatever
// the context said - determinism is a property of the table's shape, not of
// the rows agreeing.
import type {
  CourseLevel,
  DriveState,
  FrontierState,
  LevelId,
  Outcome,
  RoutingContext,
  RoutingMove,
  RoutingState,
  RoutingTransition,
} from './routingTypes';
import {
  CERTIFIED_STATE,
  FINAL_EXAM_LEVEL,
  FINAL_STATE,
  LAST_COURSE_LEVEL,
  ROUTING_ALPHABET,
  TUTORIAL_LEVEL,
  driveState,
  frontierLevel,
  reviewState,
  transitionId,
} from './routingTypes';

type StateKind = RoutingState['kind'];
type MoveKind = RoutingTransition['kind'];
type StateOf<K extends StateKind> = Extract<RoutingState, { kind: K }>;
type TransitionOf<M extends MoveKind> = Extract<RoutingTransition, { kind: M }>;

/** One row of the table, as the characterization reads it. */
export interface RoutingRule {
  readonly row: string;
  readonly from: StateKind;
  readonly on: Outcome | 'either';
  readonly move: MoveKind;
  /** Which states of `from` the row leaves, in words. */
  readonly where: string;
  /** The guard, in words. */
  readonly guard: string;
  /** The legal moves this row offers from `state` under `context`, in alphabet order. */
  offers(state: RoutingState, context: RoutingContext): RoutingMove[];
}

interface RuleSpec<K extends StateKind, M extends MoveKind> {
  row: string;
  from: K;
  on: Outcome | 'either';
  move: M;
  where: string;
  guard: string;
  applies: (state: StateOf<K>) => boolean;
  /** Every label the row could offer from `state`, whatever the context. */
  candidates: (state: StateOf<K>) => readonly TransitionOf<M>[];
  allowed: (state: StateOf<K>, transition: TransitionOf<M>, context: RoutingContext) => boolean;
  to: (state: StateOf<K>, transition: TransitionOf<M>) => RoutingState;
}

const rule = <K extends StateKind, M extends MoveKind>(spec: RuleSpec<K, M>): RoutingRule => {
  const leaves = (state: RoutingState): state is StateOf<K> => state.kind === spec.from;
  return {
    row: spec.row,
    from: spec.from,
    on: spec.on,
    move: spec.move,
    where: spec.where,
    guard: spec.guard,
    offers: (state, context) => {
      if (!leaves(state) || (spec.on !== 'either' && spec.on !== context.outcome) || !spec.applies(state)) return [];
      return spec
        .candidates(state)
        .filter(transition => spec.allowed(state, transition, context))
        .map(transition => ({ transition, to: spec.to(state, transition) }));
    },
  };
};

/** The labels of one kind, in alphabet order. Every row draws its candidates from here. */
const ofKind = <M extends MoveKind>(move: M): readonly TransitionOf<M>[] =>
  ROUTING_ALPHABET.filter((transition): transition is TransitionOf<M> => transition.kind === move);

const RETRIES = ofKind('retry');
const ADVANCES = ofKind('advance');
const REVIEWS = ofKind('review');

/** Where passing course level L sends a learner: L + 1, or the final exam after Level 11. */
const frontierAfter = (state: DriveState): FrontierState =>
  state.level === LAST_COURSE_LEVEL ? FINAL_STATE : driveState((state.level + 1) as CourseLevel);

/** The transition table. Rows are tried in this order, which is the order legal moves are listed in. */
export const ROUTING_TABLE: readonly RoutingRule[] = [
  rule({
    row: 'retry',
    from: 'DRIVE',
    on: 'failed',
    move: 'retry',
    where: 'every course level',
    guard: 'always; + practice(c) only if L is not the tutorial and c is placeable at L',
    applies: () => true,
    candidates: () => RETRIES,
    allowed: (state, { practice }, context) =>
      practice === null || (state.level !== TUTORIAL_LEVEL && context.practice[practice] === 'placeable'),
    to: state => state,
  }),
  rule({
    row: 'advance',
    from: 'DRIVE',
    on: 'passed',
    move: 'advance',
    where: 'L < 11',
    guard: 'always; + practice(c) only if c is placeable at L + 1',
    applies: state => state.level !== LAST_COURSE_LEVEL,
    candidates: () => ADVANCES,
    allowed: (_state, { practice }, context) => practice === null || context.practice[practice] === 'placeable',
    to: state => frontierAfter(state),
  }),
  rule({
    row: 'to final',
    from: 'DRIVE',
    on: 'passed',
    move: 'to_final',
    where: 'L = 11',
    guard: 'always; nothing is added to the final exam',
    applies: state => state.level === LAST_COURSE_LEVEL,
    candidates: () => [{ kind: 'to_final' }],
    allowed: () => true,
    to: () => FINAL_STATE,
  }),
  rule({
    row: 'review',
    from: 'DRIVE',
    on: 'passed',
    move: 'review',
    where: 'L >= 1',
    guard:
      "1 <= L' <= L (passed, never the tutorial), c has no portable practice item at the next level, and L' teaches c",
    applies: state => state.level !== TUTORIAL_LEVEL,
    candidates: state => REVIEWS.filter(transition => transition.level <= state.level),
    allowed: (_state, { level, competency }, context) =>
      context.practice[competency] === 'none' && context.teaches[level].includes(competency),
    to: (state, { level }) => reviewState(level, frontierAfter(state)),
  }),
  rule({
    row: 'return',
    from: 'REVIEW',
    on: 'either',
    move: 'return',
    where: 'every review',
    guard: 'always, whatever the review scored; nothing is added',
    applies: () => true,
    candidates: () => [{ kind: 'return' }],
    allowed: () => true,
    to: state => state.frontier,
  }),
  rule({
    row: 'retry the final',
    from: 'FINAL',
    on: 'failed',
    move: 'retry',
    where: 'the final exam',
    guard: 'always; never practice',
    applies: () => true,
    candidates: () => RETRIES.filter(transition => transition.practice === null),
    allowed: () => true,
    to: () => FINAL_STATE,
  }),
  rule({
    row: 'certify',
    from: 'FINAL',
    on: 'passed',
    move: 'certify',
    where: 'the final exam',
    guard: 'always',
    applies: () => true,
    candidates: () => [{ kind: 'certify' }],
    allowed: () => true,
    to: () => CERTIFIED_STATE,
  }),
];

/**
 * Every transition legal from `state` under `context`, with where each leads,
 * in canonical order: table row, then alphabet order (competencies in
 * `COMPETENCIES` order, review levels ascending).
 *
 * Never empty except at CERTIFIED: every other state has a plain move for
 * either verdict. A policy chooses among these and nothing else.
 */
export const legalTransitions = (state: RoutingState, context: RoutingContext): readonly RoutingMove[] =>
  ROUTING_TABLE.flatMap(row => row.offers(state, context));

/** The state `transition` leads to, or null where it is not legal from `state` under `context`. */
export const step = (
  state: RoutingState,
  context: RoutingContext,
  transition: RoutingTransition
): RoutingState | null => {
  const id = transitionId(transition);
  return legalTransitions(state, context).find(move => transitionId(move.transition) === id)?.to ?? null;
};

/**
 * The level the pass guard sends a learner to from `state` on `outcome`, and
 * so the level `ContentAvailability.practice` must be measured at: the one
 * whose route the caller rolls before asking for the legal transitions. Null
 * where the course is over.
 */
export const destinationOf = (state: RoutingState, outcome: Outcome): LevelId | null => {
  switch (state.kind) {
    case 'DRIVE':
      return outcome === 'failed' ? state.level : frontierLevel(frontierAfter(state));
    case 'REVIEW':
      return frontierLevel(state.frontier);
    case 'FINAL':
      return outcome === 'failed' ? FINAL_EXAM_LEVEL : null;
    case 'CERTIFIED':
      return null;
  }
};
