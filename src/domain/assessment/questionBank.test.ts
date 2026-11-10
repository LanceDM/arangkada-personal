import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES, QUIZ_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { DIAGNOSTIC_ITEMS, POST_EXAM_ITEMS, QUESTION_BANK, RESERVED_FOR_POST_EXAM, itemsFor } from './questionBank';
import { drawQuiz } from './drawQuiz';
import { difficultyFromProportion, kr20, raschEAP, raschProbability } from './rasch';

describe('the question bank', () => {
  it('holds the 355 items, each with four choices and one of the 11 competencies', () => {
    expect(QUESTION_BANK).toHaveLength(355);
    for (const item of QUESTION_BANK) {
      expect(item.choices).toHaveLength(4);
      expect(COMPETENCIES).toContain(item.competency);
      expect(item.answer).toBeGreaterThanOrEqual(0);
      expect(item.answer).toBeLessThan(4);
    }
  });

  it('makes a 55-item diagnostic, 5 per competency, and a separate 60-item post-exam', () => {
    for (const competency of COMPETENCIES) {
      expect(DIAGNOSTIC_ITEMS[competency]).toHaveLength(5);
      expect(itemsFor(DIAGNOSTIC_ITEMS[competency]).every(item => item.competency === competency)).toBe(true);
      expect(itemsFor(POST_EXAM_ITEMS[competency]).every(item => item.competency === competency)).toBe(true);
      for (const id of DIAGNOSTIC_ITEMS[competency]) expect(RESERVED_FOR_POST_EXAM.has(id)).toBe(false);
    }
    expect(Object.values(POST_EXAM_ITEMS).flat()).toHaveLength(60);
  });
});

describe('a short quiz', () => {
  it('draws 3 items per competency for every stage, none of them post-exam items', () => {
    for (const stage of COMPETENCY_STAGES) {
      const { items } = drawQuiz(stage, STAGE_COMPETENCIES[stage], new Map(), createRng(stage));
      expect(items).toHaveLength(QUIZ_ITEMS_PER_COMPETENCY * STAGE_COMPETENCIES[stage].length);
      for (const item of items) {
        expect(RESERVED_FOR_POST_EXAM.has(item.id)).toBe(false);
        expect(item.stage).toBeLessThanOrEqual(stage);
      }
    }
  });

  it('draws new items on a retake while the pool has them', () => {
    const first = drawQuiz(5, ['right_of_way'], new Map(), createRng(1));
    const seen = new Map(first.items.map((item, i) => [item.id, i]));
    const retake = drawQuiz(5, ['right_of_way'], seen, createRng(2));
    expect(retake.items.some(item => seen.has(item.id))).toBe(false);
  });
});

describe('Rasch scoring', () => {
  it('is the logistic of theta - b', () => {
    expect(raschProbability(0, 0)).toBe(0.5);
    expect(raschProbability(1, 0)).toBeCloseTo(1 / (1 + Math.exp(-1)), 10);
  });

  it('ranks by number correct when everyone takes the same items', () => {
    const items = [-1, 0, 0.5, 1];
    const theta = (pattern: boolean[]) => raschEAP(items.map((b, i) => ({ b, correct: pattern[i] }))).theta;
    expect(theta([true, true, false, false])).toBeLessThan(theta([true, true, true, false]));
    expect(Number.isFinite(theta([true, true, true, true]))).toBe(true);
  });

  it('estimates difficulty from the proportion correct', () => {
    expect(difficultyFromProportion(5, 10)).toBeCloseTo(0, 10);
    expect(difficultyFromProportion(8, 10)).toBeLessThan(0);
  });

  it('computes KR-20', () => {
    const m = [
      [true, true, true],
      [true, true, false],
      [true, false, false],
      [false, false, false],
    ];
    expect(kr20(m)).toBeCloseTo(0.75, 5);
  });
});
