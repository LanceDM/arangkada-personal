/**
 * What makes Level 0 its own thing: a gentler acceleration curve, a shorter
 * top speed, wider action zones so a first-time player has room to react, and
 * its own definition of "done" — completion is read off the car's own state
 * (has it actually turned, actually slowed) rather than graded like every
 * other level's events.
 *
 * Kept separate from the general zone/grading logic in the frame loop rather
 * than folded into it, so a reader can see the whole of what "tutorial mode"
 * means in one place instead of finding it as scattered `isTutorialLevel ? … :
 * …` branches with no shared home.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { LANE_WIDTH, ROAD_WIDTH, type CarState } from '@/features/driving-sim/domain/world/vehiclePhysics';

export const TUTORIAL_ACCELERATION = 0.22;
export const TUTORIAL_MAX_SPEED = 55;
export const TUTORIAL_ACTION_ZONE_ENTER = 180;
export const TUTORIAL_ACTION_ZONE_EXIT = 90;
export const TUTORIAL_SLOW_SPEED = 10;

/** The level whose id makes it the tutorial. One place, so nothing guesses. */
export const TUTORIAL_LEVEL_ID = 0;

export const isTutorial = (level: Pick<LevelConfig, 'id'>): boolean =>
  level.id === TUTORIAL_LEVEL_ID;

/**
 * How far off the middle of the course a steering exercise has to put the car
 * before it counts as done. A full lane width, so the movement is unmistakably
 * a steer rather than drift, and comfortably inside the 25px curb clearance at
 * either end.
 */
export const TUTORIAL_STEER_TRAVEL = LANE_WIDTH;

/**
 * Where the tutorial starts the car: the middle of the carriageway, which is
 * also the middle of the canvas.
 *
 * Every other level spawns at a lane centre on its own side of the road,
 * because every other level is a public road with a side to be on. Level 0 is a
 * closed practice course — it declares no `paint`, so it has no oncoming half,
 * charges no wrong-side penalty, and grades nothing on lane position. Both of
 * its steering exercises ask the learner to move the car *off centre*, which
 * only means anything if it started centred.
 *
 * A four-lane carriageway has no central lane (the middle falls on the line
 * between lanes 1 and 2), so the tutorial states its own start rather than
 * borrowing the lane-centre rule. The general spawn assumed two oncoming lanes
 * for a level that declares none, which put the car half a lane right of the
 * canvas centre and left `steer right` already satisfied at the start line.
 */
export const tutorialStartX = (roadX: number): number => roadX + ROAD_WIDTH / 2;

/**
 * Whether the car has just done what a tutorial step asked, read directly off
 * its state rather than off a keypress — the same "grade what the vehicle
 * actually did" principle every other level's events use, just against a
 * simpler, single-step target instead of a measurement window.
 */
export const getTutorialCompletedAction = (
  event: ScenarioEvent,
  car: CarState,
  roadX: number
): ScenarioEvent['correctAction'] | null => {
  // Measured from the middle of the course, which is where the tutorial starts
  // the car — not from fixed lane edges. Those edges were written for the
  // three-lane road, where the middle lane *was* the centre of the canvas; on
  // the four-lane road they left the right-hand target already satisfied at the
  // start line, so the second steering exercise passed itself.
  const centre = tutorialStartX(roadX);

  if (event.correctAction === 'accelerate') {
    return car.speed >= 8 ? 'accelerate' : null;
  }

  if (event.correctAction === 'turn_left') {
    return car.x <= centre - TUTORIAL_STEER_TRAVEL ? 'turn_left' : null;
  }

  if (event.correctAction === 'turn_right') {
    return car.x >= centre + TUTORIAL_STEER_TRAVEL ? 'turn_right' : null;
  }

  if (event.correctAction === 'brake') {
    return car.speed <= TUTORIAL_SLOW_SPEED ? 'brake' : null;
  }

  if (event.correctAction === 'stop') {
    return car.speed <= 3 ? 'stop' : null;
  }

  return null;
};
