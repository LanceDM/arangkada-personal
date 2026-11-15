import { beforeEach, describe, expect, it } from 'vitest';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import type { QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { drivingSimDeps } from '../dependencies';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '../testDependencies';
import { drawPracticeQuiz, gradePracticeQuiz, submitPracticeQuiz } from './competencyCourse';

let store: MemoryCourseStore;
let saved: { uid: string; sitting: QuizSittingDoc }[];

beforeEach(() => {
  store = memoryCourseStore();
  saved = [];
  provideInMemoryDrivingSim(store);
  Object.assign(drivingSimDeps(), { quizSittings: { save: async (uid: string, sitting: QuizSittingDoc) => void saved.push({ uid, sitting }) } });
});

describe('the practice short quiz, outside the course', () => {
  it("draws 3 items for each of the stage's competencies, anew each time", async () => {
    const first = await drawPracticeQuiz(2, 'en', 11);
    const second = await drawPracticeQuiz(2, 'en', 12);
    expect(first.items).toHaveLength(STAGE_COMPETENCIES[2].length * 3);
    for (const competency of STAGE_COMPETENCIES[2]) {
      expect(first.items.filter(item => item.competency === competency)).toHaveLength(3);
    }
    expect(second.items.map(item => item.id)).not.toEqual(first.items.map(item => item.id));
  });

  it('has none on a stage without a short quiz', async () => {
    await expect(drawPracticeQuiz(0)).rejects.toThrow();
    await expect(drawPracticeQuiz(12)).rejects.toThrow();
  });

  it('grades 2 of 3 per competency, and is recorded but never evidence', async () => {
    const quiz = await drawPracticeQuiz(1, 'en', 5);
    const choices = quiz.items.map(item => item.answer);
    const results = await submitPracticeQuiz('u1', quiz, choices);
    expect(results.every(result => result.passed && result.correct === 3)).toBe(true);

    expect(saved).toHaveLength(1);
    expect(saved[0].sitting).toMatchObject({ practice: true, levelId: 1, passed: true, score: quiz.items.length });
    // Nothing the models read: no sitting, no attempt, no BKT entry, no Q update, no cursor.
    expect(store.sittings.size).toBe(0);
    expect(store.attempts.size).toBe(0);
    expect(store.bktUpdates.size).toBe(0);
    expect(store.qUpdates).toHaveLength(0);
    expect(store.cursors.size).toBe(0);
  });

  it('fails a competency with 2 wrong, and saves nothing for a guest', async () => {
    const quiz = await drawPracticeQuiz(1, 'en', 6);
    const [competency] = STAGE_COMPETENCIES[1];
    let wrong = 0;
    const choices = quiz.items.map(item => (item.competency === competency && wrong++ < 2 ? (item.answer + 1) % item.choices.length : item.answer));
    expect(gradePracticeQuiz(quiz.items, choices).find(r => r.competency === competency)).toMatchObject({ correct: 1, passed: false });
    await submitPracticeQuiz(null, quiz, choices);
    expect(saved).toHaveLength(0);
  });
});
