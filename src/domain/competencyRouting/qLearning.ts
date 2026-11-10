/**
 * The per-competency Q-learning policy (redesign of 2026-10-27/28).
 *
 * After every drive and repeat drive, each competency the drive counted gets
 * its own decision. One 8-state table is shared by all competencies and all
 * participants, and it is learned online from real participants only: it
 * starts empty, nothing is pre-trained, and no simulated data enters it.
 *
 * - State: the competency's mastery level (4) x its scenario result in this
 *   attempt (passed / failed) = 8 states.
 * - Actions (TENTATIVE): none, practice, review.
 * - Choosing (TENTATIVE): Double Explore-then-Commit, 2 / 6 / 2, with randomized
 *   exploration visits and a probability floor p = 0.1 (Jin, Xu, Xiao & Gu,
 *   2021; randomized, logged probabilities after Qian et al., 2022, and Trella
 *   et al., 2022).
 * - Learning: Q-learning, alpha = 1/n, gamma = 0.9.
 * - Reward (TENTATIVE): r = A_next + 0.5 * Pass - 0.02 * H, from observed data only.
 *
 * Rules decide what is legal and when the learner advances; the table chooses
 * among the legal actions.
 */
import type { MasteryLevel } from './mastery';

// --- states and actions -------------------------------------------------------

export type ScenarioResult = 'passed' | 'failed';

export interface QState {
  mastery: MasteryLevel;
  result: ScenarioResult;
}

export const Q_STATES: readonly QState[] = ([1, 2, 3, 4] as const).flatMap(mastery =>
  (['passed', 'failed'] as const).map(result => ({ mastery, result }))
);

/** `M3-passed` */
export const stateKey = (state: QState): string => `M${state.mastery}-${state.result}`;

/** TENTATIVE action set. */
export type CompetencyAction = 'none' | 'practice' | 'review';
export const COMPETENCY_ACTIONS: readonly CompetencyAction[] = ['none', 'practice', 'review'];

/** Mastery level 2 (0.50) is the floor for `none`. */
export const NONE_MASTERY_FLOOR: MasteryLevel = 2;

/**
 * What the rules allow in a state (TENTATIVE):
 * - none: the competency passed, and its mastery is at least 0.50;
 * - practice: always;
 * - review: after a fail.
 */
export const legalActions = (state: QState): CompetencyAction[] =>
  COMPETENCY_ACTIONS.filter(action =>
    action === 'none'
      ? state.result === 'passed' && state.mastery >= NONE_MASTERY_FLOOR
      : action === 'review'
        ? state.result === 'failed'
        : true
  );

// --- the table ----------------------------------------------------------------

export interface QCell {
  /** The running average of its targets. */
  q: number;
  /** Updates so far: alpha = 1/n. */
  n: number;
  /** Times it was chosen, whichever phase chose it; the warm-up counts these. */
  visits: number;
}

export type QTable = Record<string, Partial<Record<CompetencyAction, QCell>>>;

export const emptyQTable = (): QTable => Object.fromEntries(Q_STATES.map(state => [stateKey(state), {}]));

const cell = (table: QTable, state: QState, action: CompetencyAction): QCell =>
  table[stateKey(state)]?.[action] ?? { q: 0, n: 0, visits: 0 };

// --- choosing: the warm-up ------------------------------------------------------

/** TENTATIVE warm-up settings; R2 (set from the dry run) may shorten them to 1 / 3 / 1. */
export interface WarmUp {
  /** Explore I: visits per legal action. */
  exploreFirst: number;
  /** Commit I: visits the leader is committed to before Explore II. */
  commitLeader: number;
  /** Explore II: further visits per non-leader action. */
  exploreSecond: number;
  /** The probability floor every non-leader keeps once committing. */
  floor: number;
}

export const DEFAULT_WARM_UP: WarmUp = { exploreFirst: 2, commitLeader: 6, exploreSecond: 2, floor: 0.1 };

export type DecisionPhase = 'only_legal' | 'explore_1' | 'commit_1' | 'explore_2' | 'final_commit';

export interface PolicyDecision {
  action: CompetencyAction;
  /** Which part of the warm-up chose it. */
  phase: DecisionPhase;
  /** The probability the chosen action had: logged for probability-weighted analysis. */
  probability: number;
  /** Every legal action's probability at this decision. */
  probabilities: Partial<Record<CompetencyAction, number>>;
  legal: CompetencyAction[];
  /** The leader the commit phases were built around; null while exploring. */
  leader: CompetencyAction | null;
  /**
   * Whether this choice explored or exploited: `exploit` when it took the
   * leader, `explore` when it took another action (or no leader exists yet),
   * `forced` when only one action was legal.
   */
  selection: DecisionSelection;
  /** The uniform random number the choice was drawn with; null when nothing was drawn. */
  draw: number | null;
  /** Every legal action's Q and visits at the moment of the decision. */
  snapshot: Partial<Record<CompetencyAction, { q: number; visits: number }>>;
}

/** Exploration or exploitation, per decision. */
export type DecisionSelection = 'explore' | 'exploit' | 'forced';

