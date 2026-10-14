/**
 * The dial and the world, kept apart and kept consistent.
 *
 * Two claims. First, that a level can change how much road a km/h is worth
 * without changing what the speedometer says — which is the only honest way to
 * make an expressway understandable, because the alternative is pretending the
 * limit is lower than the law it teaches. Second, that everything which reasons
 * in distance reads the same scale: a player on one pace and their traffic on
 * another close on each other at the difference between the two, and every
 * headway between them measures that difference rather than the driving.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { DEFAULT_PACE, paceOf, secondsForUnits, unitsForSeconds } from './DrivingPace';

const level7 = LEVELS.find(level => level.id === 7)!;

describe('a level that declares no pace', () => {
  it('gets the arithmetic every level has always used', () => {
    for (const level of LEVELS.filter(entry => entry.id !== 7)) {
      expect(paceOf(level), `level ${level.id} moved off the shared pace`).toEqual(DEFAULT_PACE);
    }
  });
});

describe("Level 7's pace", () => {
  const pace = paceOf(level7);

  it('leaves the speed the law it teaches, and slows only the road', () => {
    // The rule is 60-100 and the dial reads it. What changed is the world.
    expect(level7.speedLimit).toBe(100);
    expect(pace.distancePerSpeed).toBeLessThan(DEFAULT_PACE.distancePerSpeed);
  });

  it('is slower per second of road than the level driven before it', () => {
    const level6 = LEVELS.find(level => level.id === 6)!;
    const unitsPerSecond = (limit: number, scale: number) => limit * scale * 60;
    // Faster than the 50 km/h level, but nowhere near the two-and-a-half times
    // it was: the road has to be readable at the speed the lesson is about.
    const seven = unitsPerSecond(level7.speedLimit, pace.distancePerSpeed);
    const six = unitsPerSecond(level6.speedLimit, DEFAULT_PACE.distancePerSpeed);
    expect(seven).toBeGreaterThan(six);
    expect(seven).toBeLessThan(six * 1.6);
  });

  it('gives the wheel a tap that corrects and a hold that changes lane', () => {
    const LANE_WIDTH = 65;
    const tapFrames = 8; // a short press, about an eighth of a second
    expect(pace.steerPerFrame * tapFrames).toBeLessThan(LANE_WIDTH / 3);
    // And a held key crosses one lane in well under a second.
    const lane = LANE_WIDTH / pace.steerPerFrame / 60;
    expect(lane).toBeGreaterThan(0.5);
    expect(lane).toBeLessThan(1.2);
  });

  it('takes several seconds to reach the limit from rest', () => {
    const acceleration = Math.max(0.08, level7.speedLimit / 150) * pace.accelerationScale;
    const seconds = level7.speedLimit / acceleration / 60;
    expect(seconds).toBeGreaterThan(3.5);
    expect(seconds).toBeLessThan(6);
  });
});

describe('seconds and units', () => {
  it('round-trip on whatever pace they were measured with', () => {
    for (const pace of [DEFAULT_PACE, paceOf(level7)]) {
      const units = unitsForSeconds(2, 100, pace);
      expect(secondsForUnits(units, 100, pace)).toBeCloseTo(2, 6);
    }
  });

  it('make a two-second gap two seconds of road on any pace', () => {
    // The reason gaps are authored in seconds: the same rule has to mean the
    // same thing on a road that moves at a different rate.
    const slow = unitsForSeconds(2, 100, paceOf(level7));
    const fast = unitsForSeconds(2, 100, DEFAULT_PACE);
    expect(slow).toBeLessThan(fast);
    expect(secondsForUnits(slow, 100, paceOf(level7))).toBeCloseTo(
      secondsForUnits(fast, 100, DEFAULT_PACE),
      6
    );
  });
});
