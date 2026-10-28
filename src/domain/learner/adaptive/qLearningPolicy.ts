// LEGACY BUILD ONLY (2026-10-28). The study's game - the New switch - plays the
// per-competency course (`@/domain/competencyRouting`), whose table is learned
// online from participants. This practice policy and its table
// (policyTable.json, trained offline in simulation) are read only by the
// Legacy build (VITE_ROUTING_SWITCH=legacy) and by the dev tools; no study
// result, parameter or starting table comes from them.
//
// The Q-learning policy that decides, once per level entry, what a learner
// should practise next, how much of the answer the level's scenarios show, and
// how much room the FSM gives them to react. State and action are both small
// and discrete on purpose - 18 states x 27 actions is a table that can be
// printed in full, unlike the retired per-competency / per-difficulty-tier
// designs this replaces.
//
// State (18): the weakest competency's BKT mastery bucket, how the learner's
// last few attempts at it went, and how promptly they have been responding.
// Action (27): which competency to target (the weakest one, a
// curriculum-related one, or an already-mastered one for spaced review), the
// support level h the level's scenarios are presented at - what the machine
// shows - and which way to shift the approach window - when it moves, which
// reaches the FSM as theta.
//
// The table itself (policyTable.json) is trained once, offline, by a
// training script outside the game and committed - this module only loads and
// looks it up. Driving Sim's `domain/adaptive/practiceSelection.ts` is what
// turns a chosen action into an actual scenario, a support level and an FSM
// theta.
import policyTable from './policyTable.json';
// Only the support vocabulary comes from the rest of the learner domain: this
// is the pure Q-table layer - buckets in, action out. `resolveTarget`, which
// needs the competency taxonomy and the learner profile, lives beside it in
// `resolveTarget.ts` so this module stays a table lookup.
import type { SupportLevel } from '../competency';

export type MasteryBucket = 'critical' | 'weak' | 'ok';
export type PerformanceBucket = 'struggling' | 'mixed' | 'improving';

/**
 * How quickly the learner has been responding, relative to a standard approach.
 *
 * Added because the baseline-vs-adaptive experiment showed the policy could not
 * use theta: mastery and recent correctness cannot tell a learner who does not
 * know the rule (where more reaction time does not help) from one who knows it
 * but responds slowly (where it does). Without that distinction the best theta
 * is the same in almost every state, and the measured result was a policy
 * statistically indistinguishable from pinning theta at a constant.
 *
 * A learner with no evidence yet reads as `steady`, the neutral default, just
 * as `performanceBucket` reads no attempts as `mixed`. There was once a third
 * bucket, `unknown`, for exactly that learner; its rows were barely trained -
 * reached only on a learner's first entry - and most handed the narrowest
 * window to someone who had not yet responded to anything. It went
 * with an earlier retrain.
 *
 * Two buckets rather than three, and the reason is worth recording. A `fast`
 * bucket was tried and removed while the window still truncated the
 * measurement: no learner could record a time shorter than the narrowest window
 * allowed, and the bucket was unreachable by construction. Widening its threshold to make it
 * reachable was measurably worse - a narrow window makes every learner look
 * prompt, which justifies keeping it narrow, and the policy locked itself into
 * the narrowest setting (it lost to a pinned theta by d = 0.46). Two live
 * buckets that mean something beat three where one is a censoring artefact.
 */
export type LatencyBucket = 'steady' | 'slow';

export type QState = `${MasteryBucket}:${PerformanceBucket}:${LatencyBucket}`;

export type PracticeTarget = 'weakest' | 'related' | 'review';

/**
 * How much room the learner gets to react, as a shift from the machine's
 * baseline timing. This is the half of the action that reaches the FSM itself:
 * Driving Sim maps it onto `TransitionParams.approachScale`, the multiplier
 * inside the guard on DRIVING -> APPROACHING_EVENT, so the policy is choosing
 * *when the machine changes state* rather than only what content it is handed.
 */
export type WindowDelta = -1 | 0 | 1;

/**
 * The approachScale each window delta maps to. Kept inside
 * TRANSITION_PARAM_BOUNDS so the FSM's clamp never has to intervene, and
 * deliberately asymmetric: narrowing all the way to the bound would leave some
 * events with almost no announcement, while widening past 1.5 mostly runs into
 * the spacing between consecutive events, where Driving Sim holds the lead at
 * the room there is anyway. What an event actually gets can therefore differ
 * from what was requested.
 */
export const WINDOW_SCALE: Record<WindowDelta, number> = { [-1]: 0.75, 0: 1, 1: 1.5 };

export interface QAction {
  target: PracticeTarget;
  /**
   * What the level's scenarios show while they are presented: the move, where
   * to look, or the situation alone. The output half of the machine, where
   * `window` is the transition half.
   */
  support: SupportLevel;
  /** Chosen FSM transition-guard timing. See WindowDelta. */
  window: WindowDelta;
}

export const MASTERY_BUCKETS: MasteryBucket[] = ['critical', 'weak', 'ok'];
export const PERFORMANCE_BUCKETS: PerformanceBucket[] = ['struggling', 'mixed', 'improving'];
export const LATENCY_BUCKETS: LatencyBucket[] = ['steady', 'slow'];

/**
 * Reference time for one standard approach, in milliseconds: the baseline
 * warning distance covered at a nominal cruising speed. Observed reaction times
 * are read as a fraction of this, so the buckets describe the learner rather
 * than the length of road the level happens to give them.
 */
export const NOMINAL_APPROACH_MS = 1750;

