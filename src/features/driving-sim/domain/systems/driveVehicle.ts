/**
 * The car, driven: what one frame of input does to it.
 *
 * Speed first, then the surface under it, then where the wheel puts it, then
 * how it sits on the road. The order matters — a narrowing curb is applied
 * after steering, so the road always wins, and the heading is taken last so it
 * follows the position rather than predicting it.
 *
 * Everything here is about the vehicle. Nothing in it knows what a scenario
 * event is, and the only thing it reports is the jolt, because rough ground
 * taken too fast is something the screen has to react to.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { DrivingWorld } from '@/features/driving-sim/domain/world/GameWorld';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import type { InputState } from '@/features/driving-sim/domain/world/InputState';
import {
  BAY_RUN_ON,
  BAY_SPAN,
  ROAD_EFFECT_SPAN,
  applyBrake,
  approachTarget,
  bayOpenAt,
  boundsWithBay,
  laneBounds,
  laneOf,
  roadHeadingAt,
  CAR_WIDTH,
  speedStepFor,
  SCREEN_PX_PER_UNIT,
  type CurveSpan,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drivableBounds } from '@/features/driving-sim/domain/world/routeGeometry';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import {
  CRAWL_PENALTY,
  CRAWL_SPEED_SHARE,
  WRONG_SIDE_PENALTY,
  stepStandingPenalty,
} from '@/features/driving-sim/domain/systems/standingPenalties';
import {
  TUTORIAL_ACCELERATION,
  TUTORIAL_MAX_SPEED,
} from '@/features/driving-sim/domain/systems/tutorial';

/**
 * How hard a closing curb may shove the car back onto the road each frame.
 * Faster than steering, so the road always wins, but slow enough that being
 * squeezed reads as being squeezed rather than as hitting something.
 */
const CURB_PUSH_PER_FRAME = 3.5;

/**
 * How close a following emergency vehicle must be for its lane to be locked.
 * Ranged a little wider than its own approach span so the lane is fixed just
 * before it becomes visible, never during its run.
 */
const CHASE_LOCK_RANGE = 340;

/**
 * The road effect the car is standing in, if any.
 */
const surfaceUnder = (events: ScenarioEvent[], distance: number) =>
  events.find(candidate => {
    if (!candidate.effect) return false;
    const span = candidate.effect.span ?? ROAD_EFFECT_SPAN;
    return Math.abs(distance - candidate.triggerAtDistance) <= span;
  });

export interface DriveVehicleContext {
  world: DrivingWorld;
  level: LevelConfig;
  liveLevel: LevelConfig;
  fsm: DrivingFSM;
  curves: CurveSpan[];
  roadX: number;
  isTutorialLevel: boolean;
  speedProfile: { maxSpeed: number; acceleration: number };
  /** The two standing-penalty events, which the host scores like any other. */
  crawlPenaltyEvent: ScenarioEvent;
  wrongSidePenaltyEvent: ScenarioEvent;
}

export interface DrivenFrame {
  /** Anything the screen must react to. Only the jolt and the two penalties. */
  events: GameEvent[];
  /**
   * The road effect the car was standing in when the frame began.
   *
   * Returned rather than recomputed by the caller, because the car moves during
   * this step: reading it again afterwards would paint the visibility veil from
   * one frame further down the road than the one that slowed the car.
   */
  surface: ScenarioEvent['effect'];
}

