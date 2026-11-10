import type { DrivingCompetency } from '@/domain/learner/competency';
import { QUIZ_ITEMS_PER_COMPETENCY } from '@/domain/learner/stageCompetencies';
import type { QuizItemDoc } from './quizBank';

/**
 * A course quiz attempt: 3 items for each
 * competency still to pass, drawn from the level's switched-on quiz items of
 * that competency. Items not yet seen in this stage come first, then the least
 * recently seen, so a retake asks new questions while the bank has them. The
 * level's own sitting size and pass mark are not read: the course passes a
 * competency at 2 of its 3.
 */
export interface CourseQuizDraw {
  items: QuizItemDoc[];
  /** Competencies that could not be given their full 3, and by how many. */
  shortfall: Partial<Record<DrivingCompetency, number>>;
}

const shuffled = <T>(values: readonly T[], rng: () => number): T[] => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const drawCourseQuiz = (
  bank: readonly QuizItemDoc[],
  remaining: readonly DrivingCompetency[],
  /** Item ids already shown in this stage's quiz, oldest first. */
  seenItems: readonly string[],
  rng: () => number,
  perCompetency: number = QUIZ_ITEMS_PER_COMPETENCY
): CourseQuizDraw => {
  const lastSeen = new Map(seenItems.map((id, index) => [id, index]));
  const items: QuizItemDoc[] = [];
  const shortfall: CourseQuizDraw['shortfall'] = {};
  for (const competency of remaining) {
    const candidates = shuffled(
      bank.filter(item => item.use === 'quiz' && item.isActive && item.competency === competency),
      rng
    ).sort((a, b) => (lastSeen.get(a.id) ?? -1) - (lastSeen.get(b.id) ?? -1));
    const chosen = candidates.slice(0, perCompetency);
    if (chosen.length < perCompetency) shortfall[competency] = perCompetency - chosen.length;
    items.push(...chosen);
  }
  return { items, shortfall };
};
