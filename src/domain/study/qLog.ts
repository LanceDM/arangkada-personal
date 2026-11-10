/**
 * The shared Q-table's full history (`policy/competencyQ/updates/{id}`).
 *
 * A decision writes a `visit` entry when it is made; its reward writes a
 * `learn` entry when the competency is next measured. Each entry holds
 * everything needed to redo it by hand: the decision's probabilities and random
 * draw, its exploration tag, the reward's parts, the next state, the target,
 * Q and n before and after, and the whole table afterwards. `globalSeq` is the
 * table's own counter, assigned inside the transaction that applies the change.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { DecisionRecord, QOperation, RewardRecord } from '@/domain/competencyRouting/course';
import {
  DEFAULT_REWARD,
  DEFAULT_WARM_UP,
  Q_STATES,
  legalActions,
  recordVisit,
  rewardOf,
  stateKey,
  statePhase,
  updateQ,
  type CompetencyAction,
  type DecisionPhase,
  type QState,
  type QTable,
  type RewardWeights,
  type StateTag,
  type WarmUp,
} from '@/domain/competencyRouting/qLearning';
import type { StudyEnvelope } from './studyEvent';

/** One operation with the record it came from. */
export type QLogItem =
  | { op: Extract<QOperation, { kind: 'visit' }>; decision: DecisionRecord }
  | { op: Extract<QOperation, { kind: 'update' }>; reward: RewardRecord };

export interface QLogContext {
  participantCode: string | null;
  levelId: number | null;
  phase: string | null;
  attemptId: string | null;
}

export interface StateStatus {
  phase: DecisionPhase;
  tag: StateTag;
  leader: CompetencyAction | null;
}

export interface QLogEntry extends StudyEnvelope, QLogContext {
  globalSeq: number;
  kind: 'visit' | 'learn';
  competency: DrivingCompetency;
  /** The decision this entry belongs to: `<stage>:<competency>:<decision seq>`. */
  decisionId: string;
  stateKey: string;
  state: QState;
  action: CompetencyAction;
  /** `visit` entries: the decision as it was made. */
  decision: {
    masteryP: number;
    legal: CompetencyAction[];
    snapshot: DecisionRecord['snapshot'];
    leader: CompetencyAction | null;
    warmUpPhase: DecisionRecord['source'];
    selection: DecisionRecord['selection'];
    probabilities: DecisionRecord['probabilities'];
    probability: number;
    draw: number | null;
    visitsBefore: number;
    visitsAfter: number;
  } | null;
  /** `learn` entries: the reward and the update it caused. */
  learning: {
    accuracy: number;
    passed: boolean;
    addedDecisions: number;
    weights: RewardWeights;
    reward: number;
    measuredBy: RewardRecord['measuredBy'];
    nextStateKey: string | null;
    maxNextQ: number;
    gamma: number;
    alpha: number;
    target: number;
    qBefore: number;
    qAfter: number;
    nBefore: number;
    nAfter: number;
  } | null;
  tableAfter: QTable;
  statesAfter: Record<string, StateStatus>;
}

/** Pairs a drive's operations with their records: visits with the decisions (cap decisions have none), updates with the rewards, in order. */
export const pairQOperations = (
  operations: readonly QOperation[],
  decisions: readonly DecisionRecord[],
  rewards: readonly RewardRecord[]
): QLogItem[] => {
  const chosen = decisions.filter(d => d.source !== 'cap');
  let v = 0;
  let u = 0;
  return operations.map(op => {
    if (op.kind === 'visit') {
      const decision = chosen[v++];
      if (!decision) throw new Error('a visit with no decision');
      return { op, decision };
    }
    const reward = rewards[u++];
    if (!reward) throw new Error('an update with no reward');
    return { op, reward };
  });
};

export const statesOf = (table: QTable, warmUp: WarmUp = DEFAULT_WARM_UP): Record<string, StateStatus> =>
  Object.fromEntries(Q_STATES.map(state => [stateKey(state), statePhase(table, state, warmUp)]));

const cellOf = (table: QTable, state: QState, action: CompetencyAction) =>
  table[stateKey(state)]?.[action] ?? { q: 0, n: 0, visits: 0 };

