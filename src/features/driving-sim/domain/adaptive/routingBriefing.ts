// What the briefing and the results screen say about the routing FSM's move:
// which transition the player is on, and why.
//
// Both groups read the same panel. It names the move and the reason in the
// player's terms and never the group, the policy or the table, so a pilot
// participant cannot tell which group they are in from it. A review says it
// is because of the weak area, as the mentor asked, and that it does
// not hold the player back, which is true: `return` fires whatever it scores.
import type { Outcome } from '@/domain/routing/routingTypes';
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { CourseEntry } from './courseRouting';

export interface CourseNote {
  heading: string;
  lines: string[];
}

const levelName = (levelId: number): string =>
  levelId === FINAL_EXAM_LEVEL ? 'the final exam' : `Level ${levelId}`;

const title = (levelId: number): string => {
  const name = LEVELS.find(level => level.id === levelId)?.name;
  return levelId === FINAL_EXAM_LEVEL || !name ? levelName(levelId) : `Level ${levelId}: ${name}`;
};

const PRACTICE_IS_NEUTRAL =
  'It is graded and explained like every other scenario, but it does not count toward your pass mark.';

/** Why a practice item is on this competency, from what the decision read. */
const practiceReason = (practised: string, weakest: string | null): string | null => {
  if (!weakest) return null;
  return practised === weakest
    ? `${getCompetencyLabel(practised)} is your weakest area right now.`
    : `${getCompetencyLabel(practised)} is closely related to ${getCompetencyLabel(weakest)}, your weakest area right now.`;
};

/** The briefing's note on the entry about to be played. */
export const courseNote = (entry: CourseEntry): CourseNote => {
  const { pending, levelId, item, review } = entry;
  const transition = pending.transition;
  const from = pending.from.kind === 'DRIVE' ? pending.from.level : FINAL_EXAM_LEVEL;

  if (!transition || pending.outcome === null) {
    return {
      heading: `Your course: ${title(levelId)}`,
      lines: [
        levelId === FINAL_EXAM_LEVEL
          ? 'The final exam is the same test for every learner, with nothing added. Pass it to finish the course.'
          : `Pass this level to move on to ${levelName(levelId + 1)}.`,
      ],
    };
  }

  if (review) {
    const frontier = entry.destination!;
    const label = getCompetencyLabel(review.competency);
    return {
      heading: `Review: ${title(review.level)}`,
      lines: [
        `You passed ${levelName(from)}. Before ${levelName(frontier)}, you will drive ${levelName(review.level)} once more, because ${label} is your weakest area right now and no practice scenario for it fits ${levelName(frontier)} yet. ${levelName(review.level)} always covers ${label}.`,
        `This review does not hold you back: you go on to ${levelName(frontier)} afterwards, whatever you score.`,
      ],
    };
  }

  const lines: string[] = [];
  if (transition.kind === 'retry') {
    lines.push(
      levelId === FINAL_EXAM_LEVEL
        ? 'You did not pass the final exam last time, so you are sitting it again. Nothing is added to it.'
        : `You did not reach the pass mark on ${levelName(levelId)} last time, so you are driving it again.`
    );
  } else if (transition.kind === 'to_final') {
    lines.push(
      `You passed ${levelName(from)}. The final exam is the same test for every learner, with nothing added. Pass it to finish the course.`
    );
  } else {
    lines.push(`You passed ${levelName(from)}.`);
  }

  if (item) {
    lines.push(`One extra scenario on ${getCompetencyLabel(item.competency)} is added at the end of this drive. ${PRACTICE_IS_NEUTRAL}`);
    const reason = practiceReason(item.competency, pending.observation.weakest);
    if (reason) lines.push(reason);
  }

  const heading =
    transition.kind === 'retry'
      ? `Again: ${title(levelId)}`
      : `Next: ${title(levelId)}`;
  return { heading, lines };
};

/** What the results screen says the Continue button leads to, once the entry is settled. */
export const courseResultNote = (entry: CourseEntry, outcome: Outcome): string => {
  if (entry.review) return `Review done. Continue goes on to ${levelName(entry.destination!)}.`;
  if (entry.levelId === FINAL_EXAM_LEVEL && outcome === 'passed') return 'You passed the final exam. Your course is complete.';
  return outcome === 'passed'
    ? 'Continue to the next step of your course.'
    : `Continue to drive ${levelName(entry.levelId)} again.`;
};
