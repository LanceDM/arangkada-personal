/**
 * The study's pre-test and post-test as the course reads them (2026-11-10):
 * the pre-test is the initial exam and its answers seed each competency's
 * BKT; the post-test is the course's last measurement. Neither record keeps
 * an item id, so a participant never reads back which items they missed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '../testDependencies';
import { bankItemsFrom, drawCourseQuiz, loadCompetencyCourse, loadCompetencyCourseProgress, loadInitialExamStatus, loadEvidence, recordStudyTest } from './competencyCourse';
import { fixtureQuizItem } from '@/features/driving-sim/domain/scenario/quizBank.fixture';
import { lessonsRead } from '@/domain/competencyRouting/course';
import { scenarioFingerprint, textsOf } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import { buildBKTProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { COMPETENCIES } from '@/domain/learner/profile';
import { startingCourse } from '@/domain/competencyRouting/course';

const UID = 'participant-1';
let store: MemoryCourseStore;
let tests: { pre: 'none' | 'open' | 'finished'; post: 'none' | 'open' | 'finished' };

const responses = (correct: (i: number) => boolean) =>
  Array.from({ length: 60 }, (_, i) => ({ competency: COMPETENCIES[i % COMPETENCIES.length], correct: correct(i), chosen: 0, timeMs: 4000 }));

beforeEach(() => {
  store = memoryCourseStore();
  tests = { pre: 'none', post: 'none' };
  provideInMemoryDrivingSim(store, { studyTests: { load: async () => tests } });
});

describe('the study tests in the course', () => {
  it('opens the course on the pre-test status, not on a diagnostic of its own', async () => {
    expect((await loadCompetencyCourse(UID)).diagnosticDone).toBe(false);
    expect((await loadInitialExamStatus(UID)).done).toBe(false);
    tests = { pre: 'finished', post: 'none' };
    expect((await loadCompetencyCourse(UID)).diagnosticDone).toBe(true);
    expect((await loadInitialExamStatus(UID)).done).toBe(true);
  });

  it('seeds BKT from the pre-test, without item ids, once', async () => {
    const before = buildBKTProfile(await loadEvidence(UID));
    await recordStudyTest(UID, { kind: 'pre', finishedAt: 5000, responses: responses(() => true) });
    await recordStudyTest(UID, { kind: 'pre', finishedAt: 6000, responses: responses(() => false) });
    const sittings = store.sittings.get(UID)!;
    expect(sittings).toHaveLength(1);
    expect(sittings[0].kind).toBe('diagnostic');
    expect(sittings[0].answers).toHaveLength(60);
    expect(sittings[0].answers.every(answer => answer.itemId === undefined)).toBe(true);
    const after = buildBKTProfile(await loadEvidence(UID));
    for (const competency of COMPETENCIES) expect(after[competency]).toBeGreaterThan(before[competency]);
  });

  it('rewards nothing for a post-test sat before the course ends, and closes the course after it', async () => {
    await recordStudyTest(UID, { kind: 'post', finishedAt: 7000, responses: responses(() => true).slice(0, 30) });
    expect((store.sittings.get(UID) ?? []).some(s => s.kind === 'post_exam')).toBe(false);
    store.cursors.set(UID, { ...startingCourse(), phase: { kind: 'CERTIFIED' } });
    await recordStudyTest(UID, { kind: 'post', finishedAt: 8000, responses: responses(i => i % 2 === 0).slice(0, 30) });
    const post = store.sittings.get(UID)!.filter(s => s.kind === 'post_exam');
    expect(post).toHaveLength(1);
    expect(post[0].answers).toHaveLength(30);
    expect(post[0].answers.every(answer => answer.itemId === undefined)).toBe(true);
  });

  it('tells the study where the course is', async () => {
    expect(await loadCompetencyCourseProgress(UID)).toEqual({ started: false, frontierLevel: 0, endReason: null });
    store.cursors.set(UID, { ...startingCourse(), phase: { kind: 'MODULE', level: 4 }, seq: 9 });
    expect(await loadCompetencyCourseProgress(UID)).toEqual({ started: true, frontierLevel: 4, endReason: null });
    store.cursors.set(UID, { ...startingCourse(), phase: { kind: 'FINAL' }, seq: 40 });
    expect((await loadCompetencyCourseProgress(UID)).frontierLevel).toBe(12);
    store.cursors.set(UID, { ...startingCourse(), phase: { kind: 'CERTIFIED' }, seq: 41 });
    expect(await loadCompetencyCourseProgress(UID)).toEqual({ started: true, frontierLevel: null, endReason: 'certified' });
  });

  it('draws the short quiz from the admin bank: its quiz items, by competency and stage, in the player language', () => {
    const withFil = (n: number) => {
      const item = fixtureQuizItem('lto_level_1', n, { id: `L1-DL-0${n}`, competency: 'driver_legality' });
      const sourceText = scenarioFingerprint(textsOf(item, ['question', 'options.*', 'explanation']));
      return { ...item, fil: { question: 'Tanong', options: ['Tama', 'Mali a', 'Mali b', 'Mali c'], explanation: 'Paliwanag', status: 'reviewed' as const, sourceText } };
    };
    const bank = [
      ...[1, 2, 3, 4].map(withFil),
      ...[1, 2, 3].map(n => fixtureQuizItem('lto_level_1', n, { id: `L1-DA-0${n}`, competency: 'document_awareness' })),
      fixtureQuizItem('lto_level_1', 9, { id: 'L1-DA-09', competency: 'document_awareness', use: 'test' }),
      fixtureQuizItem('lto_level_1', 8, { id: 'L1-DA-08', competency: 'document_awareness', isActive: false }),
      fixtureQuizItem('lto_level_5', 1, { id: 'L5-RW-01', competency: 'right_of_way' }),
    ];
    const pool = bankItemsFrom(bank, 'fil');
    expect(pool.map(item => item.id)).not.toContain('L1-DA-09');
    expect(pool.map(item => item.id)).not.toContain('L1-DA-08');
    expect(pool.find(item => item.id === 'L5-RW-01')!.stage).toBe(5);
    expect(pool.find(item => item.id === 'L1-DL-01')!.choices[0]).toBe('Tama');
    const cursor = lessonsRead({ ...startingCourse(), phase: { kind: 'MODULE', level: 1 } });
    const draw = drawCourseQuiz(cursor, 3, pool);
    expect(draw.items).toHaveLength(6);
    expect(draw.items.every(item => item.stage === 1)).toBe(true);
  });
});
