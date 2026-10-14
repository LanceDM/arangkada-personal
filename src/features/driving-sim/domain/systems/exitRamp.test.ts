/**
 * An expressway exit is not a street corner.
 *
 * The junction turn freezes the road, swings the car through ninety degrees,
 * carries it off the side of the frame and sets it down somewhere else. Reused
 * for an exit it did all four: the car left the canvas for five frames, the
 * route jumped seven hundred units, and the vehicle reappeared at a lane centre
 * it had not driven to. These are the properties that make a ramp a ramp.
 */
import { describe, expect, it } from 'vitest';
import { CANVAS_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { RAMP_LENGTH, TURN_DURATION_MS, rampPose, turnPose } from './maneuvers';

const ramp = { fromDistance: 8800, fromX: 327, toX: 405 };

const samples = (count = 24) =>
  Array.from({ length: count + 1 }, (_, i) =>
    rampPose(ramp, ramp.fromDistance + (RAMP_LENGTH * i) / count)
  );

describe('crossing onto an exit ramp', () => {
  it('stays on the canvas the whole way across', () => {
    for (const pose of samples()) {
      expect(pose.x).toBeGreaterThan(0);
      expect(pose.x).toBeLessThan(CANVAS_WIDTH);
    }
  });

  it('leans a few degrees, not ninety', () => {
    const steepest = Math.max(...samples().map(pose => Math.abs(pose.heading)));
    expect(steepest).toBeGreaterThan(0.02);
    expect(steepest).toBeLessThan(0.35); // about twenty degrees
  });

  it('is pointing down the ramp by the time it gets there', () => {
    const [first] = samples();
    const last = samples().at(-1)!;
    expect(first.heading).toBeCloseTo(0, 4);
    expect(last.heading).toBeCloseTo(0, 4);
    expect(last.x).toBeCloseTo(ramp.toX, 4);
    expect(last.done).toBe(true);
  });

  it('moves across without ever moving backwards', () => {
    const xs = samples().map(pose => pose.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
  });

  it('is a length of road rather than a stretch of time', () => {
    // The same line at any speed. Timed instead, a careful driver at 45 km/h
    // swerved across at nearly twice the lean of one at the ceiling.
    expect(RAMP_LENGTH).toBeGreaterThan(200);
    const slowEnd = rampPose(ramp, ramp.fromDistance + RAMP_LENGTH);
    expect(slowEnd.done).toBe(true);
    expect(slowEnd.x).toBeCloseTo(ramp.toX, 4);
    expect(TURN_DURATION_MS).toBeGreaterThan(0);
  });

  it('is nothing like the junction turn it replaced', () => {
    // The turn this was reused from ends most of a canvas width away and
    // rotates through a right angle. Kept here as the contrast: both still
    // exist, and a level picks the one that matches its road.
    const turn = turnPose(
      { dir: 1, startedAt: 0, fromX: 327, fromY: 580, crossStreetY: 300, exitDistance: 0 },
      TURN_DURATION_MS
    );
    expect(turn.x).toBeGreaterThan(CANVAS_WIDTH);
    expect(Math.abs(turn.heading)).toBeGreaterThan(1.3); // ~90 degrees
  });
});
