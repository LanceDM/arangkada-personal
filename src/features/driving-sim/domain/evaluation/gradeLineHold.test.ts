/**
 * Holding a line, and the two rules that make it gradeable.
 *
 * `lineHold` is the only requirement in the game measured across the road
 * rather than along it, and it is the only one that can be lost outright: you
 * cannot un-wander. Both of those have consequences the rest of the grader does
 * not have, and both are here.
 *
 * `laneHeldFrames` is the other half of the same subject, from the opposite
 * side. A lane requirement settles early when the driver is already where the
 * scenario wants them — and on a road that bends, a driver holding their own
 * lane crosses a boundary for a frame or two at a time while they correct. One
 * such frame used to be enough to settle a blind bend taken against the centre
 * line as a pass.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import {
  createTelemetry,
  gradeEvent,
  isFailedEarly,
  isSatisfiedEarly,
  lineHoldDrift,
  recordFrame,
} from './eventTelemetry';

const level8 = LEVELS.find(level => level.id === 8)!;
const hold = level8.events.find(event => event.lineHold)!;
const bend = level8.events.find(event => event.requiredLane)!;
const LIMIT = hold.lineHold!.maxDrift;

const INNER = 2 as LaneIndex;
const CURB = 3 as LaneIndex;

/**
 * Drives a window: a list of positions across the road, at a steady speed in
 * one lane, with the horn optionally leaned on.
 */
const drive = (xs: number[], { lane = INNER, speed = 30, horn = false } = {}) => {
  const telemetry = createTelemetry(speed, lane, xs[0]);
  for (const x of xs) recordFrame(telemetry, speed, lane, true, horn, false, false, x);
  return telemetry;
};

/** A steady hand: the same position, frame after frame. */
const steady = (x = 0, frames = 60) => Array.from({ length: frames }, () => x);
/** A wander out to `to` and back, which is what a drift actually looks like. */
const wanderTo = (to: number, frames = 60) =>
  Array.from({ length: frames }, (_, i) => to * Math.sin((i / (frames - 1)) * Math.PI));

describe('grading a held line', () => {
  it('passes a driver who stayed where they were', () => {
    expect(gradeEvent(drive(steady()), hold, level8).action).toBe(hold.correctAction);
  });

  it('fails a driver who wandered further than the scenario allows', () => {
    const grade = gradeEvent(drive(wanderTo(LIMIT + 8)), hold, level8);
    expect(grade.action).toBe('drifted');
    expect(grade.penaltyMessage).toBe(hold.lineHold!.driftedMessage);
  });

  it('passes a wander that stayed inside the tolerance', () => {
    // The tolerance is not decoration: a driver correcting for camber, or
    // easing off, moves the wheel, and marking that down teaches stiffness.
    expect(gradeEvent(drive(wanderTo(LIMIT - 2)), hold, level8).action).toBe(
      hold.correctAction
    );
  });

  it('measures the wander, not the speed it was held at', () => {
    // Explicitly not a speed test. Slowing while somebody comes past you is a
    // good answer and grading it would make "hold your line" mean "hold your
    // speed" — which is the opposite of the lesson.
    for (const speed of [4, 18, 40]) {
      expect(gradeEvent(drive(steady(), { speed }), hold, level8).action).toBe(
        hold.correctAction
      );
    }
  });

  it('measures the wander, not the lane it was held in', () => {
    const inLane = gradeEvent(drive(steady(), { lane: INNER }), hold, level8);
    const otherLane = gradeEvent(drive(steady(), { lane: CURB }), hold, level8);
    expect(otherLane.action).toBe(inLane.action);
  });

  it('puts the horn ahead of the wander when both went wrong', () => {
    // One verdict, and it names the thing the driver is least entitled to do.
    // A rider beside the door cannot move away from a horn.
    const grade = gradeEvent(drive(wanderTo(LIMIT + 20), { horn: true }), hold, level8);
    expect(grade.action).toBe('honk');
  });

  it('is decided the moment the line is lost, not when the window closes', () => {
    // A wander cannot be un-wandered, so waiting says nothing new — and the
    // thing it was measured against is beside the car, which is how a verdict
    // held to the end of the window arrives after the contact it warned about.
    expect(isFailedEarly(drive(steady()), hold)).toBe(false);
    expect(isFailedEarly(drive([0, LIMIT + 4]), hold)).toBe(true);
  });

  it('is never settled early as a pass, however steady the wheel is', () => {
    // The mirror of the rule above: being straight *now* says nothing about the
    // rest of the window, so the pass has to be driven to the end of it.
    expect(isSatisfiedEarly(drive(steady()), hold, level8, INNER, 30, true)).toBe(false);
  });

  it('leaves every other scenario alone', () => {
    const others = level8.events.filter(event => !event.lineHold);
    for (const event of others) {
      expect(isFailedEarly(drive(wanderTo(120)), event), event.id).toBe(false);
    }
  });
});

