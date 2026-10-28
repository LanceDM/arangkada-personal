import { beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import { provideDrivingSimDependencies } from '../dependencies';
import { memoryAssessments, memoryCompetencyCourse, memoryCourseStore, type MemoryCourseStore } from '../testDependencies';
import {
  completeCourseDrive,
  completePostExam,
  diagnosticItems,
  drawCourseQuiz,
  loadCompetencyCourse,
  markCourseLessonsRead,
  planCourseDrive,
  postExamItems,
  saveDiagnostic,
  submitCourseQuiz,
  type CourseDriveRun,
} from './competencyCourse';
import type { CourseCursor } from '@/domain/competencyRouting/course';

const UID = 'participant-1';
let store: MemoryCourseStore;
let attempts: LevelAttempt[];

beforeEach(() => {
  store = memoryCourseStore();
  attempts = [];
  provideDrivingSimDependencies({
    learnerHistory: { load: async () => ({ source: 'firestore', attempts: attempts.map(a => ({ levelId: a.levelId, timestamp: a.timestamp, logs: a.logs })) }) },
    storyAttempts: {
      save: async (_uid, attempt) => {
        attempts.push(attempt);
        return `attempt-${attempts.length}`;
      },
      saveFsmTelemetry: async () => {},
      saveDecisionTelemetry: async () => {},
      saveRoutingTelemetry: async () => {},
    },
    signCoverage: { load: () => ({}), record: () => {} },
    briefingProgress: { load: () => ({}), save: () => {}, markLessonsRead: () => {} },
    routingMode: 'new',
    routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
    routingOverride: { load: () => 'assigned', save: () => {} },
    optimizedRouting: async () => {
      throw new Error('the competency course reads no designated table');
    },
    competencyCourse: memoryCompetencyCourse(store),
    assessments: memoryAssessments(store),
  });
});

/** A drive's result where every counted scenario of `failing` is answered wrong and every other right. */
const resultFor = (run: CourseDriveRun, failing: readonly string[] = []): LevelResult => {
  const logs: ActionLog[] = (run.composed?.items ?? []).map((item, i) => ({
    timestamp: 1_000 + attempts.length * 100 + i,
    action: 'x',
    result: failing.includes(item.competency) ? 'violation' : 'correct',
    points: 0,
    competency: item.competency,
    scenarioId: item.scenarioId,
  }));
  return { levelId: run.levelId, score: 100, stars: 1, completed: true, violations: 0, correctActions: logs.length, logs };
};

const answerAll = (items: { answer: number }[], right: boolean) => items.map(item => (right ? item.answer : (item.answer + 1) % 4));

describe('the per-competency course, end to end', () => {
  it('runs diagnostic -> tutorial -> L1 quiz -> drive -> per-competency decisions', async () => {
    let state = await loadCompetencyCourse(UID);
    expect(state.diagnosticDone).toBe(false);

    const diagnostic = diagnosticItems();
    expect(diagnostic).toHaveLength(55);
    await saveDiagnostic(UID, diagnostic, answerAll(diagnostic, true));
    state = await loadCompetencyCourse(UID);
    expect(state.diagnosticDone).toBe(true);

    // Tutorial.
    let cursor: CourseCursor = await markCourseLessonsRead(UID, state.cursor);
    let run = await planCourseDrive(UID, cursor, 1);
    expect(run.levelId).toBe(0);
    cursor = (await completeCourseDrive({ uid: UID, cursor, run, result: resultFor(run) })).cursor;
    expect(cursor.phase).toEqual({ kind: 'MODULE', level: 1 });

    // Level 1: module, quiz (6 items, 3 per competency), drive.
    cursor = await markCourseLessonsRead(UID, cursor);
    const quiz = drawCourseQuiz(cursor, 7);
    expect(quiz.items).toHaveLength(6);
    const quizDone = await submitCourseQuiz(UID, cursor, quiz.items, answerAll(quiz.items, true));
    cursor = quizDone.cursor;
    expect(quizDone.results.every(r => r.passed)).toBe(true);
    expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 1 });

    run = await planCourseDrive(UID, cursor, 2);
    expect(run.composed!.items).toHaveLength(6);
    const settled = await completeCourseDrive({ uid: UID, cursor, run, result: resultFor(run, ['document_awareness']) });
    expect(settled.verdicts.find(v => v.competency === 'document_awareness')!.passed).toBe(false);
    expect(settled.verdicts.find(v => v.competency === 'driver_legality')!.passed).toBe(true);
    expect(store.logs.at(-1)!.decisions).toHaveLength(2);
    expect(Object.values(store.table).some(state => Object.keys(state).length > 0)).toBe(true);
    cursor = settled.cursor;
    expect(cursor.phase.kind === 'REPEAT' || cursor.phase.kind === 'MODULE').toBe(true);
    if (cursor.phase.kind === 'REPEAT') {
      // The repeat drive has only the competencies still to finish, with new variants.
      const repeat = await planCourseDrive(UID, cursor, 3);
      const first = new Set(run.composed!.items.map(item => item.scenarioId));
      expect(repeat.composed!.items.every(item => item.competency !== 'driver_legality' || !cursor.stage.driver_legality?.done)).toBe(true);
      // Unseen variants first: Level 1's document pool has 4, so one is new
      // and the other two are the least recently seen.
      expect(repeat.composed!.items.some(item => !first.has(item.scenarioId))).toBe(true);
    }
  });

  it('rewards pending decisions on the post-exam', async () => {
    let cursor: CourseCursor = (await loadCompetencyCourse(UID)).cursor;
    cursor = await markCourseLessonsRead(UID, cursor);
    let run = await planCourseDrive(UID, cursor, 1);
    cursor = (await completeCourseDrive({ uid: UID, cursor, run, result: resultFor(run) })).cursor;
    cursor = await markCourseLessonsRead(UID, cursor);
    const quiz = drawCourseQuiz(cursor, 7);
    cursor = (await submitCourseQuiz(UID, cursor, quiz.items, answerAll(quiz.items, true))).cursor;
    run = await planCourseDrive(UID, cursor, 2);
    cursor = (await completeCourseDrive({ uid: UID, cursor, run, result: resultFor(run) })).cursor;
    expect(cursor.pending.length).toBeGreaterThan(0);

    const exam = postExamItems();
    expect(exam).toHaveLength(60);
    const done = await completePostExam(UID, cursor, exam, answerAll(exam, true));
    expect(done.cursor.pending).toHaveLength(0);
    expect(done.correct).toBe(60);
    expect(store.logs.at(-1)!.kind).toBe('post_exam');
  });

  it('composes the final exam with one scenario per competency on one scale', async () => {
    const cursor: CourseCursor = { ...(await loadCompetencyCourse(UID)).cursor, phase: { kind: 'FINAL' } };
    const run = await planCourseDrive(UID, cursor, 5);
    expect(run.composed!.items).toHaveLength(11);
    expect(run.plan.level!.events.every(event => event.points === 25)).toBe(true);
  });
});
