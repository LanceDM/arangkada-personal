/**
 * Drawing a short quiz: 3 items per competency the stage teaches (or, on a
 * retake, per competency still failed), randomized by default.
 *
 * Each competency's items come from this stage's own items first, then from
 * earlier stages that taught the competency (a competency spread to this stage
 * is reviewed from where it was taught), never from a later stage, and never
 * a post-exam item. Unseen items first; when a competency runs out, the least
 * recently seen. The order of the whole quiz is shuffled.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import { QUIZ_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import { QUESTION_BANK, RESERVED_FOR_POST_EXAM, type BankItem } from './questionBank';

const shuffle = <T>(items: readonly T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export interface QuizDraw {
  items: BankItem[];
  /** Competencies the bank could not give a full 3 unseen items, with how many were reused. */
  reused: Partial<Record<DrivingCompetency, number>>;
}

export const quizPool = (stage: number, competency: DrivingCompetency): BankItem[] =>
  QUESTION_BANK.filter(
    item => item.competency === competency && item.stage <= stage && !RESERVED_FOR_POST_EXAM.has(item.id)
  );

export const drawQuiz = (
  stage: number,
  competencies: readonly DrivingCompetency[],
  seen: ReadonlyMap<string, number>,
  rng: () => number,
  perCompetency = QUIZ_ITEMS_PER_COMPETENCY
): QuizDraw => {
  const items: BankItem[] = [];
  const reused: QuizDraw['reused'] = {};
  for (const competency of competencies) {
    const pool = quizPool(stage, competency);
    const unseenOwn = shuffle(pool.filter(item => item.stage === stage && !seen.has(item.id)), rng);
    const unseenEarlier = shuffle(pool.filter(item => item.stage < stage && !seen.has(item.id)), rng);
    const seenAny = shuffle(pool.filter(item => seen.has(item.id)), rng).sort((a, b) => seen.get(a.id)! - seen.get(b.id)!);
    const picked = [...unseenOwn, ...unseenEarlier, ...seenAny].slice(0, perCompetency);
    const reusedCount = picked.filter(item => seen.has(item.id)).length;
    if (reusedCount > 0) reused[competency] = reusedCount;
    items.push(...picked);
  }
  return { items: shuffle(items, rng), reused };
};
