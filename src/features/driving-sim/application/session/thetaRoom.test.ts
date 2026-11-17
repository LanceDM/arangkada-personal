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
import { composeDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { stageContent } from '@/features/driving-sim/domain/scenario/stageContent';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';

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

describe('the room a composed drive leaves its road slots', () => {
  // A scenario lent to a road slot (composeDrive, 2026-11-17) must fit the
  // slot's spacing as the slot's own versions do: the room behind it holds its
  // widest approach, and its zone leaves the next slot its room. Appended
  // scenarios are left out here: they stand at the appended spacing, under
  // the rules the practice item always had.
  it(`never holds the widest theta (${WIDEST}) short at a slot, on any seeded drive`, () => {
    const held: string[] = [];
    for (const levelId of COMPETENCY_STAGES.filter(takesTheta)) {
      const slotDistances = new Set(stageContent(levelId)!.distances);
      for (let seed = 1; seed <= 40; seed++) {
        const { level } = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: createRng(seed) });
        for (const event of level.events.filter(entry => slotDistances.has(entry.triggerAtDistance))) {
          const limits = limitsOf(level, event);
          const wanted = limits.warningDistance * WIDEST;
          if (approachLead(limits, { approachScale: WIDEST }) < wanted) {
            held.push(`level ${levelId} seed ${seed} ${event.id} at ${event.triggerAtDistance}: room ${limits.approachRoom}, needs ${wanted}`);
          }
        }
      }
    }
    expect([...new Set(held)]).toEqual([]);
  }, 120_000);
});
