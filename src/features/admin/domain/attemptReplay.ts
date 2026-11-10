/**
 * One saved attempt as the Replay section shows it: what it was, every
 * decision in it, what the level was played at, and its routing record. Read
 * from the attempt and the three records beside it; the FSM log is the one
 * record this does not read (`replayTimeline`). The attempts are a pilot pool
 * account's, from the records store, or any other signed-in player's, read for
 * the section alone.
 *
 * A list of attempts carries no score and no pass, so the section cannot be
 * read down as a table of results. One attempt's verdicts are shown inside it,
 * and nothing is set beside another account's.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { stateId, transitionId } from '@/domain/routing/routingTypes';
import type { UserRow } from './adminReport';
import {
  POST_TEST_SEED,
  attemptDurationMs,
  attemptKind,
  type AttemptKind,
  type DecisionRecord,
  type RoutingTelemetryDoc,
  type StoredAttempt,
} from '@/features/driving-sim';
import { levelName } from './playerReport';

export const KIND_LABEL: Record<AttemptKind, string> = {
  course: 'Course entry',
  review: 'Review',
  'free-replay': 'Free replay',
  'post-test': 'Post-test',
  legacy: 'Legacy',
  unrecorded: 'No routing record',
};

export interface AttemptListItem {
  id: string;
  /** 1 for the account's first attempt, in the order they were saved. */
  number: number;
  levelId: number;
  level: string;
  /** Null where the attempt's routing record has not been read: a player's list, until it is opened. */
  kind: AttemptKind | null;
  savedAt: number;
  /** Decisions logged, graded or not. */
  decisions: number;
}

/** The account's attempts in the order the records store holds them: oldest first. */
export const attemptList = (attempts: readonly StoredAttempt[]): AttemptListItem[] =>
  attempts.map((stored, index) => ({
    id: stored.id,
    number: index + 1,
    levelId: stored.attempt.levelId,
    level: levelName(stored.attempt.levelId),
    kind: attemptKind(stored),
    savedAt: stored.attempt.timestamp,
    decisions: stored.attempt.logs?.length ?? 0,
  }));

/** A saved attempt document as read, unchecked: a player's list is built from these alone. */
export interface AttemptDocumentRead {
  id: string;
  savedAt: number;
  data: unknown;
}

/**
 * A player's attempts from their documents alone, oldest first. Their kind is
 * in the routing record, which is read only for the attempt opened.
 */
export const playerAttemptList = (attempts: readonly AttemptDocumentRead[]): AttemptListItem[] =>
  attempts.map((doc, index) => {
    const data = (doc.data ?? {}) as { levelId?: number; logs?: unknown[] };
    const levelId = typeof data.levelId === 'number' ? data.levelId : -1;
    return {
      id: doc.id,
      number: index + 1,
      levelId,
      level: levelName(levelId),
      kind: null,
      savedAt: doc.savedAt,
      decisions: Array.isArray(data.logs) ? data.logs.length : 0,
    };
  });

/** A signed-in player outside the pilot pool, as the Players tab lists them. */
export interface ReplayPlayer {
  uid: string;
  /** The username, else the email, else the start of the account id. */
  name: string;
  email: string | null;
}

/**
 * Every signed-in account outside the pilot pool, by name: the pool's accounts
 * are the Pilot tab's, so nobody is listed twice. An admin is a player too.
 */
export const replayPlayers = (users: readonly UserRow[], poolUids: ReadonlySet<string>): ReplayPlayer[] =>
  users
    .filter(user => !poolUids.has(user.id))
    .map(user => ({
      uid: user.id,
      name: user.username?.trim() || user.email?.trim() || user.id.slice(0, 8),
      email: user.email?.trim() || null,
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true }) ||
        (a.email ?? '').localeCompare(b.email ?? '') ||
        a.uid.localeCompare(b.uid)
    );

/** Whether a player matches the search: by name or email, ignoring case. */
export const matchesReplayPlayer = (player: ReplayPlayer, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return needle === '' || player.name.toLowerCase().includes(needle) || (player.email ?? '').toLowerCase().includes(needle);
};

export type ResponseTime = { kind: 'timed'; ms: number } | { kind: 'censored' } | { kind: 'none' };

export interface DecisionRow {
  /** Index into the attempt's logs. */
  logIndex: number;
  at: number;
  scenarioId: string | null;
  /** The scoring rule, where the attempt's own log names one. */
  rule: string | null;
  competency: string | null;
  kind: string | null;
  settlement: string | null;
  verdict: 'correct' | 'violation' | 'neutral';
  points: number;
  /** The scenario the adaptive layer or the routing FSM added. */
  practiceItem: boolean;
  response: ResponseTime;
  support: SupportLevel | null;
  theta: { requested: number; effective: number } | null;
  /** BKT's P(mastered) of the decision's competency either side of it. */
  bkt: { before: number | null; after: number | null } | null;
  /** False where no decision record covers this decision: only the attempt's own log is shown. */
  recorded: boolean;
}

const responseOf = (record: DecisionRecord): ResponseTime =>
  record.reaction === null ? { kind: 'none' } : 'ms' in record.reaction ? { kind: 'timed', ms: record.reaction.ms } : { kind: 'censored' };

