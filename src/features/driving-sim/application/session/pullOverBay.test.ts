/**
 * A roadside bay, and the wheel that has to be able to reach it.
 *
 * `isInBay` asks whether the car is past the edge of the carriageway, and
 * `stoppedInBay` is the whole grade on every event that says "pull off the road
 * and stop". The bay's widened bounds were computed *after* the steering and
 * used only to push the car back, so the limit the wheel obeyed was always the
 * carriageway's: `car.x` could never exceed `laneBounds().max`, `isInBay` asks
 * for six pixels beyond it, and both such events in the game were unpassable.
 * A driver was told to get off the road and then held on it.
 *
 * So this is the pair of facts that has to stay true together: the bay is
 * reachable where a bay is declared, and nowhere else is.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import {
  BAY_SPAN,
  ROAD_CENTRE_X,
  isInBay,
  laneBounds,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/** Every event in the game that asks the driver to pull off the carriageway. */
const BAY_EVENTS = LEVELS.flatMap(level =>
  level.events.filter(event => event.bay?.mayStop && !event.parkingCutscene).map(event => ({ level, event }))
);

/**
 * Drives a level with the wheel held to one side, reporting how far off the
 * carriageway it ever got and where.
 *
 * The throttle is eased back near the target so the car is still rolling when
 * the bay opens — a bay only opens within `BAY_SPAN` of its sign, and a driver
 * who has already stopped short of that never sees it.
 */
const driveHoldingRight = (level: LevelConfig, target: number, wanted: number) => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;

  try {
    const session = createDrivingSession({ level, fsm: new DrivingFSM(), signCoverage: {} });
    let previous: InputState = NO_INPUT;
    /** The furthest off the carriageway the car ever was, and where. */
    let worst = { overshoot: -Infinity, distance: 0 };
    let insideBay = false;

    for (let frame = 0; frame < 20_000; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      if (session.getSnapshot().briefingEvent) session.dismissBriefing();
      const frozen = session.getSnapshot().cutsceneEvent;
      if (frozen) {
        session.answerCutscene(frozen.correctAction);
        continue;
      }
      const snapshot = session.getSnapshot();
      const car = session.getFrame()?.scene?.car;
      const distance = car?.distance ?? 0;

      const near = Math.abs(distance - target) < 200;
      const want = near ? wanted : level.speedLimit * 0.7;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < want - 1 && !previous.throttle,
        brake: snapshot.speed > want + 0.5,
        right: true,
      };
      previous = input;
      session.update(input);

      if (car) {
        const overshoot = car.x - laneBounds(ROAD_CENTRE_X).max;
        if (overshoot > worst.overshoot) worst = { overshoot, distance };
        if (isInBay(car.x, ROAD_CENTRE_X, 'right')) insideBay = true;
      }
      if (distance > target + 300) break;
    }
    return { ...worst, insideBay };
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe('a bay the driver is told to stop in', () => {
  it('is something the roster actually contains, so these assertions bite', () => {
    expect(BAY_EVENTS.map(({ event }) => event.id).sort()).toEqual([
      'level10.out-of-her-seat',
      'level9.tire-blowout',
    ]);
  });

  it('can be reached by the wheel, on every level that declares one', () => {
    // The assertion the fix exists for. Both of these grade `stoppedInBay`, so
    // a bay the car cannot enter is a scenario nobody can pass.
    for (const { level, event } of BAY_EVENTS) {
      const run = driveHoldingRight(level, event.triggerAtDistance, 12);
      expect(run.insideBay, `${event.id} cannot be reached`).toBe(true);
    }
  });

  it('is the only place the car may leave the carriageway', () => {
    // The other half. Widening the wheel's limit near a bay must not widen it
    // anywhere else, or the car would be steering onto the verge all run.
    for (const { level, event } of BAY_EVENTS) {
      const run = driveHoldingRight(level, event.triggerAtDistance, 12);
      expect(Math.abs(run.distance - event.triggerAtDistance), `${event.id}`).toBeLessThanOrEqual(
        BAY_SPAN
      );
    }
  });

  it('holds a car on the road everywhere a level declares no bay at all', () => {
    // Level 8 has none. Held hard right for its whole length, the car must
    // never once get past the edge of the carriageway.
    const level8 = LEVELS.find(level => level.id === 8)!;
    expect(level8.events.some(event => event.bay)).toBe(false);
    const run = driveHoldingRight(level8, level8.roadLength, 30);
    expect(run.insideBay).toBe(false);
    expect(run.overshoot).toBeLessThanOrEqual(0);
  });
});
