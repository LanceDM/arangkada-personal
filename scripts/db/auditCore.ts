/**
 * The audit's checks, with no database: what `npm run db:audit` runs over the
 * records it reads, and what the tests run over the in-memory stores.
 *
 * The rules can only check who writes and in what shape; every value comes from
 * a participant's browser. The audit is the check on the values themselves:
 * it recomputes them from the raw records and reports every difference.
 *
 * Four Q-tables since 2026-11-19 (domain/competencyRouting/qTables): each is
 * checked on its own, and each course log entry against the table it decided
 * from and the tables it also taught.
 *
 * 1. Each Q-table: its update log is replayed from an empty table (or the table
 *    its last reset started it from), entry
 *    by entry (replayQLog): numbering, reward from its parts, target, Q, n,
 *    visits, and each entry's table snapshot. The stored table must equal the
 *    replay, and its counter the log's length.
 * 2. Each participant's course log against the Q-table log: every decision has
 *    its `visit` entry and every reward its `learn` entry (same participant,
 *    same decision, same action, same reward), and every Q entry of the
 *    participant is in their course log, so no change to the shared table is
 *    unexplained. Each reward's accuracy and pass must match the verdict the
 *    same course log entry recorded.
 * 3. Each participant's BKT: the whole log is rebuilt from the raw answers
 *    (drive attempts and sittings) and compared entry by entry with what was
 *    logged, and the profile with the rebuilt profile.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import { rewardOf, type QTable } from '@/domain/competencyRouting/qLearning';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import { replayQLog, sameTable, type QLogEntry } from '@/domain/study/qLog';
import { buildBKTLog, type BKTProfileDoc, type BKTUpdateRecord, type EvidenceOrigin } from '@/domain/study/bktLog';
import { orderEvidence } from '@/domain/study/evidence';
import { qTableDocId, type QTableId } from '@/domain/competencyRouting/qTables';


export interface AuditCourseLog {
  id: string;
  kind: 'drive' | 'quiz' | 'post_exam' | 'final';
  verdicts: { competency: string; total: number; correct: number; passed: boolean }[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  tableAfter?: QTable;
  timestamp: number;
  /** False for an admin's course, which the table never learns from (2026-11-16). */
  learnsTable?: boolean;
  /** The table its decisions were made from (2026-11-19); absent before the split, which was the study's. */
  qTable?: QTableId;
  /** The other tables it also taught. */
  alsoTaught?: QTableId[];
}

export interface AuditUser {
  uid: string;
  /**
   * An admin account (2026-11-16): its course is a check of the game, read
   * from the table but never written to it, so it is not held to the table's
   * log, and what is wrong in its records is test play, not study data.
   */
  admin?: boolean;
  courseLogs: AuditCourseLog[];
  attempts: { levelId: number; logs: ActionLog[]; timestamp?: number; evidenceSeq?: number | null }[];
  sittings: { kind: 'quiz' | 'diagnostic' | 'post_exam'; levelId: number | null; attempt: number | null; answers: ActionLog[]; timestamp?: number; evidenceSeq?: number | null; id?: string }[];
  bktUpdates: BKTUpdateRecord[];
  bktProfile: BKTProfileDoc | null;
}

export interface AuditInput {
  table: QTable | null;
  tableUpdates: number | null;
  qUpdates: QLogEntry[];
  users: AuditUser[];
  configVersion: string;
  /** The table's last reset, if any: the table now is the replay of the log from `fromGlobalSeq` on. */
  lastReset?: { fromGlobalSeq: number; at?: number } | null;
  /** What the study table's last reset started it from: empty unless given. */
  lastResetStart?: QTable | null;
  /** The dry run's, the test's and the public table (2026-11-19); the fields above are the study's. */
  otherTables?: AuditTable[];
}

