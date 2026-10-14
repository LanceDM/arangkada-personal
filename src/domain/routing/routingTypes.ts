// The routing FSM's vocabulary: the course it routes through, its states, its
// transitions, the context it is handed and the log it keeps.
//
// "Routing" is the thesis's term (ρ): which level a learner plays
// next and what is added to it. It has nothing to do with URL routing, which
// lives in `app/router`.
//
// This module sits in the shared domain, which lint forbids from importing any
// feature. Everything the machine knows about content therefore arrives as
// `ContentAvailability`, measured by whoever drives it.
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';

// --- the course --------------------------------------------------------------

/**
 * The levels before the final exam, in the order a learner meets them. Written
 * here rather than read from Driving Sim's catalogue, which this module may not
 * import; `routingCourse.test.ts` in Driving Sim holds the two equal.
 */
export const COURSE_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** The tutorial: taught and graded on the controls, never on a competency. */
export const TUTORIAL_LEVEL = 0 satisfies CourseLevel;
/** The last level before the final exam. */
export const LAST_COURSE_LEVEL = 11 satisfies CourseLevel;
/** The final exam: the same test for every learner, so nothing is ever added to it. */
export const FINAL_EXAM_LEVEL = 12;

export type LevelId = CourseLevel | typeof FINAL_EXAM_LEVEL;

/**
 * The levels a review may replay: every course level but the tutorial, whose
 * steps teach the controls and so present no competency to practise (the same
 * reason `remediationPool.ts` never draws from it).
 */
export const REVIEW_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const satisfies readonly CourseLevel[];
export type ReviewLevel = (typeof REVIEW_LEVELS)[number];

// --- states --------------------------------------------------------------------

/** Playing course level `level` as the frontier: the furthest level reached. */
export interface DriveState {
  readonly kind: 'DRIVE';
  readonly level: CourseLevel;
}

/** Sitting the final exam. */
export interface FinalState {
  readonly kind: 'FINAL';
}

/** Where a learner stands in the course when not on a detour. */
export type FrontierState = DriveState | FinalState;

/**
 * Replaying passed level `level` once, before going back to `frontier`.
 *
 * The routing design names this state REVIEW(L′). It carries its return point because
 * `return` has to know where to go and nothing else in the machine does; so
 * each (L′, frontier) pair is its own state, 66 of them.
 */
export interface ReviewState {
  readonly kind: 'REVIEW';
  readonly level: ReviewLevel;
  readonly frontier: FrontierState;
}

/** The final exam passed. Terminal: no transition leaves it. */
export interface CertifiedState {
  readonly kind: 'CERTIFIED';
}

export type RoutingState = DriveState | ReviewState | FinalState | CertifiedState;

export const driveState = (level: CourseLevel): DriveState => ({ kind: 'DRIVE', level });
export const reviewState = (level: ReviewLevel, frontier: FrontierState): ReviewState => ({ kind: 'REVIEW', level, frontier });
export const FINAL_STATE: FinalState = { kind: 'FINAL' };
export const CERTIFIED_STATE: CertifiedState = { kind: 'CERTIFIED' };

/** A course starts at the tutorial. A machine may also be started at any frontier, for a learner already part-way. */
export const INITIAL_ROUTING_STATE: FrontierState = driveState(TUTORIAL_LEVEL);

/** The only state with no way out. */
export const TERMINAL_STATES: readonly RoutingState['kind'][] = ['CERTIFIED'];

/** The level a frontier is played on. */
export const frontierLevel = (frontier: FrontierState): LevelId =>
  frontier.kind === 'DRIVE' ? frontier.level : FINAL_EXAM_LEVEL;

/**
 * Every state the machine has, in a fixed order: DRIVE(0-11), then each review
 * grouped by the frontier it returns to, then FINAL and CERTIFIED. A review
 * returns to the level after the one just passed, so its level is always below
 * its frontier's, and the tutorial and Level 1 are never a frontier to return
 * to: 12 + 66 + 1 + 1 = 80.
 */
export const ROUTING_STATES: readonly RoutingState[] = [
  ...COURSE_LEVELS.map(driveState),
  ...[...COURSE_LEVELS.filter(level => level >= 2).map(driveState), FINAL_STATE].flatMap(frontier =>
    REVIEW_LEVELS.filter(level => level < frontierLevel(frontier)).map(level => reviewState(level, frontier))
  ),
  FINAL_STATE,
  CERTIFIED_STATE,
];

// --- transitions ---------------------------------------------------------------

/**
 * One labelled transition. `retry` and `advance` carry the practice add-on,
 * `+ practice(c)`, as `practice`: null is the plain move.
 */