/** Applies the items to `table` in order and returns one entry per item. */
export const applyQLog = (input: {
  table: QTable;
  items: readonly QLogItem[];
  firstGlobalSeq: number;
  context: QLogContext;
  envelope: (index: number) => StudyEnvelope;
  weights?: RewardWeights;
  warmUp?: WarmUp;
}): { table: QTable; entries: QLogEntry[] } => {
  const weights = input.weights ?? DEFAULT_REWARD;
  let table = input.table;
  const entries = input.items.map((item, i): QLogEntry => {
    const { op } = item;
    const before = cellOf(table, op.state, op.action);
    let decision: QLogEntry['decision'] = null;
    let learning: QLogEntry['learning'] = null;
    let competency: DrivingCompetency;
    let decisionId: string;

    if ('decision' in item) {
      const d = item.decision;
      table = recordVisit(table, op.state, op.action);
      competency = d.competency;
      decisionId = `${d.levelId}:${d.competency}:${d.seq}`;
      decision = {
        masteryP: d.masteryP, legal: d.legal, snapshot: d.snapshot, leader: d.leader, warmUpPhase: d.source,
        selection: d.selection, probabilities: d.probabilities, probability: d.probability, draw: d.draw,
        visitsBefore: before.visits, visitsAfter: before.visits + 1,
      };
    } else {
      const r = item.reward;
      const updateOp = op as Extract<QOperation, { kind: 'update' }>;
      const next = updateOp.next;
      const maxNextQ = next ? Math.max(...legalActions(next).map(a => cellOf(table, next, a).q)) : 0;
      const applied = updateQ(table, updateOp.state, updateOp.action, updateOp.reward, next, updateOp.gamma);
      table = applied.table;
      competency = r.competency;
      decisionId = r.decisionId;
      learning = {
        accuracy: r.accuracy, passed: r.passed, addedDecisions: r.addedDecisions, weights, reward: r.reward,
        measuredBy: r.measuredBy, nextStateKey: next ? stateKey(next) : null, maxNextQ, gamma: updateOp.gamma,
        alpha: 1 / (before.n + 1), target: applied.target, qBefore: applied.before, qAfter: applied.after,
        nBefore: before.n, nAfter: before.n + 1,
      };
    }
    return {
      ...input.envelope(i),
      ...input.context,
      globalSeq: input.firstGlobalSeq + i,
      kind: decision ? 'visit' : 'learn',
      competency,
      decisionId,
      stateKey: stateKey(op.state),
      state: op.state,
      action: op.action,
      decision,
      learning,
      tableAfter: table,
      statesAfter: statesOf(table, input.warmUp),
    };
  });
  return { table, entries };
};

// --- replay ------------------------------------------------------------------------------

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;

/**
 * Replays the shared table's log from an empty table and checks every entry
 * against what its own logged inputs give: the numbering (1, 2, 3... with no gap
 * or repeat), the reward from its parts, the target, Q, n and visits before and
 * after, and the whole table it says it left. This is the check that the shared
 * table is exactly the sum of its logged changes, so a lost update, a write that
 * skipped the log, or an altered value shows up.
 *
 * Returns the replayed table and every problem found (empty when the log is sound).
 */
export const replayQLog = (
  entries: readonly QLogEntry[],
  options: { start?: QTable; tableEquals?: (a: QTable, b: QTable) => boolean } = {}
): { table: QTable; problems: string[] } => {
  const equals = options.tableEquals ?? sameTable;
  const ordered = [...entries].sort((a, b) => a.globalSeq - b.globalSeq);
  const problems: string[] = [];
  let table: QTable = options.start ?? {};
  ordered.forEach((entry, i) => {
    const at = `globalSeq ${entry.globalSeq}`;
    if (entry.globalSeq !== i + 1) problems.push(`${at}: expected globalSeq ${i + 1}`);
    if (stateKey(entry.state) !== entry.stateKey) problems.push(`${at}: stateKey ${entry.stateKey} does not match the state`);
    const before = cellOf(table, entry.state, entry.action);
    if (entry.kind === 'visit') {
      if (!entry.decision) problems.push(`${at}: a visit with no decision`);
      else if (entry.decision.visitsBefore !== before.visits) problems.push(`${at}: visitsBefore ${entry.decision.visitsBefore}, replay has ${before.visits}`);
      table = recordVisit(table, entry.state, entry.action);
    } else {
      const l = entry.learning;
      if (!l) {
        problems.push(`${at}: a learn entry with no learning`);
      } else {
        const reward = rewardOf({ accuracy: l.accuracy, passed: l.passed }, l.addedDecisions, l.weights);
        if (!near(reward, l.reward)) problems.push(`${at}: reward ${l.reward}, its parts give ${reward}`);
        const next = l.nextStateKey === null ? null : Q_STATES.find(s => stateKey(s) === l.nextStateKey) ?? null;
        if (l.nextStateKey !== null && !next) problems.push(`${at}: unknown next state ${l.nextStateKey}`);
        const maxNextQ = next ? Math.max(...legalActions(next).map(a => cellOf(table, next, a).q)) : 0;
        if (!near(maxNextQ, l.maxNextQ)) problems.push(`${at}: maxNextQ ${l.maxNextQ}, replay has ${maxNextQ}`);
        if (l.nBefore !== before.n) problems.push(`${at}: nBefore ${l.nBefore}, replay has ${before.n}`);
        if (!near(l.qBefore, before.q)) problems.push(`${at}: qBefore ${l.qBefore}, replay has ${before.q}`);
        const applied = updateQ(table, entry.state, entry.action, l.reward, next, l.gamma);
        if (!near(applied.target, l.target)) problems.push(`${at}: target ${l.target}, replay has ${applied.target}`);
        if (!near(applied.after, l.qAfter)) problems.push(`${at}: qAfter ${l.qAfter}, replay has ${applied.after}`);
        table = applied.table;
      }
    }
    if (entry.tableAfter && !equals(entry.tableAfter, table)) problems.push(`${at}: tableAfter differs from the replay`);
  });
  return { table, problems };
};

/** Two tables hold the same cells (a state with no cells yet equals a missing state). */
export const sameTable = (a: QTable, b: QTable): boolean => {
  const filled = (t: QTable) => Object.fromEntries(Object.entries(t).filter(([, cells]) => cells && Object.keys(cells).length > 0));
  return JSON.stringify(sortKeys(filled(a))) === JSON.stringify(sortKeys(filled(b)));
};

const sortKeys = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value as object).sort().map(key => [key, sortKeys((value as Record<string, unknown>)[key])]))
      : value;
