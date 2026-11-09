// What the briefing and the results screen say about the routing FSM's move
// : which transition the player is on, and why.
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
import type { Localized } from '@/shared/lib/localized';
import type { CourseEntry } from './courseRouting';

export interface CourseNote {
  heading: Localized;
  lines: Localized[];
  /**
   * The entry's pass mark moves nothing: a review returns to the frontier
   * whatever it scores, and a free replay is outside the machine. The briefing
   * says so beside the pass score rather than showing it as a gate.
   */
  practiceOnly?: true;
}

const levelName = (levelId: number): string =>
  levelId === FINAL_EXAM_LEVEL ? 'the Final Mission' : `Level ${levelId}`;

const title = (levelId: number): string => {
  const name = LEVELS.find(level => level.id === levelId)?.name;
  return levelId === FINAL_EXAM_LEVEL || !name ? levelName(levelId) : `Level ${levelId}: ${name}`;
};

// The final exam is rolled from each attempt's seed, so a retry meets other
// scenarios: what every learner shares is its rules, with nothing adapted.
const FINAL_EXAM_RULES =
  'Every learner drives the Final Mission under the same rules, with nothing added to it. Pass it to finish the course.';

const PRACTICE_IS_NEUTRAL =
  'It is graded and explained like every other scenario, but it does not count toward your pass mark.';

/** Why a practice item is on this competency, from what the decision read. */
const practiceReason = (practised: string, weakest: string | null): Localized | null => {
  if (!weakest) return null;
  return practised === weakest
    ? { en: `${getCompetencyLabel(practised)} is your weakest area right now.` }
    : { en: `${getCompetencyLabel(practised)} is closely related to ${getCompetencyLabel(weakest)}, your weakest area right now.` };
};

/** The briefing's note on the entry about to be played. */
export const courseNote = (entry: CourseEntry): CourseNote => {
  const { pending, levelId, item, review } = entry;
  const transition = pending.transition;
  const from = pending.from.kind === 'DRIVE' ? pending.from.level : FINAL_EXAM_LEVEL;

  if (!transition || pending.outcome === null) {
    return {
      heading: { en: `Your course: ${title(levelId)}` },
      lines: [
        { en: levelId === FINAL_EXAM_LEVEL ? FINAL_EXAM_RULES : `Pass this level to move on to ${levelName(levelId + 1)}.` },
      ],
    };
  }

  if (review) {
    const frontier = entry.destination!;
    const label = getCompetencyLabel(review.competency);
    return {
      heading: { en: `Review: ${title(review.level)}` },
      lines: [
        { en: `You passed ${levelName(from)}. Before ${levelName(frontier)}, you will drive ${levelName(review.level)} once more, because ${label} is your weakest area right now and no practice scenario for it fits ${levelName(frontier)} yet. ${levelName(review.level)} always covers ${label}.` },
        { en: `This review does not hold you back: you go on to ${levelName(frontier)} afterwards, whatever you score.` },
      ],
      practiceOnly: true,
    };
  }

  const lines: Localized[] = [];
  if (transition.kind === 'retry') {
    lines.push(
      levelId === FINAL_EXAM_LEVEL
        ? { en: 'You did not pass the Final Mission last time, so you are driving it again. Nothing is added to it.' }
        // Not "the pass mark": a crash fails the level whatever it scored.
        : { en: `You did not pass ${levelName(levelId)} last time, so you are driving it again.` }
    );
  } else if (transition.kind === 'to_final') {
    lines.push({ en: `You passed ${levelName(from)}. ${FINAL_EXAM_RULES}` });
  } else {
    lines.push({ en: `You passed ${levelName(from)}.` });
  }

  if (item) {
    lines.push({ en: `One extra scenario on ${getCompetencyLabel(item.competency)} is added at the end of this drive. ${PRACTICE_IS_NEUTRAL}` });
    const reason = practiceReason(item.competency, pending.observation.weakest);
    if (reason) lines.push(reason);
  }

  const heading: Localized =
    transition.kind === 'retry'
      ? { en: `Again: ${title(levelId)}` }
      : { en: `Next: ${title(levelId)}` };
  return { heading, lines };
};

/** The briefing's note on a free replay of a passed level, which is outside the routing FSM. */
export const freeReplayNote = (levelId: number): CourseNote => ({
  heading: { en: `Free replay: ${title(levelId)}` },
  lines: [{ en: 'You have already passed this level. Replaying it does not change your course, whatever you score.' }],
  practiceOnly: true,
});

/** What the results screen says the Continue button leads to, once the entry is settled. */
export const courseResultNote = (entry: CourseEntry, outcome: Outcome): Localized => {
  if (entry.review) return { en: `Review done. Continue goes on to ${levelName(entry.destination!)}.` };
  if (entry.levelId === FINAL_EXAM_LEVEL && outcome === 'passed') return { en: 'You passed the Final Mission. Your course is complete.' };
  return outcome === 'passed'
    ? { en: 'Continue to the next step of your course.' }
    : { en: `Continue to drive ${levelName(entry.levelId)} again.` };
};
