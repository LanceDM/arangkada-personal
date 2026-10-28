/**
 * The shared Q-table under simultaneous participants, and the course under a
 * double submit or a second tab. The in-memory repository follows the same
 * contract as the Firestore transaction: compute on a snapshot, commit only
 * if the table has not moved, otherwise compute again.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import { replayQLog, sameTable } from '@/domain/study/qLog';
import type { CourseCursor } from '@/domain/competencyRouting/course';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '../testDependencies';
import { CourseConflictError } from '../errors';
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
} from './competencyCourse';

let store: MemoryCourseStore;

beforeEach(() => {
  store = memoryCourseStore();
  provideInMemoryDrivingSim(store);
});

const resultFor = (run: CourseDriveRun, failing: readonly string[] = []): LevelResult => {
  const logs: ActionLog[] = (run.composed?.items ?? []).map((item, i) => ({
    timestamp: 1_000 + i,
    action: 'x',
    result: failing.includes(item.competency) ? 'violation' : 'correct',
    points: 0,
    competency: item.competency,
    scenarioId: item.scenarioId,
  }));
  return { levelId: run.levelId, score: 100, stars: 1, completed: true, violations: 0, correctActions: logs.length, logs };
};

/** Diagnostic, tutorial, Level 1 module and quiz: the participant stands at the Level 1 drive. */
const toFirstDrive = async (uid: string): Promise<CourseCursor> => {
  const items = diagnosticItems();
  await saveDiagnostic(uid, items, items.map(item => item.answer));
  let cursor = (await loadCompetencyCourse(uid)).cursor;
  cursor = await markCourseLessonsRead(uid, cursor);
  const tutorial = await planCourseDrive(uid, cursor, 1);
  cursor = (await completeCourseDrive({ uid, cursor, run: tutorial, result: resultFor(tutorial) })).cursor;
  cursor = await markCourseLessonsRead(uid, cursor);
  const quiz = drawCourseQuiz(cursor, 7);
  cursor = (await submitCourseQuiz(uid, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
  expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 1 });
  return cursor;
};

describe('the shared Q-table under simultaneous participants', () => {
  it('recomputes a step when another participant changed the table first, and loses no update', async () => {
    const a = await toFirstDrive('participant-a');
    const b = await toFirstDrive('participant-b');
    const runA = await planCourseDrive('participant-a', a, 2);
    const runB = await planCourseDrive('participant-b', b, 3);

    // A computes its decisions; before A commits, B's whole drive lands.
    let interleaved = false;
    store.beforeCommit = async uid => {
      if (uid !== 'participant-a' || interleaved) return;
      interleaved = true;
      await completeCourseDrive({ uid: 'participant-b', cursor: b, run: runB, result: resultFor(runB, ['document_awareness']) });
    };
    await completeCourseDrive({ uid: 'participant-a', cursor: a, run: runA, result: resultFor(runA, ['driver_legality']) });

    expect(interleaved).toBe(true);
    expect(store.retries).toBeGreaterThan(0);

    // Both drives' decisions are on the record, numbered without a gap or a repeat.
    expect(store.qUpdates.map(u => u.globalSeq)).toEqual(store.qUpdates.map((_, i) => i + 1));
    const visits = store.qUpdates.filter(u => u.kind === 'visit');
    const decided = store.logs.flatMap(log => log.decisions).filter(d => d.source !== 'cap');
    expect(visits).toHaveLength(decided.length);
    expect(new Set(visits.map(v => v.uid))).toEqual(new Set(['participant-a', 'participant-b']));

    // B committed first, so A's decisions come after B's and were chosen from the table with B's in it.
    const lastB = Math.max(...visits.filter(v => v.uid === 'participant-b').map(v => v.globalSeq));
    const firstA = Math.min(...visits.filter(v => v.uid === 'participant-a').map(v => v.globalSeq));
    expect(firstA).toBeGreaterThan(lastB);

    // Replaying the log from an empty table checks every entry and gives exactly the stored table.
    const replay = replayQLog(store.qUpdates);
    expect(replay.problems).toEqual([]);
    expect(sameTable(replay.table, store.table)).toBe(true);

    // A's course log, written last, holds the table right after its own entries.
    expect(store.logs.at(-1)!.tableAfter).toEqual(store.table);
  });
});

describe('a step submitted twice, or from a stale tab', () => {
  it('refuses a drive already saved, without saving the attempt or its answers again', async () => {
    const cursor = await toFirstDrive('participant-a');
    const run = await planCourseDrive('participant-a', cursor, 2);
    await completeCourseDrive({ uid: 'participant-a', cursor, run, result: resultFor(run) });
    const updates = store.qUpdates.length;
    const bkt = store.bktUpdates.get('participant-a')!.length;
    const logs = store.logs.length;

    await expect(completeCourseDrive({ uid: 'participant-a', cursor, run, result: resultFor(run) })).rejects.toBeInstanceOf(CourseConflictError);
    expect(store.qUpdates).toHaveLength(updates);
    expect(store.bktUpdates.get('participant-a')).toHaveLength(bkt);
    expect(store.logs).toHaveLength(logs);
  });

  it('refuses a step from a tab whose cursor is behind, and reports where the course is', async () => {
    const start = (await loadCompetencyCourse('participant-a')).cursor;
    const items = diagnosticItems();
    await saveDiagnostic('participant-a', items, items.map(item => item.answer));
    const moved = await markCourseLessonsRead('participant-a', start);
    const failure = await markCourseLessonsRead('participant-a', start).catch(error => error);
    expect(failure).toBeInstanceOf(CourseConflictError);
    expect((failure as CourseConflictError).stored?.phase).toEqual(moved.phase);
  });

  it('refuses a quiz submitted twice without saving its answers twice', async () => {
    const items = diagnosticItems();
    await saveDiagnostic('participant-a', items, items.map(item => item.answer));
    let cursor = (await loadCompetencyCourse('participant-a')).cursor;
    cursor = await markCourseLessonsRead('participant-a', cursor);
    const tutorial = await planCourseDrive('participant-a', cursor, 1);
    cursor = (await completeCourseDrive({ uid: 'participant-a', cursor, run: tutorial, result: resultFor(tutorial) })).cursor;
    cursor = await markCourseLessonsRead('participant-a', cursor);
    const quiz = drawCourseQuiz(cursor, 7);
    await submitCourseQuiz('participant-a', cursor, quiz.items, quiz.items.map(item => item.answer));
    const sittings = store.sittings.get('participant-a')!.length;
    await expect(submitCourseQuiz('participant-a', cursor, quiz.items, quiz.items.map(item => item.answer))).rejects.toBeInstanceOf(CourseConflictError);
    expect(store.sittings.get('participant-a')).toHaveLength(sittings);
  });
});