describe('a line held toward one side', () => {
  // Level 11's riders are in the motorcycle lane at the curb, to the car's
  // right. Moving left, out of their lane or away from it, gives them more
  // room; only a move toward them squeezes them.
  const level11 = LEVELS.find(level => level.id === 11)!;
  const riders = level11.events.find(event => event.id === 'level11.riders-in-their-lane')!;
  const RIDERS_LIMIT = riders.lineHold!.maxDrift;

  it('declares the riders’ side, and no other line hold declares one', () => {
    const declared = LEVELS.flatMap(level => level.events).filter(event => event.lineHold?.toward);
    expect(declared.map(event => [event.id, event.lineHold!.toward])).toEqual([
      ['level11.riders-in-their-lane', 'right'],
    ]);
  });

  it('passes a move away from the riders, however far', () => {
    const away = drive(wanderTo(-(RIDERS_LIMIT + 60)), { lane: CURB });
    expect(gradeEvent(away, riders, level11).action).toBe(riders.correctAction);
    expect(isFailedEarly(away, riders)).toBe(false);
    expect(lineHoldDrift(away, riders.lineHold!)).toBe(0);
  });

  it('fails a move toward them, as it always did', () => {
    const toward = drive(wanderTo(RIDERS_LIMIT + 8));
    expect(gradeEvent(toward, riders, level11).action).toBe('drifted');
    expect(isFailedEarly(toward, riders)).toBe(true);
    expect(lineHoldDrift(toward, riders.lineHold!)).toBeGreaterThan(RIDERS_LIMIT);
  });

  it('counts the furthest it went toward them, even after a move away', () => {
    const both = drive([0, -40, 0, RIDERS_LIMIT + 4, 0]);
    expect(isFailedEarly(both, riders)).toBe(true);
  });

  it('still counts a wander either way where no side is declared', () => {
    const left = drive(wanderTo(-(LIMIT + 8)));
    expect(gradeEvent(left, hold, level8).action).toBe('drifted');
    expect(lineHoldDrift(left, hold.lineHold!)).toBe(left.maxDrift);
  });
});

describe('settling a lane requirement early', () => {
  /** Frames in a lane, then the verdict on whether being there has registered. */
  const heldFor = (frames: number, lane: LaneIndex) => {
    const telemetry = createTelemetry(20, lane, 0);
    for (let i = 0; i < frames; i++) recordFrame(telemetry, 20, lane, true, false, false, false, 0);
    return isSatisfiedEarly(telemetry, bend, level8, lane, 20, true);
  };

  it('does not settle on a lane the car has only just clipped', () => {
    // The defect this fixes: a driver taking a bend against the centre line
    // crosses into the correct lane for a frame or two as they correct, and one
    // such frame settled the whole scenario as a pass.
    expect(heldFor(1, CURB)).toBe(false);
    expect(heldFor(5, CURB)).toBe(false);
  });

  it('settles once the car has actually been there a moment', () => {
    expect(heldFor(40, CURB)).toBe(true);
  });

  it('never settles in a lane the scenario did not ask for, however long', () => {
    expect(heldFor(600, INNER)).toBe(false);
  });

  it('starts the count again when the car changes lane', () => {
    const telemetry = createTelemetry(20, INNER, 0);
    for (let i = 0; i < 300; i++) recordFrame(telemetry, 20, INNER, true, false, false, false, 0);
    recordFrame(telemetry, 20, CURB, true, false, false, false, 0);
    expect(isSatisfiedEarly(telemetry, bend, level8, CURB, 20, true)).toBe(false);
  });
});
