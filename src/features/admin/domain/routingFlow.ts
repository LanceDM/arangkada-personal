/**
 * The routing FSM's flow as the dashboard shows it: one account's path through
 * the machine, move by move, and how often the pool took each move.
 *
 * A path is the account's routing log, the export's own (`routingLog`, in
 * `seq` order), each move tied to the attempt that logged it: the move into a
 * course entry is logged by that entry's attempt, and a review's return or a
 * certification by the attempt it ended. Attempts outside the machine (free
 * replays, the post-test) are listed beside the moves, never as moves, and
 * with no verdict.
 *
 * The pool's counts are moves and what they added, per group: process only,
 * no score. Evaluators are left out, as the analysis leaves them out.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { addOnOf, aimOf } from '@/domain/learner/adaptive/routingPolicy';
import { controlStateId, stateId, transitionId, type Outcome } from '@/domain/routing/routingTypes';
import type { StudyCohort } from '@/domain/study/participantCode';
import { attemptKind, type AttemptKind, type RoutingTelemetryDoc, type StoredAttempt } from '@/features/driving-sim';
import { routingEdgeKey, type RoutingGraph } from './routingGraph';

type LogRecord = RoutingTelemetryDoc['log'][number];

export type RoutingGroupName = 'conventional' | 'optimized';
export type FlowGroup = RoutingGroupName | 'unassigned';

/** One pool account, as far as its flow reads it. */
export interface FlowAccount {
  code: string;
  cohort: StudyCohort;
  /** The group the developers assigned; null where none was. */
  group: string | null;
  /** Oldest first, as the records store holds them. */
  attempts: readonly StoredAttempt[];
  /** The account's whole routing log, in `seq` order: the export's `routingLog`. */
  routingLog: readonly LogRecord[];
}

export type FlowAddOn =
  | { kind: 'practice'; competency: DrivingCompetency; item: { scenarioId: string; sourceLevelId: number } | null }
  | { kind: 'review'; level: number; competency: DrivingCompetency };

export interface FlowAttemptRef {
  id: string;
  /** 1 for the account's first attempt, as Replay numbers them. */
  number: number;
  levelId: number;
  kind: AttemptKind;
}

export interface FlowStep {
  index: number;
  seq: number;
  /** When the attempt that logged it was written. */
  at: number;
  from: string;
  to: string;
  fromStop: string;
  toStop: string;
  /** The table's row, and the diagram's edge; null for a move the machine never offers there. */
  row: string | null;
  edge: string | null;
  move: string;
  /** The verdict the move fired on. */
  outcome: Outcome;
  legal: readonly string[];
  addOn: FlowAddOn | null;
  attempt: FlowAttemptRef | null;
  /** The move led into its attempt; otherwise it ended it (a review's return, a certification). */
  entered: boolean;
  /** For a move into an entry: the group it was decided in, and whether the table was asked. */
  decidedIn: string | null;
  asked: boolean | null;
}

export interface FlowNote {
  /** Played at a frontier as it stood, with no move into it; or played outside the machine. */
  kind: 'as-it-stands' | 'outside';
  attempt: FlowAttemptRef;
  at: number;
}

export type FlowItem = { type: 'step'; step: FlowStep } | { type: 'note'; note: FlowNote };

export interface FlowPath {
  steps: FlowStep[];
  /** The steps and the notes, in the order the attempts were saved. */
  timeline: FlowItem[];
  /** The stop the first move left; null before any. */
  start: string | null;
  /** Moves the machine never offers from where they were logged: none, unless a record is wrong. */
  unknown: number;
}

const IN_MACHINE: ReadonlySet<AttemptKind> = new Set(['course', 'review']);

const addOnOfMove = (record: LogRecord, owner: StoredAttempt | null, entered: boolean): FlowAddOn | null => {
  const kind = addOnOf(record.transition);
  const competency = aimOf(record.transition);
  if (kind === 'none' || !competency) return null;
  if (record.transition.kind === 'review') return { kind: 'review', level: record.transition.level, competency };
  const item = entered ? owner?.routing?.entry?.item : null;
  return { kind: 'practice', competency, item: item ? { scenarioId: item.scenarioId, sourceLevelId: item.sourceLevelId } : null };
};

