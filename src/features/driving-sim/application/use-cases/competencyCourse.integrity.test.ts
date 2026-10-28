/**
 * What could corrupt the algorithm's data without anyone tampering, and how
 * each is kept out:
 *
 * 1. a failed save followed by a retry saves the answers once;
 * 2. the diagnostic is saved once;
 * 3. a reload gives the same quiz and the same drive;
 * 4. a tab older than the settings or the build in force writes nothing;
 * 5. two tabs bringing BKT up to date at once write each entry once;
 * 6. a device clock that jumps back does not reorder BKT's evidence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { orderEvidence } from '@/domain/study/evidence';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '../testDependencies';
import { CourseConflictError, OutdatedAppError } from '../errors';
import { recordBKT } from '../studyRecorder';
import {
  completeCourseDrive,
  diagnosticItems,
  finishCourseQuizReview,
  loadCompetencyCourse,
  markCourseLessonsRead,
  openCourseQuiz,
  planCourseDrive,
  saveDiagnostic,
  submitCourseQuiz,
  type CourseDriveRun,
} from './competencyCourse';

const UID = 'participant-a';
let store: MemoryCourseStore;
let clock: number;

beforeEach(() => {
  // A second between steps, as with a person at the screen.
  clock = Date.UTC(2026, 9, 28, 9);
  vi.spyOn(Date, 'now').mockImplementation(() => (clock += 1_000));
  store = memoryCourseStore();
  provideInMemoryDrivingSim(store);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const resultFor = (run: CourseDriveRun): LevelResult => {
  const logs: ActionLog[] = (run.composed?.items ?? []).map((item, i) => ({
    timestamp: Date.now() + i,
    action: 'x',
    result: 'correct',
    points: 0,
    competency: item.competency,
    scenarioId: item.scenarioId,
  }));
  return { levelId: run.levelId, score: 100, stars: 1, completed: true, violations: 0, correctActions: logs.length, logs };
};

const toQuiz = async (): Promise<CourseCursor> => {
  const items = diagnosticItems();
  await saveDiagnostic(UID, items, items.map(item => item.answer));
  let cursor = (await loadCompetencyCourse(UID)).cursor;
  cursor = await markCourseLessonsRead(UID, cursor);
  const tutorial = await planCourseDrive(UID, cursor);
  cursor = (await completeCourseDrive({ uid: UID, cursor, run: tutorial, result: resultFor(tutorial) })).cursor;
  return markCourseLessonsRead(UID, cursor);
};

describe('a failed save, then a retry', () => {
  it('saves the quiz answers once: nothing of a failed step is written', async () => {
    const cursor = await toQuiz();
    const quiz = await openCourseQuiz(UID, cursor);
    const before = store.sittings.get(UID)!.length;

    // The connection drops as the step commits.
    store.beforeCommit = async () => {
      store.beforeCommit = undefined;
      throw new Error('network lost');
    };
    await expect(submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer))).rejects.toThrow('network lost');
    expect(store.sittings.get(UID)).toHaveLength(before);

    // The participant tries again: saved once, with the course moved on.
    const done = await submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer));
    expect(store.sittings.get(UID)).toHaveLength(before + 1);
    expect(done.cursor.phase.kind).toBe('DRIVE');
    const quizUpdates = store.bktUpdates.get(UID)!.filter(u => u.source === 'quiz');
    expect(quizUpdates).toHaveLength(quiz.items.length);
  });

  it('saves a drive once, with its decisions, after a failed save', async () => {
    let cursor = await toQuiz();
    const quiz = await openCourseQuiz(UID, cursor);
    cursor = (await submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
    const run = await planCourseDrive(UID, cursor);
    const result = resultFor(run);
    const drives = store.attempts.get(UID)!.length;

    store.beforeCommit = async () => {
      store.beforeCommit = undefined;
      throw new Error('network lost');
    };
    await expect(completeCourseDrive({ uid: UID, cursor, run, result })).rejects.toThrow('network lost');
    expect(store.attempts.get(UID)).toHaveLength(drives);
    expect(store.qUpdates).toHaveLength(0);

    await completeCourseDrive({ uid: UID, cursor, run, result });
    expect(store.attempts.get(UID)).toHaveLength(drives + 1);
    await expect(completeCourseDrive({ uid: UID, cursor, run, result })).rejects.toBeInstanceOf(CourseConflictError);
    expect(store.attempts.get(UID)).toHaveLength(drives + 1);
  });
});

describe('the diagnostic', () => {
  it('is saved once, whatever the number of submits', async () => {
    const items = diagnosticItems();
    expect(await saveDiagnostic(UID, items, items.map(item => item.answer))).toBe('saved');
    expect(await saveDiagnostic(UID, items, items.map(() => 0))).toBe('exists');
    const sittings = store.sittings.get(UID)!;
    expect(sittings.filter(s => s.kind === 'diagnostic')).toHaveLength(1);
    expect(sittings[0].id).toBe('diagnostic');
    expect(store.bktUpdates.get(UID)).toHaveLength(items.length);
  });
});

describe('a reload', () => {
  it('gives the same quiz until it is submitted, and logs the reopen', async () => {
    const cursor = await toQuiz();
    const first = await openCourseQuiz(UID, cursor);
    const again = await openCourseQuiz(UID, cursor);
    expect(again.items.map(item => item.id)).toEqual(first.items.map(item => item.id));
    expect(store.active.get(UID)!.opens).toBe(2);
    expect(store.events.get(UID)!.some(e => e.type === 'activity_reopened')).toBe(true);
  });

  it('gives a new quiz for the next attempt', async () => {
    const cursor = await toQuiz();
    const first = await openCourseQuiz(UID, cursor);
    expect(store.active.get(UID)!.opens).toBe(1);
    const failed = await submitCourseQuiz(UID, cursor, first.items, first.items.map(item => (item.answer + 1) % 4));
    const second = failed.cursor.phase.kind === 'QUIZ_REVIEW' ? await finishCourseQuizReview(UID, failed.cursor) : failed.cursor;
    expect(second.phase.kind).toBe('QUIZ');
    expect(second.quiz!.attempt).toBe(2);
    // A new position: a new quiz, opened once.
    const position = store.active.get(UID)!.position;
    await openCourseQuiz(UID, second);
    expect(store.active.get(UID)!.opens).toBe(1);
    expect(store.active.get(UID)!.position).not.toBe(position);
  });

  it('plans the same drive again', async () => {
    let cursor = await toQuiz();
    const quiz = await openCourseQuiz(UID, cursor);
    cursor = (await submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
    const first = await planCourseDrive(UID, cursor);
    const again = await planCourseDrive(UID, cursor);
    expect(again.attemptSeed).toBe(first.attemptSeed);
    expect(again.composed!.items.map(i => i.scenarioId)).toEqual(first.composed!.items.map(i => i.scenarioId));
  });
});

describe('a tab older than the version in force', () => {
  it('writes nothing when the settings version changed', async () => {
    const cursor = await toQuiz();
    const quiz = await openCourseQuiz(UID, cursor);
    const sittings = store.sittings.get(UID)!.length;
    store.configTag = 'a-newer-version';
    await expect(submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer))).rejects.toBeInstanceOf(OutdatedAppError);
    expect(store.sittings.get(UID)).toHaveLength(sittings);
    expect(store.cursors.get(UID)).toEqual(cursor);
  });

  it('writes nothing when the site serves a newer build', async () => {
    provideInMemoryDrivingSim(store, { appBuild: 'old1234', latestBuild: async () => 'new5678' });
    const items = diagnosticItems();
    await expect(saveDiagnostic(UID, items, items.map(item => item.answer))).rejects.toBeInstanceOf(OutdatedAppError);
    expect(store.sittings.get(UID)).toBeUndefined();

    // The same build, or a version file that cannot be read: carries on.
    provideInMemoryDrivingSim(store, { appBuild: 'new5678', latestBuild: async () => null });
    expect(await saveDiagnostic(UID, items, items.map(item => item.answer))).toBe('saved');
  });
});

describe('two tabs bringing BKT up to date at once', () => {
  it('write each entry once, under its fixed id', async () => {
    await toQuiz();
    await Promise.all([recordBKT(UID), recordBKT(UID), recordBKT(UID)]);
    const updates = store.bktUpdates.get(UID)!;
    expect(new Set(updates.map(u => u.eventId)).size).toBe(updates.length);
    expect(updates.map(u => u.userSeq)).toEqual(updates.map((_, i) => i + 1));
    expect(store.bktProfiles.get(UID)!.updates).toBe(updates.length);
  });
});

describe('a device clock that jumps back', () => {
  it('leaves BKT reading the answers in the order they were saved', async () => {
    const items = diagnosticItems();
    await saveDiagnostic(UID, items, items.map(item => item.answer));
    let cursor = (await loadCompetencyCourse(UID)).cursor;
    cursor = await markCourseLessonsRead(UID, cursor);
    const tutorial = await planCourseDrive(UID, cursor);
    cursor = (await completeCourseDrive({ uid: UID, cursor, run: tutorial, result: resultFor(tutorial) })).cursor;
    cursor = await markCourseLessonsRead(UID, cursor);

    // The clock is set back a day before the quiz.
    clock -= 24 * 3600 * 1000;
    const quiz = await openCourseQuiz(UID, cursor);
    await submitCourseQuiz(UID, cursor, quiz.items, quiz.items.map(item => item.answer));

    const updates = store.bktUpdates.get(UID)!;
    expect(updates.slice(0, items.length).every(u => u.source === 'diagnostic')).toBe(true);
    expect(updates.slice(items.length).every(u => u.source === 'quiz')).toBe(true);
    // By device time alone, the quiz would have come first.
    expect(updates.at(-1)!.answeredAt).toBeLessThan(updates[0].answeredAt);
  });

  it('orders numbered records by number and keeps older unnumbered ones first', () => {
    const log = (timestamp: number, competency: string): ActionLog =>
      ({ timestamp, action: 'x', result: 'correct', points: 0, competency }) as ActionLog;
    const { logs } = orderEvidence([
      { kind: 'quiz', levelId: 1, attempt: 1, evidenceSeq: 2, timestamp: 10, logs: [log(10, 'b')] },
      { kind: 'diagnostic', levelId: null, attempt: null, evidenceSeq: 1, timestamp: 500, logs: [log(500, 'a')] },
      { kind: 'attempt', levelId: 1, attempt: null, timestamp: 900, logs: [log(900, 'legacy')] },
      { kind: 'attempt', levelId: 0, attempt: null, evidenceSeq: 3, timestamp: 1, logs: [log(1, 'tutorial')] },
    ]);
    expect(logs.map(l => l.competency)).toEqual(['legacy', 'a', 'b']);
  });
});