/** Advances the car by one frame. */
export const driveVehicle = (input: InputState, context: DriveVehicleContext): DrivenFrame => {
  const events: GameEvent[] = [];
  const {
    world,
    level,
    fsm,
    curves,
    roadX,
    isTutorialLevel,
    speedProfile,
    crawlPenaltyEvent: CRAWL_PENALTY_EVENT,
    wrongSidePenaltyEvent: WRONG_SIDE_PENALTY_EVENT,
  } = context;
  const car = world.car;

  const throttle = input.throttle;
  const braking = input.brake;

  // Before anything moves, so a later pass this frame can compare.
  world.speedAtFrameStart = car.speed;

  // Taps, not holds. The key set stays true for as long as a key is down,
  // so a rising edge is the only way to tell one press from a held one —
  // otherwise auto-repeat would ramp the setting to the top instantly.
  const tappedUp = throttle && !world.prevInput.up;
  const tappedDown = braking && !world.prevInput.down;
  world.prevInput = { up: throttle, down: braking };

  // How much road this level's speeds are worth, and how quickly the car and
  // the wheel answer. The dial is unchanged by it — only the world it moves
  // through. See `DrivingPace`.
  const pace = paceOf(level);
  const maxSpeed = isTutorialLevel ? TUTORIAL_MAX_SPEED : speedProfile.maxSpeed;
  const acceleration = isTutorialLevel
    ? TUTORIAL_ACCELERATION
    : speedProfile.acceleration * pace.accelerationScale;
  const step = speedStepFor(level.speedLimit);

  if (tappedUp) {
    world.targetSpeed = Math.min(maxSpeed, world.targetSpeed + step);
    if (!world.started) {
      world.started = true;
      fsm.transition('start');
    }
  }
  if (tappedDown) {
    world.targetSpeed = Math.max(0, world.targetSpeed - step);
  }

  // The stretch of road the car is currently on. A wet or flooded surface
  // lengthens braking, a gradient pulls at the speed, and a hump throws the
  // car off line if it is taken too fast — so a warning sign is warning
  // about something the driver can feel rather than something they read.
  const surfaceEvent = surfaceUnder(world.events, car.distance);
  const surface = surfaceEvent?.effect;

  // A jammed accelerator. The speed setting is pinned for the whole stretch and
  // tapping it down does nothing, so the throttle stops being a setting the
  // driver owns and becomes the thing going wrong.
  //
  // The brake is untouched on purpose: this is the one mechanical failure in
  // Level 9's module whose correct sequence ends at a pedal that still works,
  // which is why it is driven rather than asked about in a prompt.
  //
  // Two things here are playability rather than simulation, and both were
  // measured before they were changed:
  //
  // - It pins at the **posted limit**, not at `maxSpeed`. Wide open is 1.6x the
  //   limit, and against slow traffic ahead that left under a second between
  //   the failure and an unavoidable impact — a driver reacting at a normal
  //   human 1.0s hit the vehicle in front at 76 km/h, every time.
  // - It **lets go** once the driver has dragged the car down to a crawl
  //   against it. A jam that never releases makes "hold the brake" an
  //   instruction with no end: release and the car surges, hold and the run
  //   stands still at zero and never grades. Recovering it is the lesson, so
  //   recovering it has to be a thing that can finish.
  //
  // Scoped to the *active* event rather than to a distance band, which is the
  // third thing the playtest turned up. A band wide enough to be live when the
  // read panel closes is also live before it opens — the panel waits on the
  // machine, not on a distance — so the car could start pulling while the
  // player had been told nothing at all. Reading it off the event that is being
  // answered makes the failure and its explanation the same moment by
  // construction.
  const jammed = world.activeEvent?.effect?.stuckThrottle === true;
  if (jammed) {
    const crawl = level.speedLimit * CRAWL_SPEED_SHARE;
    if (braking && car.speed <= crawl) world.throttleFreed = true;
    if (!world.throttleFreed) world.targetSpeed = level.speedLimit;
  } else {
    // The event is behind us, so the next jam starts stuck again.
    world.throttleFreed = false;
  }

  // How far into the affected stretch the car is: 0 at its edges, 1 level
  // with the sign. A curb closes in over a distance, and applying the full
  // narrowing the instant the zone begins threw the car sideways with no
  // warning and nothing on screen to explain it.
  const surfaceDepth = surfaceEvent
    ? 1 - Math.abs(car.distance - surfaceEvent.triggerAtDistance) /
          (surfaceEvent.effect?.span ?? ROAD_EFFECT_SPAN)
    : 0;
  const eased = surfaceDepth * surfaceDepth * (3 - 2 * surfaceDepth);

  if (braking) {
    // Holding the brake is still a real brake, and it drags the setting
    // down with it so the car does not surge back the moment you let go.
    car.speed = applyBrake(car.speed, (surface?.grip ?? 1) * pace.brakingScale);
    world.targetSpeed = Math.min(world.targetSpeed, car.speed);
    if (world.started) fsm.transition('brake');
  } else {
    car.speed = approachTarget(car.speed, world.targetSpeed, acceleration);
  }

  if (surface?.gradient) {
    // A climb bleeds speed off and a descent runs away with it, both of
    // them working against whatever the driver has set.
    car.speed = Math.max(0, car.speed + surface.gradient);
  }

  // Taken too fast, rough ground throws the car sideways and costs speed.
  // Only ever declared where the surface it represents is actually drawn —
  // a hump or a broken road — so the driver can see what hit them.
  if (surface?.jarringAbove !== undefined && car.speed > surface.jarringAbove && !world.joltAt) {
    world.joltAt = performance.now();
    car.speed = Math.max(0, car.speed * 0.55);
    world.targetSpeed = car.speed;
    car.x += (Math.random() < 0.5 ? -1 : 1) * 14;
    events.push({ kind: 'jolt' });
  }
  if (!surface) world.joltAt = 0;
  // Keep the machine's IDLE-vs-moving state in step with actual motion,
  // through the FSM's own paired delegates rather than a second inline
  // `transition('accelerate')` that duplicated markVehicleMoving. Each
  // delegate is a no-op unless it has work to do (markVehicleMoving only
  // fires from IDLE, markVehicleStopped only while the run is live), so on
  // the vast majority of frames this pair does nothing at all.
  if (car.speed <= 0) {
    fsm.markVehicleStopped();
  } else {
    fsm.markVehicleMoving();
  }
  // The narrowing arrives gradually across the stretch rather than switching
  // on at its edge, so the curb closes in the way a curb does.
  const narrowsTo = surface?.narrowsTo ? 1 + (surface.narrowsTo - 1) * eased : 1;
  const openSide = surface?.openSide ?? 'centre';
  // A roadside bay opens the curb line for its stretch, so the car can leave
  // the carriageway to stop in it. It eases open the same way a narrowing eases
  // shut.
  //
  // Settled *before* the wheel is applied, because the wheel is how a driver
  // gets out there. This used to be computed afterwards and used only to push
  // the car back, so the limit the wheel obeyed was always the carriageway's:
  // `car.x` could never exceed `laneBounds().max`, `isInBay` asks for six
  // pixels beyond it, and every event graded on `stoppedInBay` was therefore
  // unpassable — the driver was told to pull off the road and then held on it.
  // The bounds below are the same expression as before; what changed is that
  // they are the ones the wheel is clamped to.
  const bayEvent = world.events.find(candidate => {
    if (!candidate.bay) return false;
    const offset = car.distance - candidate.triggerAtDistance;
    return offset >= -BAY_SPAN && offset <= BAY_RUN_ON;
  });
  const bayOpen = bayEvent ? bayOpenAt(car.distance - bayEvent.triggerAtDistance) : 0;

  // The road the level declared, at the point the car is on. An auxiliary lane
  // is drivable road, so the wheel may reach it and the limit that pushes back
  // is its outer edge rather than the through carriageway's.
  // Where the route divides the two, `drivableBounds` gives the corridor the
  // car is actually in rather than the union of both — so a driver on the slip
  // road cannot steer onto the expressway until the nose between them ends.
  const bounds = bayEvent
    ? boundsWithBay(roadX, bayEvent.bay!.side, bayOpen)
    : drivableBounds(
        laneBounds(roadX, narrowsTo, openSide),
        car.x,
        car.distance,
        level.route,
        roadX,
        CAR_WIDTH / 2
      );

  if (input.left) car.x = Math.max(car.x - pace.steerPerFrame, bounds.min);
  if (input.right) car.x = Math.min(car.x + pace.steerPerFrame, bounds.max);

  // Where the road has run out of room the car is pushed back onto it, but
  // pushed — not teleported. Snapping it to the new limit in a single frame
  // read as being slammed sideways by something invisible.
  // An auxiliary lane that runs out is what puts a driver who never merged back
  // on the carriageway: the limit closes with the taper, so the taper is the
  // thing that moves the car rather than an invisible wall beside it.
  if (car.x < bounds.min) car.x = Math.min(bounds.min, car.x + CURB_PUSH_PER_FRAME);
  if (car.x > bounds.max) car.x = Math.max(bounds.max, car.x - CURB_PUSH_PER_FRAME);

  car.lane = laneOf(car.x, roadX);

  // Lock/release the lane a following emergency vehicle is using. Ranged a
  // little wider than its own approach span so the lane is fixed just
  // before it becomes visible, never during its run.
  {
    const chaserAhead = context.liveLevel.events.some(candidate => {
      if (candidate.npc?.path !== 'closing_from_behind') return false;
      const gap = candidate.triggerAtDistance - car.distance;
      return gap <= CHASE_LOCK_RANGE && gap > -CHASE_LOCK_RANGE;
    });
    if (!chaserAhead) {
      world.chaseLane = null;
      // Forget the follower's carried state too, so the next chaser starts
      // fresh on its approach rather than inheriting the last one's y/pass.
      world.followerState.y = null;
      world.followerState.passing = false;
    } else if (world.chaseLane === null) {
      world.chaseLane = car.lane;
    }
  }
  // Lean into the bend. Without this the car tracks a curving road while
  // still pointing dead ahead, which reads as sliding sideways.
  car.heading = roadHeadingAt(car.distance, curves);
  car.distance += car.speed * pace.distancePerSpeed;
  // The lane paint scrolls on the same scale as everything else drawn on the
  // road: one route unit is SCREEN_PX_PER_UNIT pixels. It used to advance by
  // speed * 0.3, which ran the paint about 12x faster than the roadside (20x
  // on Level 7's pace). Change the shared scale or the pace to change the
  // feel, never the paint alone.
  world.roadOffset = car.distance * SCREEN_PX_PER_UNIT;

  // Standing penalties: things the driver keeps doing, rather than a
  // decision at an event. Both run the same grace/interval/cap machinery
  // (domain/systems/standingPenalties); only what counts as the offence
  // differs, and that is the part that depends on this road.
  const now = performance.now();
  // A zone being measured is not a clear road, whether or not its approach has
  // opened yet: theta decides when a scenario is announced, and must not decide
  // whether the driving inside its zone is charged as a standing offence. Nor
  // is a zone whose verdict has already landed: a stop that passes early is
  // still a car waiting at the stop, and a forbidden stop that fails early is
  // still a car the correction has just halted.
  const onClearRoad =
    world.started && !world.activeEvent && !world.measuredEvent && car.distance >= world.settledZoneEnd;

  const crawl = stepStandingPenalty(world.crawl, CRAWL_PENALTY, {
    violating: onClearRoad && car.speed < level.speedLimit * CRAWL_SPEED_SHARE,
    now,
  });
  // Quiet: scored and logged, but silent on screen. The amber
  // `crawlWarning` banner below is the single cue for crawling, so the
  // penalty no longer also raises a toast, a correction card and a shake
  // every few seconds the brake is held.
  if (crawl.charge) events.push({ kind: 'penalty', event: CRAWL_PENALTY_EVENT, action: 'brake' });
  world.crawlWarning = crawl.warning;

  // Only on levels whose carriageway actually has an oncoming side to be
  // wrong about.
  const oncomingLanes = level.paint?.oncomingLanes ?? 0;
  const wrongSide = stepStandingPenalty(world.wrongSide, WRONG_SIDE_PENALTY, {
    violating: onClearRoad && oncomingLanes > 0 && car.lane < oncomingLanes,
    now,
  });
  // Quiet, exactly like the crawl penalty above: scored and logged, but the
  // always-on banner below is the single on-screen cue, not a toast/card.
  if (wrongSide.charge) events.push({ kind: 'penalty', event: WRONG_SIDE_PENALTY_EVENT, action: 'accelerate' });
  world.wrongSideWarning = wrongSide.warning;

  return { events, surface };
};
