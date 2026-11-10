/**
 * The speed setting moves 5 km/h a tap on every level, and a held Up repeats
 *.
 *
 * A tap used to be a third of the limit: 13 on a 40 km/h road, so tapping down
 * from 39 went 26, 13, 0, and the tutorial's slow zone ("10 km/h or lower")
 * could not be reached by tapping at all. A fixed step lands on every limit,
 * and the repeat keeps a 100 km/h road from being twenty presses away.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import {
  SPEED_REPEAT_DELAY,
  SPEED_REPEAT_EVERY,
  SPEED_STEP,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT } from './DrivingSession';

const level = (id: number) => LEVELS.find(entry => entry.id === id)!;

const realNow = performance.now;
beforeEach(() => {
  performance.now = () => 0;
});
afterEach(() => {
  performance.now = realNow;
});

/** A session on `levelId`, driven by one throttle/brake pattern; the setting after each frame. */
const settings = (levelId: number, frames: Array<{ up?: boolean; down?: boolean }>) => {
  const session = createDrivingSession({ level: level(levelId), fsm: new DrivingFSM(), signCoverage: {} });
  return frames.map(({ up = false, down = false }) => {
    if (session.getSnapshot().briefingEvent) session.dismissBriefing();
    session.update({ ...NO_INPUT, throttle: up, brake: down });
    return session.getSnapshot().targetSpeed;
  });
};

/** `count` taps, each one frame down and three up. */
const taps = (count: number, key: 'up' | 'down') =>
  Array.from({ length: count * 4 }, (_, frame) => ({ [key]: frame % 4 === 0 }));

describe('one tap', () => {
  it('moves the setting 5 km/h, whatever the limit', () => {
    for (const id of [0, 2, 7, 9]) {
      expect(settings(id, [{ up: true }]).at(-1), `Level ${id}`).toBe(SPEED_STEP);
    }
  });

  it('lands on the limit of every level', () => {
    for (const { id, speedLimit } of LEVELS) {
      expect(speedLimit % SPEED_STEP, `Level ${id}`).toBe(0);
      expect(settings(id, taps(speedLimit / SPEED_STEP, 'up')).at(-1), `Level ${id}`).toBe(speedLimit);
    }
  });

  it("reaches the tutorial's slow zone by tapping down from its limit", () => {
    // Down is also the brake, which drags the setting to the car's speed, so
    // the car is let reach its setting before the first tap down.
    const settle = Array.from({ length: 300 }, () => ({}));
    const down = settings(0, [...taps(8, 'up'), ...settle, ...taps(4, 'down')]);
    expect(down.at(-25)).toBe(30);
    expect(down.at(-1)).toBe(10);
  });
});

describe('a held Up', () => {
  it('is one tap until it has been held a quarter of a second, then repeats every tenth', () => {
    const held = settings(7, Array.from({ length: 1 + SPEED_REPEAT_DELAY + 2 * SPEED_REPEAT_EVERY }, () => ({ up: true })));
    expect(held[0]).toBe(5);
    expect(held[SPEED_REPEAT_DELAY - 1]).toBe(5);
    expect(held[SPEED_REPEAT_DELAY]).toBe(10);
    expect(held[SPEED_REPEAT_DELAY + SPEED_REPEAT_EVERY - 1]).toBe(10);
    expect(held[SPEED_REPEAT_DELAY + SPEED_REPEAT_EVERY]).toBe(15);
    expect(held[SPEED_REPEAT_DELAY + 2 * SPEED_REPEAT_EVERY]).toBe(20);
  });

  it("sets Level 7's 100 km/h in a little over two seconds", () => {
    const held = settings(7, Array.from({ length: 130 }, () => ({ up: true })));
    const reached = held.indexOf(100);
    expect(reached).toBeGreaterThan(0);
    expect(reached / 60).toBeLessThan(2.2);
  });

  it('starts counting again from a fresh press', () => {
    const pattern = [
      ...Array.from({ length: SPEED_REPEAT_DELAY - 1 }, () => ({ up: true })),
      { up: false },
      ...Array.from({ length: SPEED_REPEAT_DELAY - 1 }, () => ({ up: true })),
    ];
    // Two presses, each released before its repeat: two taps, no repeat.
    expect(settings(7, pattern).at(-1)).toBe(10);
  });
});
