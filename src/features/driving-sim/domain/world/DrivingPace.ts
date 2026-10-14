/**
 * How fast a level's world moves under the speed on its dial.
 *
 * The dial and the world are two different things, and only one of them is a
 * rule. "60 to 100 km/h" is the law an expressway is graded against and must
 * read exactly that on the speedometer; how much road that eats per frame, how
 * quickly the car gets there and how far the wheel moves it sideways are
 * presentation of the same drive, and they are what decides whether it can be
 * understood at all.
 *
 * Level 7 is why this exists. At the shared pace its road went past at 300
 * units a second — two and a half times Level 6's — while the wheel still moved
 * the car a fixed 2.5px a frame, so a lane change was over in four tenths of a
 * second and a scenario was on top of the driver before it had been read. The
 * answer is not to pretend the limit is 60. It is to drive the same hundred
 * across less road per frame.
 *
 * Every consumer of distance and lateral movement reads this, so the player,
 * the traffic, the headways and the grading all move on one scale. A level that
 * declares nothing gets `DEFAULT_PACE`, which is the arithmetic every level has
 * always used.
 */

export interface DrivingPace {
  /**
   * Route units covered per frame, per km/h on the dial.
   *
   * The projection puts 0.5px on screen per unit, so this is also how fast the
   * road appears to move: 0.05 at 100 km/h is 5 units and 2.5px a frame.
   */
  distancePerSpeed: number;
  /** How far the wheel moves the car sideways in one frame, in pixels. */
  steerPerFrame: number;
  /** Multiplies the acceleration the level's own limit derives. */
  accelerationScale: number;
  /** Multiplies the brake force. Below 1 is a longer, smoother stop. */
  brakingScale: number;
}

/**
 * What every level used before any of this was configurable, and what every
 * level that declares nothing still uses.
 */
export const DEFAULT_PACE: DrivingPace = {
  distancePerSpeed: 0.05,
  steerPerFrame: 2.5,
  accelerationScale: 1,
  brakingScale: 1,
};

/** The pace a level runs at. */
export const paceOf = (level: { pace?: Partial<DrivingPace> }): DrivingPace =>
  level.pace ? { ...DEFAULT_PACE, ...level.pace } : DEFAULT_PACE;

/**
 * Route units covered in a number of seconds at a speed, on a given pace.
 *
 * The one conversion between the two units the game reasons in — a following
 * gap is authored in seconds and measured in units — so it has to take the pace
 * or the two disagree by exactly the factor the pace changed.
 */
export const unitsForSeconds = (seconds: number, speed: number, pace: DrivingPace): number =>
  seconds * 60 * speed * pace.distancePerSpeed;

/** The seconds a gap of this many units represents at this speed. */
export const secondsForUnits = (units: number, speed: number, pace: DrivingPace): number =>
  speed <= 0 ? Number.POSITIVE_INFINITY : units / (60 * speed * pace.distancePerSpeed);
