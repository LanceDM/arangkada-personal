/**
 * The scenario vehicles that drive themselves.
 *
 * Every other scripted vehicle in the game is a pure function of the player's
 * own distance: it is somewhere *because* the player is somewhere, which is all
 * a right-of-way situation needs. A following gap needs more than that. A lead
 * vehicle whose position is a function of yours cannot be given more room by
 * slowing down — the gap it leaves you depends on where you are, not on how
 * fast you got there — and "leave two seconds" is exactly the thing that has to
 * be answerable with the pedals.
 *
 * So these carry their own road distance, advanced one frame at a time, at
 * their own speed. Pure and frame-driven, like the standing penalties: it takes
 * the state it advances rather than owning it, reads no clock and knows nothing
 * about React, the canvas or scoring. `DrivingSession` owns the state; the
 * scene reads where each vehicle has got to and draws it there.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { resolveLaneRole, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import {
  DEFAULT_PACE,
  paceOf,
  secondsForUnits,
  unitsForSeconds,
  type DrivingPace,
} from '@/features/driving-sim/domain/world/DrivingPace';

/** One scenario vehicle, mid-journey. */
export interface TrafficVehicle {
  /** How far along the route it has got. */
  distance: number;
  /** Its speed right now, in km/h — the same unit the player's is in. */
  speed: number;
  /**
   * It is shedding speed this frame. The scene turns this into the brake lights
   * the driver behind is entitled to see *before* the gap closes, which is the
   * difference between a fair following-distance test and an ambush.
   */
  braking: boolean;
  /**
   * The lane it joined in, for a `travelling_ahead` vehicle whose scenario
   * names none: the lane the car was in at that moment (`joiningLane`), kept
   * from then on. A scenario that says the vehicle is in your lane means the
   * lane you are in, which no fixed lane is on every road it is played on.
   */
  lane?: LaneIndex;
}

/** Every self-driving vehicle on the route, keyed by the event that owns it. */
export type RoadTraffic = Map<string, TrafficVehicle>;

/**
 * Road units covered in one frame at a given speed, matching the player's car.
 *
 * Takes the level's pace for exactly that reason: traffic that advanced on the
 * shared arithmetic while the player advanced on a slower one would close on
 * them at the difference between the two, and every headway measured between
 * the two would be measuring that difference rather than the driving.
 */
const perFrame = (speedKph: number, pace: DrivingPace) => speedKph * pace.distancePerSpeed;

/**
 * The gap a lead vehicle joins at when its scenario does not say, in seconds of
 * headway. Far enough to be traffic being caught up with rather than something
 * dropped in front of the car, and close enough to be on screen while the event
 * is being read.
 */
const DEFAULT_ENTRY_HEADWAY = 2.5;

/** Seconds of headway at a given speed, as road units. */
const headwayToUnits = (seconds: number, speedKph: number, pace: DrivingPace) =>
  unitsForSeconds(seconds, speedKph, pace);

/** How far ahead of its event a lead vehicle joins the road, when unspecified. */
const DEFAULT_ENTRY_RANGE = 1000;

/**
 * How far behind the player a vehicle may fall before it is retired. Past 300
 * units it has left the bottom of the frame, so nothing is ever seen to vanish;
 * the margin keeps the last of it off screen before the state goes.
 */
const RETIRE_BEHIND = 340;

/** How fast a scenario vehicle changes speed, in km/h per frame. */
const ACCELERATION = 0.35;
const DECELERATION = 0.7;

/** Speed difference below which a vehicle counts as having settled, in km/h. */
const SETTLED = 0.4;

/**
 * The paths whose vehicles travel under their own power rather than on a script
 * written against the player's position.
 */
const SELF_DRIVING = new Set(['travelling_ahead', 'merging_from_ramp']);

const drivesItself = (event: ScenarioEvent): boolean =>
  event.npc !== undefined && SELF_DRIVING.has(event.npc.path);

/**
 * How far past its own event a vehicle keeps the slower speed.
 *
 * A little past the point the event is graded at. Something it slowed for is
 * behind it by then, so it picks its speed back up and drives on rather than
 * crawling the rest of the level in front of a driver who has already been
 * marked on it.
 */
const SLOW_HOLDS_FOR = 60;

/** The speed this vehicle is aiming for at this point of the player's approach. */
const targetSpeed = (event: ScenarioEvent, level: LevelConfig, playerDistance: number): number => {
  const profile = event.npc?.speed;
  if (!profile) return level.speedLimit;
  const slowing =
    profile.slowsTo !== undefined &&
    playerDistance >= event.triggerAtDistance - (profile.slowsFrom ?? 0) &&
    playerDistance <= event.triggerAtDistance + SLOW_HOLDS_FOR;
  return level.speedLimit * (slowing ? profile.slowsTo! : profile.cruise);
};

