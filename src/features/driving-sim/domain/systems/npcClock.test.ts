import { describe, expect, it } from 'vitest';
import { newNpcClock, npcTransform } from './updateNpcVehicles';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';

const ROAD_X = 80;
const T = 1000;

/** Poses a vehicle over `frames` frames with the player standing at `stopAt`. */
const waitAt = (spec: NpcVehicleSpec, stopAt: number, handled: boolean, frames: number) => {
  const clock = newNpcClock();
  const xs: number[] = [];
  for (let f = 0; f < frames; f++) {
    const at = npcTransform(spec, T, stopAt, ROAD_X, 300, handled, { oncomingLanes: 1, clock, tick: true });
    xs.push(at.x);
  }
  return xs;
};

describe('junction vehicles keep moving while the player waits (2026-11-16)', () => {
  it('a car crossing with priority goes on across in front of a stopped driver', () => {
    const xs = waitAt({ path: 'crossing_from_right', vehicleKind: 'car', label: 'a car' } as NpcVehicleSpec, T - 150, false, 400);
    expect(xs[60]).toBeLessThan(xs[0]);
    expect(xs.at(-1)!).toBeLessThan(0);
  });

  it('without a clock it is placed by the player alone, as before', () => {
    const spec = { path: 'crossing_from_right', vehicleKind: 'car', label: 'a car' } as NpcVehicleSpec;
    const a = npcTransform(spec, T, T - 150, ROAD_X, 300, false, { oncomingLanes: 1 });
    const b = npcTransform(spec, T, T - 150, ROAD_X, 300, false, { oncomingLanes: 1 });
    expect(a.x).toBe(b.x);
  });

  it('a car stuck in the box holds while the decision is open and clears once it is answered', () => {
    const spec = { path: 'crossing_from_right', vehicleKind: 'car', label: 'a car', inBox: true } as NpcVehicleSpec;
    const open = waitAt(spec, T - 120, false, 200);
    expect(open.at(-1)).toBe(open[0]);
    const answered = waitAt(spec, T - 120, true, 400);
    expect(answered.at(-1)!).not.toBe(answered[0]);
  });
});