export const flowPath = (account: FlowAccount, graph: RoutingGraph): FlowPath => {
  const refs = new Map<StoredAttempt, FlowAttemptRef>();
  const byRecord = new Map<LogRecord, StoredAttempt>();
  const bySeq = new Map<number, StoredAttempt>();
  account.attempts.forEach((stored, position) => {
    refs.set(stored, { id: stored.id, number: position + 1, levelId: stored.attempt.levelId, kind: attemptKind(stored) });
    for (const record of stored.routing?.log ?? []) {
      byRecord.set(record, stored);
      bySeq.set(record.seq, stored);
    }
  });
  // The export's log holds the attempts' own entries; a copy is matched by its number.
  const ownerOf = (record: LogRecord) => byRecord.get(record) ?? bySeq.get(record.seq) ?? null;
  const isFirstOf = (stored: StoredAttempt, record: LogRecord) => {
    const first = stored.routing!.log[0];
    return first === record || (first?.seq === record.seq && transitionId(first.transition) === transitionId(record.transition));
  };

  const steps: FlowStep[] = account.routingLog.map((record, index) => {
    const stored = ownerOf(record);
    const move = transitionId(record.transition);
    const from = stateId(record.from);
    const entry = stored?.routing?.entry ?? null;
    const entered = !!stored && entry?.move === move && isFirstOf(stored, record);
    const row = graph.rowOf(from, move);
    const fromStop = controlStateId(record.from);
    const toStop = controlStateId(record.to);
    return {
      index,
      seq: record.seq,
      at: record.at,
      from,
      to: stateId(record.to),
      fromStop,
      toStop,
      row,
      edge: row && routingEdgeKey(row, fromStop, toStop),
      move,
      outcome: record.outcome,
      legal: record.legal,
      addOn: addOnOfMove(record, stored, entered),
      attempt: stored ? refs.get(stored)! : null,
      entered,
      decidedIn: entered ? entry!.decidedIn : null,
      asked: entered ? (entry!.observation?.asked ?? null) : null,
    };
  });

  const stepsOf = new Map<StoredAttempt, FlowStep[]>();
  const loose: FlowStep[] = [];
  steps.forEach((step, index) => {
    const stored = ownerOf(account.routingLog[index]);
    if (!stored) loose.push(step);
    else stepsOf.set(stored, [...(stepsOf.get(stored) ?? []), step]);
  });

  const timeline: FlowItem[] = [];
  for (const stored of account.attempts) {
    const attempt = refs.get(stored)!;
    const own = stepsOf.get(stored) ?? [];
    const at = stored.attempt.timestamp;
    if (!IN_MACHINE.has(attempt.kind)) timeline.push({ type: 'note', note: { kind: 'outside', attempt, at } });
    else if (!own.some(step => step.entered)) timeline.push({ type: 'note', note: { kind: 'as-it-stands', attempt, at } });
    for (const step of own) timeline.push({ type: 'step', step });
  }
  for (const step of loose) timeline.push({ type: 'step', step });

  return {
    steps,
    timeline,
    start: steps[0]?.fromStop ?? null,
    unknown: steps.filter(step => step.row === null).length,
  };
};

// --- the pool ------------------------------------------------------------------------

export interface FlowCounts {
  /** Participants counted. */
  accounts: number;
  moves: number;
  /** Every row of the table, in its order. */
  byRow: Array<{ row: string; count: number }>;
  /** Moves that added nothing, that added a practice item, and reviews. */
  plain: number;
  practice: number;
  reviews: number;
  /** Every competency, in the curriculum's order. */
  practiceBy: Array<{ competency: DrivingCompetency; count: number }>;
  /** Only the reviews taken, by level then competency. */
  reviewsBy: Array<{ level: number; competency: DrivingCompetency; count: number }>;
  /** Moves per diagram edge, and those of them that added practice. */
  edges: Record<string, number>;
  practiceEdges: Record<string, number>;
  /** Moves into an entry that the Optimized group's table was asked to choose. */
  asked: number;
}

export interface PoolFlow {
  groups: Array<{ group: FlowGroup; counts: FlowCounts }>;
  all: FlowCounts;
  /** Dry-run and test accounts, which the analysis leaves out. */
  othersLeftOut: number;
}

const countsOf = (accounts: readonly FlowAccount[], graph: RoutingGraph): FlowCounts => {
  const byRow = new Map(graph.rows.map(row => [row.row, 0]));
  const practiceBy = new Map(COMPETENCIES.map(competency => [competency, 0]));
  const reviewsBy = new Map<string, { level: number; competency: DrivingCompetency; count: number }>();
  const edges: Record<string, number> = {};
  const practiceEdges: Record<string, number> = {};
  const counts = { moves: 0, plain: 0, practice: 0, reviews: 0, asked: 0 };
  for (const account of accounts) {
    for (const step of flowPath(account, graph).steps) {
      counts.moves += 1;
      if (step.row) byRow.set(step.row, (byRow.get(step.row) ?? 0) + 1);
      if (step.edge) edges[step.edge] = (edges[step.edge] ?? 0) + 1;
      if (step.asked) counts.asked += 1;
      if (!step.addOn) counts.plain += 1;
      else if (step.addOn.kind === 'practice') {
        counts.practice += 1;
        practiceBy.set(step.addOn.competency, (practiceBy.get(step.addOn.competency) ?? 0) + 1);
        if (step.edge) practiceEdges[step.edge] = (practiceEdges[step.edge] ?? 0) + 1;
      } else {
        counts.reviews += 1;
        const key = `${step.addOn.level}|${step.addOn.competency}`;
        const known = reviewsBy.get(key) ?? { level: step.addOn.level, competency: step.addOn.competency, count: 0 };
        reviewsBy.set(key, { ...known, count: known.count + 1 });
      }
    }
  }
  return {
    accounts: accounts.length,
    ...counts,
    byRow: [...byRow].map(([row, count]) => ({ row, count })),
    practiceBy: [...practiceBy].map(([competency, count]) => ({ competency, count })),
    reviewsBy: [...reviewsBy.values()].sort(
      (a, b) => a.level - b.level || COMPETENCIES.indexOf(a.competency) - COMPETENCIES.indexOf(b.competency)
    ),
    edges,
    practiceEdges,
  };
};

const groupOf = (account: FlowAccount): FlowGroup =>
  account.group === 'conventional' || account.group === 'optimized' ? account.group : 'unassigned';

/** The study cohort's moves, per group and together. An unassigned column appears only when an account is unassigned. */
export const poolFlow = (accounts: readonly FlowAccount[], graph: RoutingGraph): PoolFlow => {
  const participants = accounts.filter(account => account.cohort === 'study');
  const groups: FlowGroup[] = ['conventional', 'optimized'];
  if (participants.some(account => groupOf(account) === 'unassigned')) groups.push('unassigned');
  return {
    groups: groups.map(group => ({ group, counts: countsOf(participants.filter(account => groupOf(account) === group), graph) })),
    all: countsOf(participants, graph),
    othersLeftOut: accounts.length - participants.length,
  };
};
