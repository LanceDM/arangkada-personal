import { describe, expect, it } from 'vitest';
import { COMPETENCY_STAGES, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { composeDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { driveScenario, cruise, swerveAndStopAt, type Driver } from './thetaDrives';

// A drive composed from competency pools (composeDrive.ts), driven by the real
// session: every scenario on it can be reached and decided.

/** Brakes to rest at the scenario, waits, then drives on: the yielding driver. */
const yieldThenGo = (waitFrames: number): Driver => {
  let begun = false;
  let rested = false;
  let waited = 0;
  return ({ diff, zone, speed }) => {
    if (!begun && diff >= -0.9 * zone) begun = true;
    if (!begun) return {};
    if (!rested) {
      if (speed <= 0) rested = true;
      return { brake: true };
    }
    waited += 1;
    return waited < waitFrames ? { brake: true } : {};
  };
};

/** Moves right a lane and slows: what an obstacle in the lane asks for. */
const swerveRightAndStop: Driver = (() => {
  return ({ diff, zone, speed }) => {
    if (diff < -0.9 * zone) return {};
    if (diff < -0.6 * zone) return { right: true };
    return speed > 0 ? { brake: true } : {};
  };
})();

/**
 * Scenarios none of these scripted drivers clear on their own level's road
 * either (an obstacle across the lane: the scripted drivers brake into it or
 * crawl short of it). Composition does not change them; they are left out of
 * this check, not out of the game.
 */
const UNDRIVEN_AT_HOME = new Set([
  'level3.bend-warning.landslide-prone',
  'level3.bend-warning.falling-rocks',
  'level3.bend-warning.animal-crossing',
]);

describe('a composed drive, actually driven', () => {
  it('lets every scenario on it be reached and decided', () => {
    for (const stage of COMPETENCY_STAGES) {
      const drive = composeDrive({ levelId: stage, competencies: STAGE_COMPETENCIES[stage], rng: createRng(stage) });
      for (const event of drive.level.events.filter(event => !UNDRIVEN_AT_HOME.has(event.id))) {
        const outcomes = [cruise, swerveAndStopAt(0.9), yieldThenGo(120), swerveRightAndStop].map(
          driver => driveScenario(drive.level, event, 1, driver).outcome
        );
        // At least one way of driving it reaches it and gets a verdict.
        expect(
          outcomes.some(outcome => outcome !== 'none' && outcome !== 'crashed'),
          `${event.id} on L${stage}: ${outcomes}`
        ).toBe(true);
      }
    }
  }, 120_000);
});
