/**
 * The road leaves every approach the room the policy's widest theta asks for.
 *
 * The machine holds a widened
 * approach under the room back to the scenario before it, so on a road spaced
 * too tightly the theta a level entry asked for was not the theta its scenarios
 * got: at 1.5, 62 of the 192 scenarios on the levels theta reaches were held
 * short, every level's first one among them. The levels were re-spaced so that
 * none is, and this keeps new content from quietly narrowing a gap again.
 *
 * Arithmetic over the session's own limits, not a drive: `thetaLead.test.ts`
 * already holds every drive to open where `approachLead` says.
 */
import { describe, expect, it } from 'vitest';
import { WINDOW_SCALE } from '@/domain/learner/adaptive/qLearningPolicy';
import { COMPETENCIES } from '@/domain/learner/profile';
import { adaptsLevel, FINAL_EXAM_LEVEL_ID } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { approachLead } from '@/features/driving-sim/domain/fsm/approachLead';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { TUTORIAL_LEVEL_ID } from '@/features/driving-sim/domain/systems/tutorial';
import { everyPairing, limitsOf } from './thetaDrives';

/** The widest theta a level entry can be given. */
const WIDEST = Math.max(...Object.values(WINDOW_SCALE));

/**
 * Whether a level entry can be played at a theta other than 1: the final exam
 * never adapts, and an entry that finds no practice content keeps the baseline
 * machine - which is every entry to the tutorial, since nothing is taught
 * before it.
 */
const takesTheta = (levelId: number): boolean =>
  adaptsLevel(levelId) && COMPETENCIES.some(competency => remediationCandidates(competency, levelId).length > 0);

describe('the room each approach has', () => {
  it('is only a question on the levels a theta can reach', () => {
    const outside = LEVELS.map(level => level.id).filter(id => !takesTheta(id));
    expect(outside.sort((a, b) => a - b)).toEqual([TUTORIAL_LEVEL_ID, FINAL_EXAM_LEVEL_ID]);
  });

  it(`never holds the widest theta the policy offers (${WIDEST}) short, after any scenario that can stand before it`, () => {
    const pairings = everyPairing().filter(({ level }) => takesTheta(level.id));
    expect(pairings.length).toBeGreaterThan(0);

    const held = pairings.flatMap(({ level, event }) => {
      const limits = limitsOf(level, event);
      const wanted = limits.warningDistance * WIDEST;
      const lead = approachLead(limits, { approachScale: WIDEST });
      return lead < wanted
        ? [`level ${level.id} ${event.id} at ${event.triggerAtDistance}: room ${limits.approachRoom}, needs ${wanted}`]
        : [];
    });
    expect(held).toEqual([]);
  });
});
