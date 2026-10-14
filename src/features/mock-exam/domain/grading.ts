/** How a sitting is scored, and what a failed one points the learner at. */
import {
  CATEGORY_LABELS,
  EXAM_QUESTIONS,
  type ExamCategory,
  type ExamQuestion,
} from './questionBank';

export const PASSING_SCORE = 30;
export const EXAM_TIME_SECONDS = 15 * 60;
const PASS_RATIO = 0.75;

/**
 * The bar for this sitting. The local bank has a fixed pass mark; a
 * Firestore-sourced bank of a different length keeps the same 75%.
 */
export const passingScoreFor = (questionCount: number): number =>
  questionCount === EXAM_QUESTIONS.length ? PASSING_SCORE : Math.ceil(questionCount * PASS_RATIO);

export const scoreExam = (questions: ExamQuestion[], answers: (number | null)[]): number =>
  questions.reduce((total, q, i) => (answers[i] === q.correctIndex ? total + 1 : total), 0);

export const wrongQuestionIds = (questions: ExamQuestion[], answers: (number | null)[]): number[] =>
  questions.filter((q, i) => answers[i] !== q.correctIndex).map(q => q.id);

export interface WeakArea {
  category: ExamCategory;
  label: string;
  wrong: number;
  total: number;
}

/** Categories the learner got wrong, worst first, counted over the whole bank. */
export const getWeakAreas = (wrongIds: number[]): WeakArea[] => {
  const counts: Record<string, { wrong: number; total: number }> = {};

  for (const question of EXAM_QUESTIONS) {
    counts[question.category] ??= { wrong: 0, total: 0 };
    counts[question.category].total += 1;
  }
  for (const id of wrongIds) {
    const question = EXAM_QUESTIONS.find(q => q.id === id);
    if (question) counts[question.category].wrong += 1;
  }

  return Object.entries(counts)
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .map(([category, v]) => ({
      category: category as ExamCategory,
      label: CATEGORY_LABELS[category as ExamCategory],
      wrong: v.wrong,
      total: v.total,
    }));
};

/** Which story level teaches a category, for the "practice this" shortcut. */
export const CATEGORY_TO_LEVEL: Partial<Record<ExamCategory, number>> = {
  traffic_signals: 1,
  right_of_way: 2,
  pedestrians: 2,
  speed_limits: 4,
  road_signs: 3,
  overtaking: 4,
  emergency: 3,
  general_rules: 5,
};
