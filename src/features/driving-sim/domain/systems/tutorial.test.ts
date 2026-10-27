/**
 * The tutorial's own geometry.
 *
 * Level 0 teaches four controls on a closed practice course, and both of the
 * things pinned here broke when the carriageway went from three lanes to four.
 * On the three-lane road the middle lane *was* the centre of the canvas, so
 * "start in your lane" and "start in the middle" were the same sentence, and
 * the steering exercises' targets were that lane's own edges. At four lanes the
 * two came apart: the spawn moved half a lane right of centre, and the
 * right-hand target ended up behind the car at the start line.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { createDrivingWorld } from '@/features/driving-sim/domain/world/GameWorld';
import {
  CANVAS_WIDTH,
  ROAD_CENTRE_X,
  laneBounds,
  type CarState,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { getTutorialCompletedAction, tutorialStartX } from './tutorial';

const tutorial = LEVELS.find(level => level.id === 0)!;
const car = (x: number, speed = 0): CarState => ({ x, y: 0, speed, lane: 2, distance: 0, heading: 0 });

describe('the tutorial start line', () => {
  it('puts the car in the middle of the canvas', () => {
    const world = createDrivingWorld(tutorial);
    expect(world.car.x).toBe(CANVAS_WIDTH / 2);
    expect(world.car.x).toBe(tutorialStartX(ROAD_CENTRE_X));
  });

  it('leaves every other level spawning at a lane centre on its own side', () => {
    // The tutorial is the exception, not a new rule. A level that declares an
    // oncoming half still starts in the nearest lane that is actually its own.
    for (const level of LEVELS.filter(entry => entry.id !== 0)) {
      const { car: spawned } = createDrivingWorld(level);
      const oncoming = level.paint?.oncomingLanes ?? 0;
      expect(spawned.lane, `level ${level.id} spawned on the oncoming side`).toBeGreaterThanOrEqual(
        oncoming
      );
    }
  });
});

describe('the tutorial steering exercises', () => {
  const centre = tutorialStartX(ROAD_CENTRE_X);
  const steerLeft = { ...tutorial.events[0], correctAction: 'turn_left' as const };
  const steerRight = { ...tutorial.events[0], correctAction: 'turn_right' as const };

  it('are both unsatisfied at the start line', () => {
    // The bug: on the four-lane road the car started right of centre, which is
    // already past the old right-hand target — so "steer right" was awarded
    // before the player had touched anything.
    expect(getTutorialCompletedAction(steerLeft, car(centre), ROAD_CENTRE_X)).toBeNull();
    expect(getTutorialCompletedAction(steerRight, car(centre), ROAD_CENTRE_X)).toBeNull();
  });

  it('are each satisfied by steering that way, and only that way', () => {
    const bounds = laneBounds(ROAD_CENTRE_X);
    expect(getTutorialCompletedAction(steerLeft, car(bounds.min), ROAD_CENTRE_X)).toBe('turn_left');
    expect(getTutorialCompletedAction(steerRight, car(bounds.min), ROAD_CENTRE_X)).toBeNull();

    expect(getTutorialCompletedAction(steerRight, car(bounds.max), ROAD_CENTRE_X)).toBe('turn_right');
    expect(getTutorialCompletedAction(steerLeft, car(bounds.max), ROAD_CENTRE_X)).toBeNull();
  });

  it('sets both targets inside the road the car can actually reach', () => {
    const bounds = laneBounds(ROAD_CENTRE_X);
    const reached = (x: number) => x >= bounds.min && x <= bounds.max;
    // A target outside the steerable band is one the exercise can never pass.
    let left = centre;
    while (getTutorialCompletedAction(steerLeft, car(left), ROAD_CENTRE_X) === null && left > 0) left -= 1;
    let right = centre;
    while (getTutorialCompletedAction(steerRight, car(right), ROAD_CENTRE_X) === null && right < CANVAS_WIDTH) right += 1;

    expect(reached(left)).toBe(true);
    expect(reached(right)).toBe(true);
  });
});