/** One Q-table as the audit reads it. */
export interface AuditTable {
  id: QTableId;
  table: QTable | null;
  tableUpdates: number | null;
  qUpdates: QLogEntry[];
  lastReset?: { fromGlobalSeq: number; at?: number } | null;
  /** The table its last reset started it from (the public table may start from the study's); empty unless given. */
  lastResetStart?: QTable | null;
}

const tablesOf = (input: AuditInput): AuditTable[] => [
  { id: 'study', table: input.table, tableUpdates: input.tableUpdates, qUpdates: input.qUpdates, lastReset: input.lastReset, lastResetStart: input.lastResetStart },
  ...(input.otherTables ?? []),
];

export interface AuditReport {
  problems: string[];
  /** What is wrong in admin accounts' records: test play, reported but not counted against the study. */
  adminNotes: string[];
  /** One line per part checked, for the console. */
  summary: string[];
  /** The table the log replays to: what the shared table should be. */
  rebuiltTable: QTable;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
const decisionIdOf = (d: DecisionRecord) => `${d.levelId}:${d.competency}:${d.seq}`;

/** The participant's graded answers in the order BKT reads them: the app's own ordering (domain/study/evidence). */
export const taggedEvidence = (user: Pick<AuditUser, 'attempts' | 'sittings'>): { logs: ActionLog[]; origins: EvidenceOrigin[] } =>
  orderEvidence([
    ...user.attempts.map(a => ({ kind: 'attempt' as const, levelId: a.levelId, attempt: null, evidenceSeq: a.evidenceSeq ?? null, timestamp: a.timestamp ?? 0, logs: a.logs })),
    ...user.sittings.map(s => ({ kind: s.kind, levelId: s.levelId, attempt: s.attempt, evidenceSeq: s.evidenceSeq ?? null, timestamp: s.timestamp ?? 0, logs: s.answers, ref: s.id ?? null })),
  ]);

const auditQTable = (input: AuditTable, problems: string[], summary: string[]): QTable => {
  const path = `policy/${qTableDocId(input.id)}`;
  // A reset empties the table, or starts it from a copy, and keeps the log
  // (2026-11-16): the stretch before it is replayed on its own and checked for
  // its numbering and its arithmetic; the table now must equal the replay of
  // the stretch after it, from what the reset started it from.
  const from = input.lastReset?.fromGlobalSeq ?? 1;
  const before = input.qUpdates.filter(entry => entry.globalSeq < from);
  const after = input.qUpdates.filter(entry => entry.globalSeq >= from);
  const earlier = before.length > 0 ? replayQLog(before) : { table: {}, problems: [] as string[] };
  const replay = replayQLog(after, { firstSeq: from, start: input.lastResetStart ?? undefined });
  const logProblems = [...earlier.problems, ...replay.problems].map(problem => (input.id === 'study' ? problem : `${path}: ${problem}`));
  problems.push(...logProblems.slice(0, 20));
  if (logProblems.length > 20) problems.push(`... and ${logProblems.length - 20} more Q-log problems`);
  if (input.table && !sameTable(input.table, replay.table)) {
    problems.push(`${path}: the stored table differs from the replay of its log${from > 1 ? ` since the reset (from globalSeq ${from})` : ''}`);
  }
  if (input.tableUpdates !== null && input.tableUpdates !== input.qUpdates.length) {
    problems.push(`${path} counts ${input.tableUpdates} updates; the log has ${input.qUpdates.length}`);
  }
  const byVersion = new Map<string, number>();
  for (const entry of input.qUpdates) byVersion.set(entry.configVersion, (byVersion.get(entry.configVersion) ?? 0) + 1);
  const versions = [...byVersion].map(([tag, n]) => `${tag}: ${n}`).join(', ');
  const split = from > 1 ? `; ${before.length} before the last reset, ${after.length} since` : '';
  const name = input.id === 'study' ? 'Q-table log' : `Q-table log (${input.id})`;
  summary.push(`${name}: ${input.qUpdates.length} entries replayed${versions ? ` (${versions})` : ''}${split}, ${logProblems.length} problem(s)`);
  return replay.table;
};

/** Whether a course log entry taught table `id`: the one it decided from, or one it also taught. */
const taught = (log: AuditCourseLog, id: QTableId) =>
  log.learnsTable !== false && ((log.qTable ?? 'study') === id || (log.alsoTaught ?? []).includes(id));

const auditCourse = (user: AuditUser, tables: readonly AuditTable[], problems: string[]): number => {
  const before = problems.length;
  for (const table of tables) auditCourseIn(user, table, problems);
  return problems.length - before;
};

const auditCourseIn = (user: AuditUser, source: AuditTable, problems: string[]) => {
  const qUpdates = source.qUpdates;
  const mine = qUpdates.filter(entry => entry.uid === user.uid);
  const visits = new Map(mine.filter(e => e.kind === 'visit').map(e => [e.decisionId, e]));
  const learns = new Map(mine.filter(e => e.kind === 'learn').map(e => [e.decisionId, e]));
  const explained = new Set<QLogEntry>();
  const where = source.id === 'study' ? 'the Q-table log' : `the ${source.id} Q-table log`;

  for (const log of user.courseLogs) {
    // Recorded as not teaching this table: nothing of it is in its log.
    if (!taught(log, source.id)) continue;
    const at = `${user.uid} courseLog ${log.id}`;
    let lastSeq = 0;
    for (const decision of log.decisions) {
      if (decision.source === 'cap') continue;
      const id = decisionIdOf(decision);
      const visit = visits.get(id);
      if (!visit) problems.push(`${at}: decision ${id} has no visit in ${where}`);
      else if (visit.action !== decision.action) problems.push(`${at}: decision ${id} chose ${decision.action}; ${where} has ${visit.action}`);
      else {
        explained.add(visit);
        lastSeq = Math.max(lastSeq, visit.globalSeq);
      }
    }
    for (const reward of log.rewards) {
      const learn = learns.get(reward.decisionId);
      if (!learn?.learning) problems.push(`${at}: reward for ${reward.decisionId} has no learn entry in ${where}`);
      else if (!near(learn.learning.reward, reward.reward)) problems.push(`${at}: reward for ${reward.decisionId} is ${reward.reward}; ${where} has ${learn.learning.reward}`);
      else {
        explained.add(learn);
        lastSeq = Math.max(lastSeq, learn.globalSeq);
      }
      // The reward follows from its parts, and its parts from the verdict this same entry recorded.
      const fromParts = rewardOf({ accuracy: reward.accuracy, passed: reward.passed }, reward.addedDecisions, learn?.learning?.weights);
      if (!near(fromParts, reward.reward)) problems.push(`${at}: reward for ${reward.decisionId} is ${reward.reward}; its parts give ${fromParts}`);
      if (log.kind !== 'post_exam') {
        const verdict = log.verdicts.find(v => v.competency === reward.competency);
        if (!verdict) problems.push(`${at}: reward for ${reward.decisionId} has no verdict for ${reward.competency}`);
        else {
          const accuracy = verdict.total > 0 ? verdict.correct / verdict.total : 0;
          if (!near(accuracy, reward.accuracy)) problems.push(`${at}: reward accuracy ${reward.accuracy}; the verdict gives ${accuracy}`);
          if (verdict.passed !== reward.passed) problems.push(`${at}: reward says passed=${reward.passed}; the verdict says ${verdict.passed}`);
        }
        if (reward.measuredBy !== log.kind) problems.push(`${at}: reward measured by ${reward.measuredBy} in a ${log.kind} entry`);
      }
    }
    // The entry's table snapshot is the table it decided from, right after its own last change.
    if (log.tableAfter && lastSeq > 0 && (log.qTable ?? 'study') === source.id) {
      const entry = qUpdates.find(e => e.globalSeq === lastSeq);
      if (entry && !sameTable(entry.tableAfter, log.tableAfter)) problems.push(`${at}: tableAfter differs from the table after globalSeq ${lastSeq}`);
    }
  }
  for (const entry of mine) {
    if (!explained.has(entry)) problems.push(`${user.uid}: ${source.id === 'study' ? 'Q-table' : `${source.id} Q-table`} change globalSeq ${entry.globalSeq} (${entry.kind} ${entry.decisionId}) is in no course log entry`);
  }
};

const auditBKT = (user: AuditUser, configVersion: string, problems: string[]): number => {
  const before = problems.length;
  const { logs, origins } = taggedEvidence(user);
  const rebuilt = buildBKTLog({
    uid: user.uid,
    logs,
    origins,
    alreadyLogged: 0,
    envelope: i => ({ schemaVersion: 1, eventId: `audit-${i}`, at: 0, sessionId: 'audit', appBuild: 'audit', configVersion }),
    now: 0,
    configVersion,
  });
  const logged = user.bktUpdates.filter(u => u.configVersion === configVersion).sort((a, b) => a.userSeq - b.userSeq);
  if (logged.length !== rebuilt.entries.length) problems.push(`${user.uid}: ${logged.length} BKT updates logged; the raw answers give ${rebuilt.entries.length}`);
  const fields = ['competency', 'source', 'correct', 'pBefore', 'posterior', 'pAfter', 'levelAfter'] as const;
  let shown = 0;
  logged.forEach((entry, i) => {
    const expected = rebuilt.entries[i];
    if (!expected) return;
    const wrong = fields.filter(f => (typeof entry[f] === 'number' ? !near(entry[f] as number, expected[f] as number) : entry[f] !== expected[f]));
    if (wrong.length > 0 && shown++ < 5) {
      problems.push(`${user.uid}: BKT update ${entry.userSeq} differs from the raw answers in ${wrong.map(f => `${f} (${entry[f]} vs ${expected[f]})`).join(', ')}`);
    }
  });
  if (shown > 5) problems.push(`${user.uid}: ... and ${shown - 5} more BKT updates differ`);
  if (user.bktProfile && user.bktProfile.configVersion === configVersion) {
    for (const [competency, c] of Object.entries(rebuilt.profile.competencies)) {
      const stored = user.bktProfile.competencies[competency as keyof typeof user.bktProfile.competencies];
      if (!stored || !near(stored.p, c.p)) problems.push(`${user.uid}: BKT profile ${competency} P(L) ${stored?.p}; the raw answers give ${c.p}`);
    }
  }
  return problems.length - before;
};

export const auditStudy = (input: AuditInput): AuditReport => {
  const problems: string[] = [];
  const summary: string[] = [];
  const tables = tablesOf(input);
  const rebuiltTable = auditQTable(tables[0], problems, summary);
  for (const table of tables.slice(1)) auditQTable(table, problems, summary);

  const known = new Set(input.users.map(u => u.uid));
  const strangers = new Set(tables.flatMap(table => table.qUpdates).map(e => e.uid).filter(uid => !known.has(uid)));
  for (const uid of strangers) problems.push(`Q-table log has changes by ${uid}, who has no user record`);

  let course = 0;
  let bkt = 0;
  const adminNotes: string[] = [];
  const admins = input.users.filter(user => user.admin);
  for (const user of input.users) {
    if (user.admin) {
      // Not held to the table's log: an admin's course never writes to it.
      auditBKT(user, input.configVersion, adminNotes);
      continue;
    }
    course += auditCourse(user, tables, problems);
    bkt += auditBKT(user, input.configVersion, problems);
  }
  const players = input.users.length - admins.length;
  summary.push(`Course logs of ${players} account(s) against the Q-table log: ${course} problem(s)`);
  summary.push(`BKT rebuilt from raw answers for ${players} account(s): ${bkt} problem(s)`);
  if (admins.length > 0) {
    summary.push(`${admins.length} admin account(s) set apart (test play, never in the Q-table): ${adminNotes.length} note(s)`);
  }
  return { problems, adminNotes, summary, rebuiltTable };
};
