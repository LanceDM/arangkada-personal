/** How a sitting is scored, and what a failed one points the learner at. */
import { levelTopic, type ExamQuestion } from './examItems';

export const EXAM_TIME_SECONDS = 15 * 60;
const PASS_RATIO = 0.75;

/** The bar for this sitting: 75%, so 30 of 40. */
export const passingScoreFor = (questionCount: number): number => Math.ceil(questionCount * PASS_RATIO);

export const scoreExam = (questions: readonly ExamQuestion[], answers: readonly (number | null)[]): number =>
  questions.reduce((total, q, i) => (answers[i] === q.correctIndex ? total + 1 : total), 0);

export const wrongQuestionIds = (questions: readonly ExamQuestion[], answers: readonly (number | null)[]): string[] =>
  questions.filter((q, i) => answers[i] !== q.correctIndex).map(q => q.id);

export interface WeakArea {
  /** The level that teaches the topic, for the "practice this" shortcut. */
  level: number;
  label: string;
  wrong: number;
  total: number;
}

/** The levels this sitting's wrong answers came from, worst first. */
export const getWeakAreas = (questions: readonly ExamQuestion[], answers: readonly (number | null)[]): WeakArea[] => {
  const counts = new Map<number, { wrong: number; total: number }>();
  questions.forEach((q, i) => {
    const row = counts.get(q.level) ?? { wrong: 0, total: 0 };
    row.total += 1;
    if (answers[i] !== q.correctIndex) row.wrong += 1;
    counts.set(q.level, row);
  });
  return [...counts.entries()]
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total || b[1].wrong - a[1].wrong || a[0] - b[0])
    .map(([level, v]) => ({ level, label: levelTopic(level), wrong: v.wrong, total: v.total }));
};
