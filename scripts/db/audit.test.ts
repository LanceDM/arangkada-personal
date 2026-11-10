/**
 * The audit over what the app actually writes: two participants play the
 * course at the same time on the in-memory stores, the audit finds nothing;
 * then single values are altered the way a tampered browser could, and the
 * audit finds each one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompetencyAction } from '@/domain/competencyRouting/qLearning';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import {
  completeCourseDrive,
  diagnosticItems,
  drawCourseQuiz,
  loadCompetencyCourse,
  markCourseLessonsRead,
  planCourseDrive,
  saveDiagnostic,
  submitCourseQuiz,
  type CourseDriveRun,
} from '@/features/driving-sim/application/use-cases/competencyCourse';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '@/features/driving-sim/application/testDependencies';
import { auditStudy, type AuditInput } from './auditCore';

let store: MemoryCourseStore;

const resultFor = (run: CourseDriveRun, failing: readonly string[] = []): LevelResult => {
  const logs: ActionLog[] = (run.composed?.items ?? []).map((item, i) => ({
    timestamp: Date.now() + i,
    action: 'x',
    result: failing.includes(item.competency) ? 'violation' : 'correct',
    points: 0,
    competency: item.competency,
    scenarioId: item.scenarioId,
  }));
  return { levelId: run.levelId, score: 100, stars: 1, completed: true, violations: 0, correctActions: logs.length, logs };
};

const toFirstDrive = async (uid: string): Promise<CourseCursor> => {
  const items = diagnosticItems();
  await saveDiagnostic(uid, items, items.map((item, i) => (i % 3 === 0 ? (item.answer + 1) % 4 : item.answer)));
  let cursor = (await loadCompetencyCourse(uid)).cursor;
  cursor = await markCourseLessonsRead(uid, cursor);
  const tutorial = await planCourseDrive(uid, cursor, 1);
  cursor = (await completeCourseDrive({ uid, cursor, run: tutorial, result: resultFor(tutorial) })).cursor;
  cursor = await markCourseLessonsRead(uid, cursor);
  const quiz = drawCourseQuiz(cursor, 7);
  return (await submitCourseQuiz(uid, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
};

const inputOf = (s: MemoryCourseStore): AuditInput => ({
  table: s.table,
  tableUpdates: s.qUpdates.length,
  qUpdates: s.qUpdates,
  users: ['participant-a', 'participant-b'].map(uid => ({
    uid,
    courseLogs: s.logs.filter(log => log.uid === uid).map((log, i) => ({ id: String(i), ...log })),
    attempts: s.attempts.get(uid) ?? [],
    sittings: s.sittings.get(uid) ?? [],
    bktUpdates: s.bktUpdates.get(uid) ?? [],
    bktProfile: s.bktProfiles.get(uid) ?? null,
  })),
  configVersion: RUN_CONFIG_VERSION,
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  // A second between steps, as with a person at the screen: each sitting's
  // answers (stamped 1 ms apart) end before the next step begins.
  let clock = Date.UTC(2026, 9, 28, 9);
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
  store = memoryCourseStore();
  provideInMemoryDrivingSim(store);
  const a = await toFirstDrive('participant-a');
  const b = await toFirstDrive('participant-b');
  const runA = await planCourseDrive('participant-a', a, 2);
  const runB = await planCourseDrive('participant-b', b, 3);
  let interleaved = false;
  store.beforeCommit = async uid => {
    if (uid !== 'participant-a' || interleaved) return;
    interleaved = true;
    await completeCourseDrive({ uid: 'participant-b', cursor: b, run: runB, result: resultFor(runB, ['document_awareness']) });
  };
  await completeCourseDrive({ uid: 'participant-a', cursor: a, run: runA, result: resultFor(runA, ['driver_legality']) });
  store.beforeCommit = undefined;
});

describe('db:audit', () => {
  it('finds nothing wrong in what two simultaneous participants wrote', () => {
    expect(store.retries).toBeGreaterThan(0);
    const report = auditStudy(inputOf(store));
    expect(report.problems).toEqual([]);
    expect(report.summary).toHaveLength(3);
  });

  it('finds a Q value changed without its log', () => {
    const input = inputOf(store);
    const table = structuredClone(input.table!);
    const key = Object.keys(table).find(k => Object.keys(table[k]).length > 0)!;
    const action = Object.keys(table[key])[0] as CompetencyAction;
    table[key][action]!.q += 1;
    input.table = table;
    expect(auditStudy(input).problems.join('\n')).toMatch(/stored table differs from the replay/);
  });

  it('finds a decision whose action differs from the table log', () => {
    const input = inputOf(store);
    const log = input.users[0].courseLogs.find(l => l.decisions.some(d => d.source !== 'cap'))!;
    const decision = log.decisions.find(d => d.source !== 'cap')!;
    decision.action = decision.legal.find(action => action !== decision.action)!;
    expect(auditStudy(input).problems.join('\n')).toMatch(/chose .*; the Q-table log has/);
  });

  it('finds a reward that does not follow from the verdict it was measured on', async () => {
    // Participant A's repeat drive measures the competency A failed: its pending decision is rewarded.
    let cursor = (await loadCompetencyCourse('participant-a')).cursor;
    expect(cursor.phase.kind).toBe('REPEAT');
    const repeat = await planCourseDrive('participant-a', cursor, 4);
    cursor = (await completeCourseDrive({ uid: 'participant-a', cursor, run: repeat, result: resultFor(repeat) })).cursor;
    const input = inputOf(store);
    expect(auditStudy(input).problems).toEqual([]);

    const log = input.users[0].courseLogs.find(l => l.rewards.length > 0)!;
    log.verdicts = log.verdicts.map(v => ({ ...v, correct: v.total - v.correct, passed: !v.passed }));
    const found = auditStudy(input).problems.join('\n');
    expect(found).toMatch(/reward accuracy .*; the verdict gives/);
    expect(found).toMatch(/reward says passed=/);
  });

  it('finds a table change that no course log explains', () => {
    const input = inputOf(store);
    input.users[0].courseLogs = [];
    expect(auditStudy(input).problems.join('\n')).toMatch(/is in no course log entry/);
  });

  it('finds a BKT value that does not follow from the raw answers', () => {
    const input = inputOf(store);
    input.users[0].bktUpdates = structuredClone(input.users[0].bktUpdates);
    input.users[0].bktUpdates[3].pAfter = 0.99;
    expect(auditStudy(input).problems.join('\n')).toMatch(/BKT update 4 differs from the raw answers in pAfter/);
  });

  it('finds a drive answer missing from the BKT log', () => {
    const input = inputOf(store);
    input.users[0].bktUpdates = input.users[0].bktUpdates.slice(0, -1);
    expect(auditStudy(input).problems.join('\n')).toMatch(/BKT updates logged; the raw answers give/);
  });
});
