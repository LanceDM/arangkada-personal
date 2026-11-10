/**
 * Every level's limit is the figure its road class takes, and the
 * pace that drives it at that figure leaves its road exactly as it was spaced.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { DANGER_SPEED, LEGAL_LIMIT, isSection35Road } from '@/features/driving-sim/domain/scenario/speedLimits';
import { DEFAULT_PACE, paceOf, spacedPace } from '@/features/driving-sim/domain/world/DrivingPace';
import { speedProfileFor, SPEED_STEP } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { stoppingDistanceFrom } from '@/features/driving-sim/domain/systems/eventScheduler';

describe('speed limits (RA 4136 §35, speed-limits pack)', () => {
  it.each(LEVELS.map(level => [level.id, level] as const))('Level %i posts its class’s limit', (_, level) => {
    expect(level.speedLimit).toBe(LEGAL_LIMIT[level.roadClass]);
  });

  it('names §35(b)’s figures for a passenger car', () => {
    expect(LEGAL_LIMIT).toMatchObject({ open_country: 80, through_street: 40, city_street: 30 });
    expect(DANGER_SPEED).toBe(20);
  });

  it('takes only the expressway out of §35', () => {
    expect(LEVELS.filter(level => !isSection35Road(level.roadClass)).map(level => level.id)).toEqual([7]);
  });

  it('lands every limit, and the danger speed, on the speed setting', () => {
    for (const level of LEVELS) expect(level.speedLimit % SPEED_STEP, `Level ${level.id}`).toBe(0);
    expect(DANGER_SPEED % SPEED_STEP).toBe(0);
  });
});

describe('spacedPace drives a road at its legal limit as it was spaced', () => {
  const pairs: Array<[number, number]> = [
    [30, 40],
    [30, 35],
    [40, 60],
    [30, 50],
    [30, 60],
  ];

  it.each(pairs)('at %i, as at %i', (limit, spacedFor) => {
    const pace = paceOf({ pace: spacedPace(limit, spacedFor) });
    const old = DEFAULT_PACE;
    // Road per frame at the limit.
    expect(limit * pace.distancePerSpeed).toBeCloseTo(spacedFor * old.distancePerSpeed, 10);
    // Road per frame of acceleration, which is a share of the limit.
    expect(speedProfileFor(limit).acceleration * pace.distancePerSpeed).toBeCloseTo(
      speedProfileFor(spacedFor).acceleration * old.distancePerSpeed,
      10
    );
    // The stop the approach floors are built on.
    expect(stoppingDistanceFrom(limit, pace)).toBeCloseTo(stoppingDistanceFrom(spacedFor, old), 6);
  });

  it('gives each spaced level the factor its own limit implies', () => {
    for (const level of LEVELS) {
      if (!level.pace || level.id === 7) continue;
      const pace = paceOf(level);
      expect(pace.brakingScale, `Level ${level.id}`).toBeCloseTo(pace.speedChangeScale, 12);
      expect(pace.distancePerSpeed * pace.brakingScale, `Level ${level.id}`).toBeCloseTo(DEFAULT_PACE.distancePerSpeed, 12);
    }
  });
});
