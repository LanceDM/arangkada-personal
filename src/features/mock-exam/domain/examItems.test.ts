import { describe, expect, it } from 'vitest';
import { RESERVED_FOR_POST_EXAM } from '@/domain/assessment/questionBank';
import { createRng } from '@/shared/lib/rng';
import { BUNDLED_EXAM_POOL, drawExam, EXAM_SIZE, lawPartOf, type ExamQuestion } from './examItems';
import { getWeakAreas, passingScoreFor, scoreExam, wrongQuestionIds } from './grading';

describe('the mock exam items', () => {
  it('come from the question bank, never a test item', () => {
    expect(BUNDLED_EXAM_POOL.length).toBeGreaterThan(EXAM_SIZE);
    expect(BUNDLED_EXAM_POOL.some(item => RESERVED_FOR_POST_EXAM.has(item.id))).toBe(false);
  });

  it('show only the law part of a source', () => {
    expect(lawPartOf("RA 4136, Sec. 42(a); ref. Driver's Manual Vol. 1 (2021), p. 114")).toBe('RA 4136, Sec. 42(a)');
    expect(lawPartOf("Ref. Driver's Manual Vol. 1 (2021), p. 145")).toBe('');
  });

  it('draw 40 distinct items spread over every level, 3 or 4 each', () => {
    const drawn = drawExam(BUNDLED_EXAM_POOL, createRng(7));
    expect(drawn).toHaveLength(EXAM_SIZE);
    expect(new Set(drawn.map(q => q.id)).size).toBe(EXAM_SIZE);
    const perLevel = new Map<number, number>();
    for (const q of drawn) perLevel.set(q.level, (perLevel.get(q.level) ?? 0) + 1);
    expect([...perLevel.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const n of perLevel.values()) expect(n === 3 || n === 4).toBe(true);
  });

  it('take what a short level has and fill from the others', () => {
    const pool: ExamQuestion[] = [
      ...Array.from({ length: 2 }, (_, i) => ({ id: `A${i}`, question: '', choices: [], correctIndex: 0, level: 1, lawCitation: '' })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: `B${i}`, question: '', choices: [], correctIndex: 0, level: 2, lawCitation: '' })),
    ];
    const drawn = drawExam(pool, createRng(1), 6);
    expect(drawn.filter(q => q.level === 1)).toHaveLength(2);
    expect(drawn).toHaveLength(6);
  });
});

describe('the mock exam grading', () => {
  const q = (id: string, level: number): ExamQuestion => ({ id, question: '', choices: ['a', 'b'], correctIndex: 0, level, lawCitation: '' });
  const questions = [q('x1', 5), q('x2', 5), q('x3', 2), q('x4', 2)];
  const answers = [0, 1, 1, null];

  it('scores, lists the wrong items and sets the 75% bar', () => {
    expect(scoreExam(questions, answers)).toBe(1);
    expect(wrongQuestionIds(questions, answers)).toEqual(['x2', 'x3', 'x4']);
    expect(passingScoreFor(40)).toBe(30);
  });

  it('names the weak levels from this sitting, worst share first', () => {
    expect(getWeakAreas(questions, answers)).toEqual([
      { level: 2, label: 'Vehicle readiness', wrong: 2, total: 2 },
      { level: 5, label: 'Intersections and right of way', wrong: 1, total: 2 },
    ]);
  });
});