/**
 * Advances every self-driving vehicle on the route by one frame, bringing the
 * ones that have come into range onto the road and retiring the ones that have
 * fallen out the back of the frame.
 *
 * Mutates `traffic` in place, for the same reason the world is mutated in
 * place: this runs sixty times a second and rebuilding a map each frame buys
 * nothing.
 */
export const advanceRoadTraffic = (
  traffic: RoadTraffic,
  level: LevelConfig,
  events: readonly ScenarioEvent[],
  playerDistance: number,
  /** The lane the car is in, which a lead vehicle naming none joins in. */
  playerLane?: LaneIndex,
  /** The scenario the car is answering now, if any: active or being measured. */
  answering: string | null = null
): void => {
  const pace = paceOf(level);
  for (const event of events) {
    if (!drivesItself(event)) continue;
    const spec = event.npc!;
    const existing = traffic.get(event.id);

    if (!existing) {
      // Only ever joins the road ahead of the player, and only once its event
      // is within range: a vehicle seeded behind would appear in the mirror of
      // a driver who has already passed the place it was meant to be met.
      const range = spec.approachSpan ?? DEFAULT_ENTRY_RANGE;
      const relDist = event.triggerAtDistance - playerDistance;
      if (relDist > range || relDist < 0) continue;
      // One that joins your lane waits until no other scenario is being
      // answered, because that scenario may be what moves the car: Level 12's
      // traffic stop puts it in the curb lane, and a vehicle that joined while
      // the car was still pulling over would be in the lane it had just left.
      const joinsYourLane = spec.path === 'travelling_ahead' && spec.lane === undefined;
      if (joinsYourLane && answering !== null && answering !== event.id) continue;
      traffic.set(event.id, {
        // Measured against the road's limit rather than the player's current
        // speed: where the vehicle joins is a fact about the scenario, not
        // about how fast the driver happened to be going at that instant.
        distance:
          playerDistance +
          headwayToUnits(spec.entryHeadway ?? DEFAULT_ENTRY_HEADWAY, level.speedLimit, pace),
        speed: targetSpeed(event, level, playerDistance),
        braking: false,
        ...(joinsYourLane && playerLane !== undefined
          ? { lane: joiningLane(playerLane, level.paint?.oncomingLanes ?? 0) }
          : {}),
      });
      continue;
    }

    const target = targetSpeed(event, level, playerDistance);
    const gap = target - existing.speed;
    existing.braking = gap < -SETTLED;
    existing.speed =
      gap > SETTLED ? Math.min(target, existing.speed + ACCELERATION)
      : gap < -SETTLED ? Math.max(target, existing.speed - DECELERATION)
      : target;
    existing.distance += perFrame(existing.speed, pace);

    if (playerDistance - existing.distance > RETIRE_BEHIND) traffic.delete(event.id);
  }
};

/**
 * The lane a vehicle travelling ahead is in: the one its scenario names, else
 * the one it joined in (`TrafficVehicle.lane`), else - with no drive to have
 * joined it, a golden sample or a scene test - the lane it would have joined
 * in from where the car is (`joiningLane`).
 *
 * The one answer the scene draws the vehicle from and the following gap is
 * graded against, so the two cannot disagree about whose lane it is in.
 */
export const leadLane = (
  spec: NpcVehicleSpec,
  vehicle: TrafficVehicle | null | undefined,
  oncomingLanes: number,
  playerLane?: LaneIndex
): LaneIndex =>
  spec.lane
    ? resolveLaneRole(spec.lane, oncomingLanes)
    : vehicle?.lane ??
      (playerLane !== undefined ? joiningLane(playerLane, oncomingLanes) : resolveLaneRole('curb', oncomingLanes));

/**
 * The lane a vehicle joins when its scenario says it is in yours: the car's,
 * or, with the car over the center line, the one nearest it on the car's own
 * side. Traffic travelling your way is never in the oncoming lanes.
 */
export const joiningLane = (playerLane: LaneIndex, oncomingLanes: number): LaneIndex =>
  Math.max(playerLane, resolveLaneRole('inner', oncomingLanes)) as LaneIndex;

/**
 * Seconds of headway between the player and the vehicle ahead: how long it
 * would take to reach the point that vehicle is at now.
 *
 * `Infinity` when there is nothing ahead, and when the player is stationary —
 * standing still behind a moving vehicle is not a following-distance offence,
 * and dividing by zero would report it as the worst one possible.
 */
export const headwaySeconds = (
  playerDistance: number,
  playerSpeed: number,
  lead: TrafficVehicle | undefined,
  pace: DrivingPace = DEFAULT_PACE
): number => {
  if (!lead) return Number.POSITIVE_INFINITY;
  const gap = lead.distance - playerDistance;
  if (gap <= 0) return 0;
  if (playerSpeed <= 0) return Number.POSITIVE_INFINITY;
  return secondsForUnits(gap, playerSpeed, pace);
};