/** Exploration or exploitation, per state: the warm-up phase it is in. */
export type StateTag = 'exploring' | 'exploiting' | 'no_choice';

export const selectionOf = (phase: DecisionPhase | 'cap', action: CompetencyAction, leader: CompetencyAction | null): DecisionSelection =>
  phase === 'only_legal' || phase === 'cap' ? 'forced' : leader !== null && action === leader ? 'exploit' : 'explore';

export const tagOfPhase = (phase: DecisionPhase): StateTag =>
  phase === 'only_legal' ? 'no_choice' : phase === 'explore_1' || phase === 'explore_2' ? 'exploring' : 'exploiting';

/** What the fallback rule needs to break a tie: the state and whether this competency failed before. */
export interface FallbackContext {
  state: QState;
  /** Mastery as a probability, for the 0.80 split after a pass. */
  masteryP: number;
  /** The competency has failed an earlier attempt in this stage. */
  failedBefore: boolean;
}

/**
 * The fallback rule (TENTATIVE), used to break a tie: after a pass, practice if
 * mastery is below 0.80, otherwise none; after a fail, practice on the first
 * failure and review on a repeat failure.
 */
export const fallbackAction = ({ state, masteryP, failedBefore }: FallbackContext): CompetencyAction =>
  state.result === 'passed' ? (masteryP < 0.8 ? 'practice' : 'none') : failedBefore ? 'review' : 'practice';

/** The leader: highest Q; ties go to fewer visits, then to the fallback rule, then to list order. */
export const leaderOf = (
  table: QTable,
  state: QState,
  legal: CompetencyAction[],
  fallback: CompetencyAction
): CompetencyAction =>
  [...legal].sort((a, b) => {
    const ca = cell(table, state, a);
    const cb = cell(table, state, b);
    return cb.q - ca.q || ca.visits - cb.visits || Number(b === fallback) - Number(a === fallback);
  })[0];

const uniform = (actions: CompetencyAction[]) =>
  Object.fromEntries(actions.map(action => [action, 1 / actions.length])) as Partial<Record<CompetencyAction, number>>;

/** Draws an action; returns it with the random number used, which is logged. */
const draw = (probabilities: Partial<Record<CompetencyAction, number>>, rng: () => number): [CompetencyAction, number] => {
  const entries = Object.entries(probabilities) as [CompetencyAction, number][];
  const value = rng();
  let roll = value;
  for (const [action, p] of entries) {
    if (roll < p) return [action, value];
    roll -= p;
  }
  return [entries[entries.length - 1][0], value];
};

/**
 * Chooses an action for one competency in `state`, by the warm-up phase the
 * state has reached:
 *
 * 1. Only one legal action: taken, probability 1 (the policy is skipped).
 * 2. Explore I: an action with fewer than `exploreFirst` visits, drawn at random
 *    among those still needing visits.
 * 3. Commit I: until the leader has `commitLeader` visits, the leader with
 *    probability 1 - (k - 1)p, each other legal action with p.
 * 4. Explore II: a non-leader with fewer than exploreFirst + exploreSecond
 *    visits, drawn at random among those.
 * 5. Final commit: the same probability floor from then on (it replaces
 *    epsilon = 0.05).
 */
export const chooseAction = (
  table: QTable,
  state: QState,
  fallback: FallbackContext,
  rng: () => number,
  warmUp: WarmUp = DEFAULT_WARM_UP
): PolicyDecision => {
  const legal = legalActions(state);
  const snapshot = Object.fromEntries(
    legal.map(action => [action, { q: cell(table, state, action).q, visits: cell(table, state, action).visits }])
  ) as PolicyDecision['snapshot'];
  const decided = (
    action: CompetencyAction,
    phase: DecisionPhase,
    probabilities: Partial<Record<CompetencyAction, number>>,
    leader: CompetencyAction | null,
    value: number | null
  ): PolicyDecision => ({
    action, phase, probability: probabilities[action]!, probabilities, legal, leader,
    selection: selectionOf(phase, action, leader), draw: value, snapshot,
  });
  if (legal.length === 1) return decided(legal[0], 'only_legal', { [legal[0]]: 1 }, null, null);
  const visits = (action: CompetencyAction) => cell(table, state, action).visits;

  const needFirst = legal.filter(action => visits(action) < warmUp.exploreFirst);
  if (needFirst.length > 0) {
    const probabilities = uniform(needFirst);
    const [action, value] = draw(probabilities, rng);
    return decided(action, 'explore_1', probabilities, null, value);
  }

  const leader = leaderOf(table, state, legal, fallbackAction(fallback));

  const floored = (): Partial<Record<CompetencyAction, number>> =>
    Object.fromEntries(
      legal.map(action => [action, action === leader ? 1 - (legal.length - 1) * warmUp.floor : warmUp.floor])
    ) as Partial<Record<CompetencyAction, number>>;

  if (visits(leader) < warmUp.commitLeader) {
    const probabilities = floored();
    const [action, value] = draw(probabilities, rng);
    return decided(action, 'commit_1', probabilities, leader, value);
  }

  const needSecond = legal.filter(
    action => action !== leader && visits(action) < warmUp.exploreFirst + warmUp.exploreSecond
  );
  if (needSecond.length > 0) {
    const probabilities = uniform(needSecond);
    const [action, value] = draw(probabilities, rng);
    return decided(action, 'explore_2', probabilities, leader, value);
  }

  const probabilities = floored();
  const [action, value] = draw(probabilities, rng);
  return decided(action, 'final_commit', probabilities, leader, value);
};

