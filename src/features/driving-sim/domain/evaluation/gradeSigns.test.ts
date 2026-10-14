/**
 * What the grader must never do to Level 3's sign roster.
 *
 * Two of these record bugs that shipped, and they were written as a browser
 * console script — so nothing ran them. The drive is headless, so they run
 * here.
 *
 * Every sign the level can roll is covered, not one sample of it: the pool is
 * drawn repeatedly until each distinct sign has been seen.
 */
import { describe, expect, it } from 'vitest';
import { createLevel3 } from '@/features/driving-sim/domain/scenario/content/levels/level3/level3';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { branchSideFor } from '@/features/driving-sim/domain/scene/signScene';
import { MAX_SPEED, speedProfileFor, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import {
  acceptableLanes,
  createTelemetry,
  gradeEvent,
  laneForTurn,
  recordFrame,
} from './eventTelemetry';
import { evaluatePlayerAction } from './evaluatePlayerAction';

const level: LevelConfig = createLevel3();

/**
 * Every distinct sign Level 3 can roll.
 *
 * A fixed number of rolls rather than "until nothing new appears": the roster
 * is a pool per slot, so this converges quickly and stays deterministic in
 * length whatever the pool contains.
 */
const everySign = (): ScenarioEvent[] => {
  const seen = new Map<string, ScenarioEvent>();
  for (let roll = 0; roll < 400; roll++) {
    for (const event of createLevel3().events) {
      if (event.sign) seen.set(event.sign.name, event);
    }
  }
  return [...seen.values()];
};

interface DriveProfile {
  speed?: number;
  lane?: LaneIndex;
  turned?: 'left' | 'right' | null;
  stopped?: boolean;
  inBay?: boolean;
}

/**
 * Replays a speed/lane profile through the whole grading path the drive uses:
 * the telemetry window, then `gradeEvent` for what the vehicle did, then the
 * rule engine for whether that satisfies the sign.
 *
 * Going through the rule engine rather than comparing the action to
 * `correctAction` is load-bearing. Slowing down has three honest names —
 * `brake`, `slow` and `stop` — and all three obey a sign that asked you to
 * slow. Comparing labels would fail a driver who coasted, which is exactly the
 * false alarm the console harness this came from would have raised.
 */
const gradeDrive = (
  event: ScenarioEvent,
  { speed = 18, lane = 1, turned = null, stopped = false, inBay = false }: DriveProfile
) => {
  const telemetry = createTelemetry(stopped ? 0 : speed, lane);
  for (let frame = 0; frame < 24; frame++) {
    recordFrame(telemetry, stopped && frame < 16 ? 0 : speed, lane, frame >= 16, false, inBay);
  }
  if (turned) telemetry.turned = turned;
  const graded = gradeEvent(telemetry, event, level);
  return {
    action: graded.action,
    correct: evaluatePlayerAction(event, graded.action, 0).isCorrect,
  };
};

/** The lane this sign accepts, or the middle where it does not care. */
const preferredLane = (event: ScenarioEvent): LaneIndex => (acceptableLanes(event, level) ?? [1])[0];

describe("Level 3's signs", () => {
  it('has a roster to grade', () => {
    expect(everySign().length).toBeGreaterThan(10);
  });

  it('never marks an obedient driver wrong', () => {
    const failures = everySign().flatMap(event => {
      const lane = preferredLane(event);
      const posted = event.postedSpeed ?? level.speedLimit;

      // Obeying means different things to different signs: pull into the bay
      // where stopping is permitted, make the turn from the lane it requires,
      // come to rest for a stop, halve your speed for a brake.
      const result = event.bay
        ? gradeDrive(event, { lane, inBay: event.bay.mayStop, stopped: event.bay.mayStop })
        : event.maneuver
          ? gradeDrive(event, {
              lane,
              turned: event.maneuver.direction === 'either' ? 'left' : event.maneuver.direction,
            })
          : event.correctAction === 'stop'
            ? gradeDrive(event, { lane, stopped: true })
            : event.correctAction === 'brake'
              ? gradeDrive(event, { lane, speed: posted * 0.5 })
              : gradeDrive(event, { lane, speed: level.speedLimit });

      return result.correct ? [] : [`${event.sign!.name}: wanted ${event.correctAction}, graded ${result.action}`];
    });

    expect(failures).toEqual([]);
  });

  it('never marks a driver who did nothing right', () => {
    const top = speedProfileFor(level.speedLimit).maxSpeed;
    const failures = everySign()
      .filter(event => event.correctAction !== 'accelerate')
      .filter(event => gradeDrive(event, { speed: top, lane: 1 }).correct)
      .map(event => `${event.sign!.name}: passed at full speed in the middle lane`);

    expect(failures).toEqual([]);
    expect(top).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('makes a turn need its own lane, and need to actually happen', () => {
    const failures: string[] = [];

    for (const event of everySign().filter(entry => entry.maneuver)) {
      const maneuver = event.maneuver!;
      const directions = maneuver.direction === 'either' ? (['left', 'right'] as const) : [maneuver.direction];
      const allowed = acceptableLanes(event, level) ?? [];
      const wrongLane = ([0, 1, 2] as LaneIndex[]).find(lane => !allowed.includes(lane));

      for (const direction of directions) {
        const from = laneForTurn(maneuver, direction, level);
        if (!gradeDrive(event, { lane: from, turned: direction }).correct) {
          failures.push(`${event.sign!.name}: a correct ${direction} turn from lane ${from} was marked wrong`);
        }
        if (wrongLane !== undefined && gradeDrive(event, { lane: wrongLane, turned: direction }).action !== 'wrong_lane') {
          failures.push(`${event.sign!.name}: a ${direction} turn was allowed from lane ${wrongLane}`);
        }
        if (gradeDrive(event, { lane: from, turned: null }).correct) {
          failures.push(`${event.sign!.name}: passed without ever turning`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('judges a lane sign on lane alone, however slowly it is passed', () => {
    // This shipped once. Keep Right derived its expected action from speed, so
    // anyone under about 18 km/h was marked wrong — and the message blamed
    // their lane, which was the one thing they had right.
    const failures = everySign()
      .filter(event => event.requiredLane && event.correctAction === 'accelerate')
      .flatMap(event =>
        [30, 12, 4]
          .filter(speed => !gradeDrive(event, { lane: preferredLane(event), speed }).correct)
          .map(speed => `${event.sign!.name}: the correct lane at ${speed} km/h was marked wrong`)
      );

    expect(failures).toEqual([]);
  });

  it('branches the side road the way its sign points', () => {
    // No Right Turn was drawn over a side street branching left, because only
    // manoeuvre events declared a direction and prohibitions fell through to a
    // default. The sign said one thing and the road showed another.
    const failures = everySign()
      .filter(event => event.scene === 'side_road')
      .flatMap(event => {
        const wants = event.maneuver
          ? event.maneuver.direction === 'right'
            ? 'right'
            : 'left'
          : event.avoid?.includes('turn_right')
            ? 'right'
            : event.avoid?.includes('turn_left')
              ? 'left'
              : null;
        if (!wants) return [];
        const drawn = branchSideFor(event);
        return drawn === wants
          ? []
          : [`${event.sign!.name}: the sign is about turning ${wants}, the road branches ${drawn}`];
      });

    expect(failures).toEqual([]);
  });
});