/**
 * Split point, as a fraction of a standard approach: above this the learner is
 * using more of the window than a standard approach provides.
 *
 * The window no longer truncates the observation. A response is timed only
 * when it came; a window that closed on a scenario asking for one is recorded
 * as censored and counts as slow (`recentLatencies`), so a learner
 * given a narrow window can still be seen to be slow.
 */
const SLOW_ABOVE = 0.8;
export const TARGETS: PracticeTarget[] = ['weakest', 'related', 'review'];
export const SUPPORT_LEVELS: SupportLevel[] = ['full', 'cue', 'none'];
export const WINDOWS: WindowDelta[] = [-1, 0, 1];

/**
 * The buckets are fixed at 40 and 70, whatever the mastery threshold tau is.
 * `selectPractice` (Driving Sim's practiceSelection.ts)
 * computes a state only below tau, so tau decides which rows the game can
 * reach. At tau 85, as the tau sweep set it, that is all three: `critical`,
 * `weak`, and `ok` between 70 and 84. Every row of the table is now live -
 * which was not so at tau 50, where the `ok:*` rows were inert by
 * construction.
 */
export const masteryBucket = (score: number): MasteryBucket =>
  score < 40 ? 'critical' : score < 70 ? 'weak' : 'ok';

/** From the learner's most recent graded attempts at the target competency, oldest first. */
export const performanceBucket = (recentCorrect: boolean[]): PerformanceBucket => {
  if (recentCorrect.length === 0) return 'mixed';
  const ratio = recentCorrect.filter(Boolean).length / recentCorrect.length;
  if (ratio <= 1 / 3) return 'struggling';
  if (ratio >= 2 / 3) return 'improving';
  return 'mixed';
};

/**
 * The learner's typical promptness over their recent timed decisions.
 *
 * Uses the median rather than the mean: a single event where the player looked
 * away should not reclassify them as slow, and reaction times are strongly
 * right-skewed.
 *
 * `recentMs` is `recentLatencies`' evidence: a censored observation arrives as
 * `Infinity` and sorts as slower than anything timed. With no evidence at all
 * the learner reads as `steady`.
 *
 * Known limitation: the time is measured from the start of the reaction clock
 * - the release of the read phase, or the approach where there was none - and
 * theta moves where that is. For a response whose moment the road decides,
 * such as stopping at the line, a wide theta records a longer time for the same
 * promptness. The effect is bounded by theta's own range and is small next to
 * the spread between fast and slow learners, but it is a confound, not noise.
 */
export const latencyBucket = (recentMs: readonly number[]): LatencyBucket => {
  const usable = recentMs.filter(ms => ms > 0);
  if (usable.length === 0) return 'steady';

  const sorted = [...usable].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return median / NOMINAL_APPROACH_MS > SLOW_ABOVE ? 'slow' : 'steady';
};

export const actionKey = (action: QAction): string => `${action.target}:${action.support}:${action.window}`;

export const parseActionKey = (key: string): QAction => {
  const [target, support, window] = key.split(':');
  return {
    target: target as PracticeTarget,
    support: support as SupportLevel,
    window: Number(window) as WindowDelta,
  };
};


/** Untrained/missing-state fallback: the weakest competency, on the baseline machine. */
export const DEFAULT_ACTION: QAction = { target: 'weakest', support: 'full', window: 0 };

/**
 * What a trained table records for a state whose greedy action training never
 * took there.
 *
 * - `first-action`: the plain argmax, whose ties go to the first action. A row
 *   never visited is all zeros and records `actions[0]`, `weakest:full:-1`
 *   (theta 0.75); a visited row whose tried actions all went negative records
 *   the first action it never tried. Every table the earlier studies trained
 *   was written this way, and keeps it.
 * - `documented-default`: the best action training actually took in that
 *   state, and `DEFAULT_ACTION` where it took none. An untried action's value
 *   is its initialisation, not an estimate.
 */
export type UntrainedRow = 'first-action' | 'documented-default';

/**
 * The table entry for one state, from its learned values `q` and how often each
 * action was taken there, `tried`, both indexed by `actions`. Ties go to the
 * earlier action under either rule.
 */
export const tableEntry = (
  q: ArrayLike<number>,
  tried: ArrayLike<number>,
  actions: readonly QAction[],
  rule: UntrainedRow
): string => {
  let best = rule === 'first-action' ? 0 : -1;
  for (let i = 0; i < actions.length; i++) {
    if (rule === 'documented-default' && tried[i] === 0) continue;
    if (best === -1 || q[i] > q[best]) best = i;
  }
  return actionKey(best === -1 ? DEFAULT_ACTION : actions[best]);
};

/**
 * Which table a decision was read from: FNV-1a over the committed table's
 * JSON, as eight hex digits. Recorded with every level entry, so a decision in
 * storage can be looked up again in the table that made it - and a decision
 * made before a retrain is never read as the new table's.
 */
export const POLICY_TABLE_ID: string = (() => {
  const text = JSON.stringify(policyTable);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
})();

/** One lookup, with what is needed to repeat it: the table's own entry. */
export interface PolicyLookup {
  action: QAction;
  /** The entry exactly as the table stores it, or null for a state the table does not carry. */
  tableKey: string | null;
}

/** The trained policy's choice for `state`, and the entry it was read from. */
export const lookupPolicy = (state: QState): PolicyLookup => {
  const key = (policyTable as Record<string, string>)[state];
  return key ? { action: parseActionKey(key), tableKey: key } : { action: DEFAULT_ACTION, tableKey: null };
};

/** The trained policy's choice for `state`. */
export const chooseAction = (state: QState): QAction => lookupPolicy(state).action;
