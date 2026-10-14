/**
 * The sample points the collision-parity golden is built from.
 *
 * Shared by the golden generator and the test so the two can never drift: one
 * definition of "every level, every event, at the distances where it is on
 * screen, cleared and uncleared".
 */
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/** Offsets from an event's trigger point, covering its whole visible approach. */
const OFFSETS = [-1250, -900, -600, -350, -180, -60, 0, 40];

export interface CollisionSample {
  levelId: number;
  level: LevelConfig;
  distance: number;
  /** Trigger distances treated as already answered. */
  handled: number[];
  playerLane: 0 | 1 | 2 | 3;
}

export const collisionSamples = (): CollisionSample[] => {
  const samples: CollisionSample[] = [];
  for (const level of LEVELS) {
    for (const event of level.events) {
      for (const offset of OFFSETS) {
        const distance = event.triggerAtDistance + offset;
        if (distance < 0) continue;
        samples.push({
          levelId: level.id,
          level,
          distance,
          handled: [],
          playerLane: 2,
        });
        samples.push({
          levelId: level.id,
          level,
          distance,
          handled: [event.triggerAtDistance],
          playerLane: 1,
        });
      }
    }
  }
  return samples;
};

/**
 * Frozen clock for the two scenes whose solid parts move on their own (a
 * pedestrian walking a signalised crossing, a vehicle merging). Without it the
 * golden would depend on when it was generated.
 */
export const FROZEN_NOW = 1_700_000_000_000;
