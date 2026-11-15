import { describe, expect, it } from 'vitest';
import { PEDESTRIAN_WALK_OFF_MS, pedestrianWalkOff } from './eventPlacement';

describe('a pedestrian walking clear after the answer', () => {
  it('stands until the event is answered', () => {
    expect(pedestrianWalkOff(1000, 1000, false, null, 5000)).toBe(0);
  });

  it('walks clear in time while the car waits', () => {
    const handledAt = 10_000;
    const stopped = 900; // the car stands short of the crossing and does not move
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt)).toBe(0);
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt + PEDESTRIAN_WALK_OFF_MS / 2)).toBeCloseTo(0.5);
    expect(pedestrianWalkOff(stopped, 1000, true, handledAt, handledAt + PEDESTRIAN_WALK_OFF_MS)).toBe(1);
  });

  it('is never held back by driving on', () => {
    expect(pedestrianWalkOff(1100, 1000, true, 10_000, 10_000)).toBe(1);
  });
});
