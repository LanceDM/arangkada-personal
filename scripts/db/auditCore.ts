/**
 * The audit's checks, with no database: what `npm run db:audit` runs over the
 * records it reads, and what the tests run over the in-memory stores.
 *
 * The rules can only check who writes and in what shape; every value comes from
 * a participant's browser. The audit is the check on the values themselves:
 * it recomputes them from the raw records and reports every difference.
 *
 * 1. The shared Q-table: the update log is replayed from an empty table, entry
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

/** The tutorial (level 0) is not evidence. */
const TUTORIAL_LEVEL_ID = 0;

export interface AuditCourseLog {
  id: string;
  kind: 'drive' | 'quiz' | 'post_exam' | 'final';
  verdicts: { competency: string; total: number; correct: number; passed: boolean }[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  tableAfter?: QTable;
  timestamp: number;
}

export interface AuditUser {
  uid: string;
  courseLogs: AuditCourseLog[];
  attempts: { levelId: number; logs: ActionLog[] }[];
  sittings: { kind: 'quiz' | 'diagnostic' | 'post_exam'; levelId: number | null; attempt: number | null; answers: ActionLog[] }[];
  bktUpdates: BKTUpdateRecord[];
  bktProfile: BKTProfileDoc | null;
}

export interface AuditInput {
  table: QTable | null;
  tableUpdates: number | null;
  qUpdates: QLogEntry[];
  users: AuditUser[];
  configVersion: string;
}

export interface AuditReport {
  problems: string[];
  /** One line per part checked, for the console. */
  summary: string[];
  /** The table the log replays to: what the shared table should be. */
  rebuiltTable: QTable;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;
const decisionIdOf = (d: DecisionRecord) => `${d.levelId}:${d.competency}:${d.seq}`;

/** The participant's graded answers in the order BKT reads them, as the app's recorder tags them. */
export const taggedEvidence = (user: Pick<AuditUser, 'attempts' | 'sittings'>): { logs: ActionLog[]; origins: EvidenceOrigin[] } => {
  const tagged = [
    ...user.attempts
      .filter(attempt => attempt.levelId !== TUTORIAL_LEVEL_ID)
      .flatMap(attempt => attempt.logs.map(log => ({ log, origin: { kind: 'attempt' as const, levelId: attempt.levelId, ref: null, attempt: null } }))),
    ...user.sittings.flatMap(sitting =>
      sitting.answers.map(log => ({ log, origin: { kind: sitting.kind, levelId: sitting.levelId, ref: null, attempt: sitting.attempt } }))
    ),
  ];
  tagged.sort((a, b) => a.log.timestamp - b.log.timestamp);
  return { logs: tagged.map(t => t.log), origins: tagged.map(t => t.origin) };
};

const auditQTable = (input: AuditInput, problems: string[], summary: string[]): QTable => {
  const replay = replayQLog(input.qUpdates);
  problems.push(...replay.problems.slice(0, 20));
  if (replay.problems.length > 20) problems.push(`... and ${replay.problems.length - 20} more Q-log problems`);
  if (input.table && !sameTable(input.table, replay.table)) problems.push('policy/competencyQ: the stored table differs from the replay of its log');
  if (input.tableUpdates !== null && input.tableUpdates !== input.qUpdates.length) {
    problems.push(`policy/competencyQ counts ${input.tableUpdates} updates; the log has ${input.qUpdates.length}`);
  }
  summary.push(`Q-table log: ${input.qUpdates.length} entries replayed, ${replay.problems.length} problem(s)`);
  return replay.table;
};

const auditCourse = (user: AuditUser, qUpdates: readonly QLogEntry[], problems: string[]): number => {
  const mine = qUpdates.filter(entry => entry.uid === user.uid);
  const visits = new Map(mine.filter(e => e.kind === 'visit').map(e => [e.decisionId, e]));
  const learns = new Map(mine.filter(e => e.kind === 'learn').map(e => [e.decisionId, e]));
  const explained = new Set<QLogEntry>();
  const before = problems.length;

  for (const log of user.courseLogs) {
    const at = `${user.uid} courseLog ${log.id}`;
    let lastSeq = 0;
    for (const decision of log.decisions) {
      if (decision.source === 'cap') continue;
      const id = decisionIdOf(decision);
      const visit = visits.get(id);
      if (!visit) problems.push(`${at}: decision ${id} has no visit in the Q-table log`);
      else if (visit.action !== decision.action) problems.push(`${at}: decision ${id} chose ${decision.action}; the Q-table log has ${visit.action}`);
      else {
        explained.add(visit);
        lastSeq = Math.max(lastSeq, visit.globalSeq);
      }
    }
    for (const reward of log.rewards) {
      const learn = learns.get(reward.decisionId);
      if (!learn?.learning) problems.push(`${at}: reward for ${reward.decisionId} has no learn entry in the Q-table log`);
      else if (!near(learn.learning.reward, reward.reward)) problems.push(`${at}: reward for ${reward.decisionId} is ${reward.reward}; the Q-table log has ${learn.learning.reward}`);
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
    // The entry's table snapshot is the table right after its own last change.
    if (log.tableAfter && lastSeq > 0) {
      const entry = qUpdates.find(e => e.globalSeq === lastSeq);
      if (entry && !sameTable(entry.tableAfter, log.tableAfter)) problems.push(`${at}: tableAfter differs from the table after globalSeq ${lastSeq}`);
    }
  }
  for (const entry of mine) {
    if (!explained.has(entry)) problems.push(`${user.uid}: Q-table change globalSeq ${entry.globalSeq} (${entry.kind} ${entry.decisionId}) is in no course log entry`);
  }
  return problems.length - before;
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
  const rebuiltTable = auditQTable(input, problems, summary);

  const known = new Set(input.users.map(u => u.uid));
  const strangers = new Set(input.qUpdates.map(e => e.uid).filter(uid => !known.has(uid)));
  for (const uid of strangers) problems.push(`Q-table log has changes by ${uid}, who has no user record`);

  let course = 0;
  let bkt = 0;
  for (const user of input.users) {
    course += auditCourse(user, input.qUpdates, problems);
    bkt += auditBKT(user, input.configVersion, problems);
  }
  summary.push(`Course logs of ${input.users.length} participant(s) against the Q-table log: ${course} problem(s)`);
  summary.push(`BKT rebuilt from raw answers for ${input.users.length} participant(s): ${bkt} problem(s)`);
  return { problems, summary, rebuiltTable };
};
