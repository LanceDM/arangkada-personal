import { describe, expect, it } from 'vitest';
import { PEDESTRIAN_WALK_OFF_STEPS, pedestrianWalkOff } from './eventPlacement';

describe('a pedestrian walking clear after the answer', () => {
  it('stands until the event is answered', () => {
    expect(pedestrianWalkOff(1000, 1000, false, 500)).toBe(0);
  });

  it('walks clear in driving steps while the car waits', () => {
    const stopped = 800; // the car stands short of the crossing and does not move
    expect(pedestrianWalkOff(stopped, 1000, true, 0)).toBe(0);
    expect(pedestrianWalkOff(stopped, 1000, true, PEDESTRIAN_WALK_OFF_STEPS / 2)).toBeCloseTo(0.5);
    expect(pedestrianWalkOff(stopped, 1000, true, PEDESTRIAN_WALK_OFF_STEPS)).toBe(1);
  });

  it('is never held back by driving on', () => {
    expect(pedestrianWalkOff(1100, 1000, true, 0)).toBe(1);
  });

  it('falls back to the distance rule where the frame has no answer time', () => {
    expect(pedestrianWalkOff(800, 1000, true, null)).toBe(0);
  });
});
