import { describe, expect, it } from 'vitest';
import {
  CROSSING_WALK_IN_DONE,
  CROSSING_WALK_IN_FROM,
  crossingWalk,
  PEDESTRIAN_WALK_OFF_MS,
  pedestrianWalkOff,
} from './eventPlacement';
import { crossingPedestrianPositions, crossingWalkerPositions } from './sceneGeometry';
import { distanceToScreenY, ROAD_WIDTH } from './vehiclePhysics';
import { pedestrianGroupNode } from '@/features/driving-sim/domain/scene/prefabs';

describe('a pedestrian walking clear after the answer', () => {
  it('stands until the event is answered', () => {
    expect(pedestrianWalkOff(1000, 1000, false, null, 5000)).toBe(0);
  });

  it('walks clear in time while the car waits', () => {
    const handledAt = 10_000;
    const stopped = 800; // the car stands short of the crossing and does not move
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt)).toBe(0);
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt + PEDESTRIAN_WALK_OFF_MS / 2)).toBeCloseTo(0.5);
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt + PEDESTRIAN_WALK_OFF_MS)).toBe(1);
  });

  it('is never held back by driving on', () => {
    expect(pedestrianWalkOff(1100, 1000, true, 10_000, 10_000)).toBe(1);
  });
});

describe('people on a crossing walk it (2026-11-16)', () => {
  const people = [{ kind: 'adult' as const, solid: true }, { kind: 'child' as const }];
  const roadX = 100;

  it('stand exactly where they always stood once walked in', () => {
    expect(crossingWalkerPositions(roadX, people, 1, 0)).toEqual(crossingPedestrianPositions(roadX, people));
  });

  it('start off the right-hand curb and finish off the left-hand one', () => {
    crossingWalkerPositions(roadX, people, 0, 0).forEach(x => expect(x).toBeGreaterThan(roadX + ROAD_WIDTH));
    crossingWalkerPositions(roadX, people, 1, 1).forEach(x => expect(x).toBeLessThan(roadX));
  });

  it('are in place before any warning zone opens', () => {
    expect(CROSSING_WALK_IN_DONE).toBeGreaterThan(600);
    const at = (ahead: number) => crossingWalk({ screenY: distanceToScreenY(ahead, 0), handled: false }, 0);
    expect(at(CROSSING_WALK_IN_FROM).walkIn).toBe(0);
    expect(at(CROSSING_WALK_IN_DONE).walkIn).toBe(1);
    expect(at(850).walkIn).toBeCloseTo(0.5);
  });

  it('can be hit while the crossing is live, and not once they walk off', () => {
    const live = pedestrianGroupNode(roadX, 300, people, { walkIn: 1, walkedOff: 0 });
    const leaving = pedestrianGroupNode(roadX, 300, people, { walkIn: 1, walkedOff: 0.3 });
    expect(live.solids).toHaveLength(1);
    expect(leaving.solids ?? []).toHaveLength(0);
  });
});