/**
 * The warm-up phase a state is in, for display: which phase its next decision
 * would come from. Ties for the leader are broken by fewer visits, then list
 * order, because the fallback rule needs a learner's context; the decision log
 * carries the exact phase of every real decision.
 */
export const statePhase = (table: QTable, state: QState, warmUp: WarmUp = DEFAULT_WARM_UP): { phase: DecisionPhase; tag: StateTag; leader: CompetencyAction | null } => {
  const legal = legalActions(state);
  if (legal.length === 1) return { phase: 'only_legal', tag: 'no_choice', leader: null };
  const visits = (action: CompetencyAction) => cell(table, state, action).visits;
  if (legal.some(action => visits(action) < warmUp.exploreFirst)) return { phase: 'explore_1', tag: 'exploring', leader: null };
  const leader = leaderOf(table, state, legal, legal[legal.length - 1]);
  const phase: DecisionPhase =
    visits(leader) < warmUp.commitLeader
      ? 'commit_1'
      : legal.some(action => action !== leader && visits(action) < warmUp.exploreFirst + warmUp.exploreSecond)
        ? 'explore_2'
        : 'final_commit';
  return { phase, tag: tagOfPhase(phase), leader };
};

/** Records that an action was chosen in a state: the warm-up counts visits, whichever phase chose. */
export const recordVisit = (table: QTable, state: QState, action: CompetencyAction): QTable => {
  const key = stateKey(state);
  const before = cell(table, state, action);
  return { ...table, [key]: { ...table[key], [action]: { ...before, visits: before.visits + 1 } } };
};

/** Whether a state has finished the warm-up: every legal action through Explore II and the leader committed. */
export const warmUpFinished = (table: QTable, state: QState, warmUp: WarmUp = DEFAULT_WARM_UP): boolean => {
  const legal = legalActions(state);
  if (legal.length < 2) return true;
  const visits = legal.map(action => cell(table, state, action).visits).sort((a, b) => b - a);
  return visits[0] >= warmUp.commitLeader && visits.slice(1).every(v => v >= warmUp.exploreFirst + warmUp.exploreSecond);
};

// --- learning --------------------------------------------------------------------

/** gamma = 0.9; the analysis rechecks the leaders at gamma = 0 from the logs. */
export const GAMMA = 0.9;

/**
 * One Q-learning update with alpha = 1/n:
 *
 *   Q(s,a) <- Q(s,a) + (1/n) [ r + gamma * max_{a' in legal(s')} Q(s',a') - Q(s,a) ]
 *
 * `next` is null when the competency has no next decision: Q(s', .) = 0. Every
 * visit updates its cell whichever phase chose it (Q-learning is off-policy).
 */
export const updateQ = (
  table: QTable,
  state: QState,
  action: CompetencyAction,
  reward: number,
  next: QState | null,
  gamma = GAMMA
): { table: QTable; target: number; before: number; after: number } => {
  const before = cell(table, state, action);
  const bootstrap = next ? Math.max(...legalActions(next).map(a => cell(table, next, a).q)) : 0;
  const target = reward + gamma * bootstrap;
  const n = before.n + 1;
  const q = before.q + (target - before.q) / n;
  const key = stateKey(state);
  return {
    table: { ...table, [key]: { ...table[key], [action]: { ...before, q, n } } },
    target,
    before: before.q,
    after: q,
  };
};

// --- reward ------------------------------------------------------------------------

/** TENTATIVE reward weights. */
export interface RewardWeights {
  /** beta: weight on passing at the next measurement. */
  pass: number;
  /** psi: cost per graded decision the action added. */
  perAddedDecision: number;
}

export const DEFAULT_REWARD: RewardWeights = { pass: 0.5, perAddedDecision: 0.02 };

/** The competency's next measurement, from observed data. */
export interface Measurement {
  /** Share of its graded decisions answered correctly. */
  accuracy: number;
  passed: boolean;
}

/**
 * r = A_next + beta * Pass - psi * H (TENTATIVE).
 *
 * H = graded decisions the action added: practice, its scenarios in the repeat
 * drive; review, its scenarios after the module section; none, 0. Uses only
 * observed data. Replaces NG_c + 0.5 Pass - 0.02 H, which favoured practice by
 * construction. Basis: outcome minus a small per-activity penalty (Ruan et al.,
 * 2024); accuracy as a reward signal (Girard et al., 2024).
 */
export const rewardOf = (measurement: Measurement, addedDecisions: number, weights: RewardWeights = DEFAULT_REWARD): number =>
  measurement.accuracy + weights.pass * (measurement.passed ? 1 : 0) - weights.perAddedDecision * addedDecisions;
