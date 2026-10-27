/**
 * Level 6's two places a car may not stand, driven where the game appends them.
 *
 * Step 3h made them the first `parking` practice that can leave
 * Level 6: each is graded on whether the car came to rest where the rule
 * reaches, which any road can measure - within four meters of the hydrant, and
 * alongside the tow-away sign. This appends each to every level the selector
 * may hand it to, exactly as `buildLevelConfig` does, and holds it to the rule
 * on every one: driving on passes, slowing hard past it passes, coming to rest
 * further back passes, and coming to rest at it fails - for the stop, settled
 * where the car stopped, and the same at every theta. Level 6 itself is not a
 * host: both are already on its route, so `withRemediation` never appends them
 * there.
 *
 * Driven by `driveScenario`, from rest just past the scenario before it, as
 * `thetaGrading.test.ts` drives every authored scenario.
 */
import { describe, expect, it } from 'vitest';
import { buildLevelConfig } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { noStandingStretch, type NoStandingStretch } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { driveScenario, type Driver } from './thetaDrives';

const PARKING = ['level6.hydrant-at-the-curb', 'level6.tow-away-zone'];

/** Every level the selector may append them to: after Level 6, and not the exam, which never adapts. */
const HOSTS = [7, 8, 9, 10, 11];

const appendedTo = (host: number, id: string): { level: LevelConfig; event: ScenarioEvent } => {
  const candidate = remediationCandidates('parking', host).find(({ variant }) => variant.id === id)!;
  const level = buildLevelConfig(host, undefined, null, undefined, {
    ...candidate.variant,
    remediation: true,
    remediationSourceLevelId: candidate.levelId,
  })!;
  return { level, event: level.events.find(event => event.id === id)! };
};

/** The speed a driver looking for somewhere to park creeps along at, in km/h. */
const CREEP = 10;

/**
 * Creeps up through the zone and comes to rest once the car is `at` units from
 * the place (negative while it is still ahead), then drives on. Slow enough
 * that the car stops within a few units of where it chose to.
 */
const comesToRestAt = (at: number): Driver => {
  let rested = false;
  return ({ diff, zone, speed }) => {
    if (rested) return {};
    if (diff >= at) {
      if (speed <= 0) rested = true;
      return { brake: true };
    }
    return diff >= -zone && speed > CREEP ? { brake: true } : {};
  };
};

/** Comes to rest with its nose a little past the place, so the car stands beside it. */
const standsAtIt = (stretch: NoStandingStretch): Driver => comesToRestAt(Math.min(stretch.to / 2, 40));

/** Comes to rest well short of where the rule reaches, then drives on past. */
const stopsShortOfIt = (stretch: NoStandingStretch): Driver => comesToRestAt(stretch.from - 60);

/** Brakes hard through the approach to a crawl, never to rest, and lets off at the place. */
const slowsPast: Driver = ({ diff, zone, speed }) =>
  diff >= -zone && diff < 0 && speed > CREEP ? { brake: true } : {};

const correct = (event: ScenarioEvent, action: string) => evaluateWeightedRule(event, action, 0).isCorrect;

describe("Level 6's parking practice, appended to another level", () => {
  it('is offered to every level it is driven on here', () => {
    for (const host of HOSTS) {
      expect(remediationCandidates('parking', host).map(({ variant }) => variant.id)).toEqual(PARKING);
    }
  });

  for (const host of HOSTS) {
    for (const id of PARKING) {
      describe(`${id} on Level ${host}`, () => {
        it('is placed at the end of the route, and passed by a driver who drives on', () => {
          const { level, event } = appendedTo(host, id);
          expect(level.events.at(-1)?.id).toBe(id);
          const drive = driveScenario(level, event, 1);
          expect(drive.outcome).toBe('accelerate');
          expect(correct(event, drive.outcome)).toBe(true);
        }, 60_000);

        it('is passed by a driver who slows hard past it without stopping', () => {
          const { level, event } = appendedTo(host, id);
          const drive = driveScenario(level, event, 1, slowsPast);
          expect(drive.outcome).toBe('accelerate');
          expect(correct(event, drive.outcome)).toBe(true);
        }, 60_000);

        it('is passed by a driver who comes to rest short of where the rule reaches', () => {
          const { level, event } = appendedTo(host, id);
          for (const theta of [0.75, 1, 1.5]) {
            const drive = driveScenario(level, event, theta, stopsShortOfIt(noStandingStretch(event)!));
            expect(drive.outcome, `theta ${theta}`).toBe('accelerate');
            expect(correct(event, drive.outcome)).toBe(true);
          }
        }, 60_000);

        it('is failed, for the stop, where the car came to rest at it, at every theta', () => {
          const { level, event } = appendedTo(host, id);
          for (const theta of [0.75, 1, 1.5]) {
            const drive = driveScenario(level, event, theta, standsAtIt(noStandingStretch(event)!));
            expect(drive.outcome, `theta ${theta}`).toBe('stop');
            expect(correct(event, drive.outcome)).toBe(false);
            // Settled on the spot, not when the car eventually drove past.
            expect(drive.settlement, `theta ${theta}`).toBe('lapse');
          }
        }, 60_000);
      });
    }
  }
});