/** Every logged decision, joined to its decision record by `logIndex`, in the order they were made. */
export const decisionRows = (stored: StoredAttempt): DecisionRow[] => {
  const records = new Map((stored.decisions?.decisions ?? []).map(record => [record.logIndex, record]));
  return (stored.attempt.logs ?? []).map((log, logIndex): DecisionRow => {
    const record = records.get(logIndex);
    if (record) {
      return {
        logIndex,
        at: record.timestamp,
        scenarioId: record.scenarioId,
        rule: log.ruleId ?? null,
        competency: record.competency,
        kind: record.kind,
        settlement: record.settlement,
        verdict: record.result,
        points: record.points,
        practiceItem: record.remediation,
        response: responseOf(record),
        support: record.support,
        theta: record.theta && { requested: record.theta.requested, effective: record.theta.effective },
        bkt: { before: record.bktBefore, after: record.bktAfter },
        recorded: true,
      };
    }
    return {
      logIndex,
      at: log.timestamp,
      scenarioId: null,
      rule: log.ruleId ?? null,
      competency: log.competency ?? null,
      kind: null,
      settlement: null,
      verdict: log.result,
      points: log.points,
      practiceItem: log.remediation === true,
      response:
        typeof log.reactionTime === 'number'
          ? { kind: 'timed', ms: log.reactionTime }
          : log.reactionCensored
            ? { kind: 'censored' }
            : { kind: 'none' },
      support: log.support ?? null,
      theta: null,
      bkt: null,
      recorded: false,
    };
  });
};

/** What the level was played at, and what changed the route during the drive. */
export interface LevelEntrySummary {
  /** Why the practice policy did or did not adapt the level; `routing` where it was not consulted. */
  source: string | null;
  requested: { support: SupportLevel | null; approachScale: number | null } | null;
  applied: { support: SupportLevel; approachScale: number } | null;
  /** The route as rolled, in road order, an added scenario included. */
  route: string[] | null;
  rerolls: Array<{ afterDecision: number; competency: string }>;
}

export const levelEntrySummary = ({ decisions, routing }: StoredAttempt): LevelEntrySummary => ({
  source: decisions?.policy.source ?? null,
  requested: decisions?.policy.requested ?? null,
  applied:
    decisions?.policy.applied ??
    (routing ? { support: routing.driving.support, approachScale: routing.driving.approachScale } : null),
  route: decisions?.route ?? routing?.entry?.route ?? null,
  rerolls: (decisions?.rerolls ?? []).map(reroll => ({ afterDecision: reroll.afterDecision, competency: reroll.competency })),
});

const MOVE_LABEL: Record<string, string> = {
  retry: 'Retry the level',
  advance: 'Advance to the next level',
  to_final: 'Go to the Final Mission',
  return: 'Return to the frontier',
  certify: 'Certify',
};

/** A routing move's id in words: `advance+practice(parking)` is "Advance to the next level, with a practice item for Parking Compliance". */
export const moveLabel = (id: string): string => {
  const practice = /^(retry|advance)\+practice\((\w+)\)$/.exec(id);
  if (practice) return `${MOVE_LABEL[practice[1]]}, with a practice item for ${getCompetencyLabel(practice[2])}`;
  const review = /^review\((\d+),(\w+)\)$/.exec(id);
  if (review) return `Review Level ${review[1]} for ${getCompetencyLabel(review[2])}`;
  return MOVE_LABEL[id] ?? id;
};

export interface RoutingLogRow {
  seq: number;
  from: string;
  to: string;
  transition: string;
  outcome: string;
  at: number;
}

export interface RoutingSummary {
  kind: AttemptKind;
  record: RoutingTelemetryDoc | null;
  /** The move that led to this entry; null where none was taken. */
  move: { id: string; label: string } | null;
  legal: Array<{ id: string; label: string }>;
  /** The routing FSM's log entries this attempt added. */
  log: RoutingLogRow[];
  /** A post-test's seed against the one fixed roll every participant plays. */
  postTestSeed: { seed: number | null; fixed: number; matches: boolean } | null;
}

export const routingSummary = (stored: StoredAttempt): RoutingSummary => {
  const record = stored.routing;
  const entry = record?.entry ?? null;
  const kind = attemptKind(stored);
  const seed = stored.decisions?.attemptSeed ?? null;
  return {
    kind,
    record,
    move: entry?.move ? { id: entry.move, label: moveLabel(entry.move) } : null,
    legal: (entry?.legal ?? []).map(id => ({ id, label: moveLabel(id) })),
    log: (record?.log ?? []).map(row => ({
      seq: row.seq,
      from: stateId(row.from),
      to: stateId(row.to),
      transition: transitionId(row.transition),
      outcome: row.outcome,
      at: row.at,
    })),
    postTestSeed: kind === 'post-test' ? { seed, fixed: POST_TEST_SEED, matches: seed === POST_TEST_SEED } : null,
  };
};

export interface RecordPresence {
  present: boolean;
  truncated: boolean;
  /** How many entries the record had before any cut; null where it has none. */
  totalCount: number | null;
}

export interface AttemptSummary {
  item: AttemptListItem;
  /** First FSM transition to save, as the export times a drive; null where it cannot be timed. */
  durationMs: number | null;
  seed: number | null;
  records: { fsm: RecordPresence; decisions: RecordPresence; routing: RecordPresence };
}

const presence = (record: { truncated: boolean; totalCount: number } | null): RecordPresence => ({
  present: record !== null,
  truncated: record?.truncated ?? false,
  totalCount: record?.totalCount ?? null,
});

export const attemptSummary = (stored: StoredAttempt, item: AttemptListItem): AttemptSummary => ({
  item,
  durationMs: attemptDurationMs(stored),
  seed: stored.decisions?.attemptSeed ?? null,
  records: { fsm: presence(stored.fsm), decisions: presence(stored.decisions), routing: presence(stored.routing) },
});
