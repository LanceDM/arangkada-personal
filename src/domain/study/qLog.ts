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