export type RoutingTransition =
  | { readonly kind: 'retry'; readonly practice: DrivingCompetency | null }
  | { readonly kind: 'advance'; readonly practice: DrivingCompetency | null }
  | { readonly kind: 'to_final' }
  | { readonly kind: 'review'; readonly level: ReviewLevel; readonly competency: DrivingCompetency }
  | { readonly kind: 'return' }
  | { readonly kind: 'certify' };

const withPractice = (kind: 'retry' | 'advance'): RoutingTransition[] => [
  { kind, practice: null },
  ...COMPETENCIES.map((practice): RoutingTransition => ({ kind, practice })),
];

/**
 * Every transition label the machine can ever take, in the canonical order its
 * legal moves are listed in: 12 retries, 12 advances, to_final, 121 reviews,
 * return and certify - 148.
 */
export const ROUTING_ALPHABET: readonly RoutingTransition[] = [
  ...withPractice('retry'),
  ...withPractice('advance'),
  { kind: 'to_final' },
  ...REVIEW_LEVELS.flatMap(level =>
    COMPETENCIES.map((competency): RoutingTransition => ({ kind: 'review', level, competency }))
  ),
  { kind: 'return' },
  { kind: 'certify' },
];

/** A legal transition together with the state it leads to. */
export interface RoutingMove {
  readonly transition: RoutingTransition;
  /** A function of the state and the transition alone, never of the context. */
  readonly to: RoutingState;
}

// --- context -------------------------------------------------------------------

/** The verdict on the entry just played. */
export type Outcome = 'passed' | 'failed';

/**
 * What practice content one competency has at a destination level.
 *
 * - `placeable`: a portable item exists at or before the level and at least
 *   one is not on the route it was rolled with (`remediationCandidates`).
 * - `on-route`: portable items exist, but every one is already on the route.
 * - `none`: no portable item exists at or before the level at all.
 *
 * Three values rather than two booleans so that "placeable but not portable"
 * cannot be said.
 */
export type PracticeAvailability = 'placeable' | 'on-route' | 'none';

/**
 * The content the machine is told about: measured by the caller, never looked
 * up by the machine. This is the whole of what it knows about Story's levels.
 */
export interface ContentAvailability {
  /**
   * Per competency, practice content at `destinationOf(state, outcome)` - the
   * level the pass guard sends the learner to - against the route rolled for
   * it. The roll comes first, as it does in `buildAdaptivePlan`.
   */
  readonly practice: Readonly<Record<DrivingCompetency, PracticeAvailability>>;
  /** Per review level, the competencies one play of it is certain to present. */
  readonly teaches: Readonly<Record<ReviewLevel, readonly DrivingCompetency[]>>;
}

export interface RoutingContext extends ContentAvailability {
  /**
   * The entry's verdict on its authored points alone: a practice item never
   * counts toward the pass mark (`practiceItemScoring: neutral`). A
   * review's verdict is recorded and read by nothing.
   */
  readonly outcome: Outcome;
}

// --- log -----------------------------------------------------------------------

/**
 * One entry of `RoutingFSM.getTransitionLog()`, the routing machine's analytics
 * record. There is no timestamp: the log is a pure function of what the
 * machine was told and asked, so a simulated course replays to the same log.
 */
export interface RoutingLogEntry {
  /** Position in the log, from 0. Entries are only ever appended. */
  readonly seq: number;
  readonly from: RoutingState;
  readonly to: RoutingState;
  readonly transition: RoutingTransition;
  readonly outcome: Outcome;
  /** Every transition that was legal, by `transitionId`, in canonical order: what the choice was made from. */
  readonly legal: readonly string[];
}

// --- names ---------------------------------------------------------------------

/** A state's name, for logs and the golden: `DRIVE(3)`, `REVIEW(6->DRIVE(7))`, `FINAL`, `CERTIFIED`. */
export const stateId = (state: RoutingState): string => {
  switch (state.kind) {
    case 'DRIVE':
      return `DRIVE(${state.level})`;
    case 'REVIEW':
      return `REVIEW(${state.level}->${stateId(state.frontier)})`;
    case 'FINAL':
    case 'CERTIFIED':
      return state.kind;
  }
};

/** The control state the routing design names, without a review's return point: `REVIEW(6)`. */
export const controlStateId = (state: RoutingState): string =>
  state.kind === 'REVIEW' ? `REVIEW(${state.level})` : stateId(state);

/** A transition's name: `advance`, `retry+practice(pedestrians)`, `review(6,parking)`. */
export const transitionId = (transition: RoutingTransition): string => {
  switch (transition.kind) {
    case 'retry':
    case 'advance':
      return transition.practice ? `${transition.kind}+practice(${transition.practice})` : transition.kind;
    case 'review':
      return `review(${transition.level},${transition.competency})`;
    case 'to_final':
    case 'return':
    case 'certify':
      return transition.kind;
  }
};
