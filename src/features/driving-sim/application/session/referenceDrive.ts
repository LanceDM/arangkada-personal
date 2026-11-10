/**
 * The reference drive: one correct drive of a level, as slow as a correct
 * drive can be. The level's time limit is measured from it.
 *
 * "Correct" is the game's own: every graded decision is scored by the rule
 * engine on what the session reports the car did, and a drive counts only if
 * every one of them is right, nothing is hit, no standing penalty is charged
 * and the road is driven to its end. The driver gets what the full prompt
 * shows a player (h = full): the scenario's move, the lane it is made from,
 * the speed a merge or a minimum asks for. It reads those from the scenario's
 * declared requirement, which is what the prompt is built from, and never
 * from anything a player is not shown.
 *
 * "As slow as it can be" is what makes it the longest correct drive:
 * - on clear road, the slowest speed setting the crawl penalty never charges,
 *   the first 5 km/h step strictly above a quarter of the limit. The car settles on its setting from below, so a setting on the
 *   line itself would read as crawling;
 * - inside a scenario, the slowest setting its grade accepts, a whole step
 *   clear of the line it is read against: the first step over 60% of the
 *   posting to proceed, over 75% of a posted minimum, over a merge's minimum;
 *   and the cruise, or the last step under 60% where that is lower, to slow;
 * - a stop is a full stop, held half a second at rest, then driven on from;
 * - what is in the car's path is crept up to and waited behind, and what
 *   never moves out of it is driven round, on the car's own side of the road;
 * - two things are not the slowest possible, because the slowest may not be
 *   correct: an overtake is made at the posting (the vehicle passed may be
 *   doing nearly the cruise), and a vehicle closing from behind is made way
 *   for once it is there, since it takes the lane the car is in.
 *
 * Every panel is read the step it opens and answered with the correct action,
 * which costs no driving time: the clock does not run while the world is held.
 *
 * Deterministic: the clock is the frame counter and `Math.random` is seeded,
 * as `driveSamples` does, so a drive measures the same steps every time.
 */
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import {
  acceptableLanes,
  slowTarget,
} from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import { CRAWL_SPEED_SHARE } from '@/features/driving-sim/domain/systems/standingPenalties';
import { CHASE_LOCK_RANGE } from '@/features/driving-sim/domain/systems/driveVehicle';
import { isTutorial, TUTORIAL_SLOW_SPEED } from '@/features/driving-sim/domain/systems/tutorial';
import type { ThrottleCue } from '@/features/driving-sim/domain/world/GameWorld';
import {
  CAR_HEIGHT,
  CAR_WIDTH,
  laneCentreX,
  LANE_WIDTH,
  ROAD_WIDTH,
  resolveLaneRole,
  roadXAt,
  screenYToDistance,
  SPEED_STEP,
  type LaneIndex,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { CAR_LENGTH } from '@/features/driving-sim/domain/world/routeGeometry';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';
import { DRIVE_EPOCH, FRAME_MS, rng } from './driveSamples';

/** The states the `answer_correct` / `answer_incorrect` edges leave. */
const GRADEABLE: readonly FSMState[] = ['REACTION_WINDOW', 'INTERSECTION', 'HAZARD', 'DECISION'];

/** The first speed setting strictly above `speed`. */
const stepAbove = (speed: number) => (Math.floor(speed / SPEED_STEP) + 1) * SPEED_STEP;
/** How far over its speed the car may be before it is slowed. */
const SPEED_BAND = 2;

/**
 * The slowest setting the crawl penalty never charges on this level: the
 * reference drive's speed on clear road.
 */
export const referenceCruise = (level: LevelConfig): number => stepAbove(level.speedLimit * CRAWL_SPEED_SHARE);

/** How far ahead a scenario is prepared for: its speed is set before its approach opens. */
const LOOKAHEAD = 700;
/** How far short of a scenario's point a stop is made: inside every approach, short of every line. */
const STOP_SHORT_OF = 45;
/** Pixels either side of the car's own width that count as in its path. */
const PATH_MARGIN = 0;
/**
 * How near, in pixels, something in the car's path may come before the car
 * creeps, and before it stops. A person walking off a driveway moves as the car
 * does, so a car that only ever waited would wait for ever: it creeps until
 * the way is clear, and stops only short of what does not move out of it.
 */
const CREEP_PX = 40;
const STOP_PX = 6;
/** The speed setting a creep is made at. */
const CREEP_SPEED = SPEED_STEP;
/** How near the middle of a lane counts as being in it, in pixels. */
const LANE_TOLERANCE = 4;
/** How near the gap it picked a car going round something has to be, in pixels. */
const DETOUR_TOLERANCE = 1;
/** How long a stop is held at rest, in steps: a full stop, then on through. */
const STOP_HOLD_STEPS = 30;
/** Steps stopped behind something before the car goes round it: it is not moving off. */
const GO_ROUND_AFTER = 120;
/** How far a detour round a stopped obstacle is held before the car returns to its lane. */
const DETOUR_UNITS = 500;
/** Road units beyond an overtake's clearance before the car moves back in. */
const PASS_MARGIN = 40;
/** Road units past the chase lock before the car moves over for what is behind it. */
const CHASE_SETTLED = 30;
/** Pixels kept clear either side of the car when it picks its way round. */
const ROOM_MARGIN = 3;
/** How far from the road's edge the car's centre can go: the wheel's own clamp. */
const CURB_CLEARANCE = 25;
/** A drive that has not ended by now never will: far beyond any level's slowest drive. */
const MAX_FRAMES = 60_000;

export interface ReferenceDecision {
  id: string;
  action: string;
  expected: string;
  correct: boolean;
}

export interface ReferenceDriveResult {
  levelId: number;
  /** World steps of driving: what the time limit counts. */
  drivenSteps: number;
  /** Every frame stepped, held ones included. */
  frames: number;
  finished: boolean;
  /** The crash's reason, or null. */
  crash: string | null;
  decisions: ReferenceDecision[];
  /** Standing penalties charged: a correct drive has none. */
  penalties: number;
}

/** Whether the drive is one the limit may be measured from. */
export const isCorrectDrive = (result: ReferenceDriveResult): boolean =>
  result.finished &&
  result.crash === null &&
  result.penalties === 0 &&
  result.decisions.every(decision => decision.correct);

/** The speed a scenario's grade asks for, as the slowest setting that meets it. */
const scenarioSpeed = (event: ScenarioEvent, level: LevelConfig, cruise: number): number => {
  const posted = event.postedSpeed ?? level.speedLimit;
  if (event.neutral) return cruise;
  if (event.merge) return Math.max(cruise, stepAbove(event.merge.minSpeed));
  if (event.type === 'speed_limit' && event.speedRule === 'minimum') {
    return Math.max(cruise, Math.ceil(posted / SPEED_STEP) * SPEED_STEP);
  }
  // Proceeding is read off the speed at the sign: at or under the slow-down
  // target (`slowTarget`) is slowing for it. A lane, a prohibition or a measured manoeuvre
  // settles the grade before speed is read, so none of them asks for any.
  const speedDecides =
    event.correctAction === 'accelerate' &&
    !event.requiredLane &&
    !event.avoid?.length &&
    !event.maneuver &&
    !event.overtake &&
    !event.lineHold &&
    !event.bay &&
    !event.coast &&
    !event.effect?.stuckThrottle &&
    !event.inspection;
  if (speedDecides) return Math.max(cruise, Math.min(stepAbove(slowTarget(event, level)), posted));
  // Slowing is read the same way, from under the line: where the cruise is
  // still above the slow-down target, the scenario is driven slower than it.
  if (event.correctAction === 'brake' && !event.coast && !event.effect?.stuckThrottle) {
    return Math.min(cruise, Math.max(SPEED_STEP, Math.floor(slowTarget(event, level) / SPEED_STEP) * SPEED_STEP));
  }
  // An overtake is made at the posting, as a pass is: the slower the pass the
  // longer the car sits in the overtaking lane, and the vehicle passed may be
  // doing nearly the cruise itself.
  if (event.overtake) return posted;
  return cruise;
};

/** The lane a scenario wants the car in, or null where it does not care. */
const scenarioLane = (event: ScenarioEvent, level: LevelConfig, lane: LaneIndex): LaneIndex | null => {
  const oncoming = level.paint?.oncomingLanes ?? 0;
  if (event.merge) return resolveLaneRole(event.merge.intoLane, oncoming);
  if (event.inspection?.pullOver) return resolveLaneRole('curb', oncoming);
  const lanes = acceptableLanes(event, level);
  if (!lanes) return null;
  return lanes.includes(lane) ? lane : lanes[0];
};

interface Want {
  speed: number;
  /** The speed is a ceiling the grade reads: held under it, with no band above. */
  atMost?: boolean;
  lane: LaneIndex | null;
  /** Hold the brake whatever the speed: a full stop. */
  stop?: boolean;
  horn?: boolean;
  /** Hold the arrow this way: a turn taken at its point. */
  turn?: 'left' | 'right';
  /** Steer off the carriageway into the bay on this side. */
  bay?: 'left' | 'right';
}

/**
 * Drives `level` correctly from start to end, or as far as the driver gets.
 *
 * `timeLimitSteps` is infinite by default: the limit is measured from this
 * drive, so it must never cut it short.
 */
export const driveReference = (
  level: LevelConfig,
  {
    seed = 1,
    timeLimitSteps = Number.POSITIVE_INFINITY,
    trace,
  }: {
    seed?: number;
    timeLimitSteps?: number;
    /** Called with a line every frame, for finding where a drive goes wrong. */
    trace?: (line: string) => void;
  } = {}
): ReferenceDriveResult => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = DRIVE_EPOCH;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = rng(seed * 7919 + 13);

  const result: ReferenceDriveResult = {
    levelId: level.id,
    drivenSteps: 0,
    frames: 0,
    finished: false,
    crash: null,
    decisions: [],
    penalties: 0,
  };

  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {}, support: 'full', timeLimitSteps });
    const cruise = referenceCruise(level);
    const decided = new Set<string>();
    /** Steps spent at rest for each scenario that asks for a stop. */
    const rested = new Map<string, number>();
    let previous: InputState = NO_INPUT;
    let ended = false;
    /** The lane the drive starts in, which it keeps whenever no scenario asks for another. */
    let ownLane: LaneIndex | null = null;
    let blockedSteps = 0;
    /** A way round something stopped in the car's path: across the road from its edge, and how far. */
    let detour: { offset: number; until: number } | null = null;
    /** Overtakes whose vehicle is already clear behind, so the car is back in its lane. */
    const overtaken = new Set<string>();

    const settleFsm = (correct: boolean) => {
      if (!GRADEABLE.includes(fsm.getState())) return;
      fsm.transition(correct ? 'answer_correct' : 'answer_incorrect');
      fsm.transition('feedback_displayed');
      if (!correct) fsm.transition('recovery_complete');
      fsm.transition('road_clear');
    };

    const drain = (reported: readonly GameEvent[]) => {
      const queue = [...reported];
      while (queue.length > 0) {
        const event = queue.shift()!;
        switch (event.kind) {
          case 'decision': {
            const { isCorrect } = evaluateWeightedRule(event.event, event.action, 0);
            trace?.(`decision ${event.event.id}: ${event.action} (${isCorrect ? 'correct' : 'wrong'}) at ${Math.round(session.getFrame()?.scene.car.distance ?? 0)}, ${session.getSnapshot().speed.toFixed(1)} km/h`);
            decided.add(event.event.id);
            result.decisions.push({
              id: event.event.id,
              action: event.action,
              expected: event.event.correctAction,
              correct: isCorrect,
            });
            settleFsm(isCorrect);
            queue.push(...session.settleDecision({ isCorrect, weakCompetency: null }));
            break;
          }
          case 'penalty':
            result.penalties += 1;
            trace?.(`penalty ${event.event.id} at ${Math.round(session.getFrame()?.scene.car.distance ?? 0)}`);
            break;
          case 'crashed':
            result.crash = event.reason;
            trace?.(`crash: car ${JSON.stringify(session.getFrame()?.scene.car)} bodies ${JSON.stringify(session.getFrame()?.scene.colliders)}`);
            ended = true;
            break;
          case 'timed_out':
            ended = true;
            break;
          case 'finished':
            result.finished = true;
            ended = true;
            break;
          case 'jolt':
          case 'rerolled':
            break;
        }
      }
    };

    for (let frame = 0; frame < MAX_FRAMES && !ended; frame++) {
      clock = DRIVE_EPOCH + frame * FRAME_MS;
      result.frames = frame + 1;

      // Every panel is read the step it opens and answered as the scenario
      // asks. None of it is driving time.
      const waiting = session.getSnapshot();
      if (waiting.adaptationNotice) session.dismissAdaptationNotice();
      if (waiting.briefingEvent) session.dismissBriefing();
      if (waiting.inspectionEvent) drain(session.answerInspection(waiting.inspectionEvent.correctAction));
      else if (waiting.cutsceneEvent) drain(session.answerCutscene(waiting.cutsceneEvent.correctAction));

      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const distance = car?.distance ?? 0;
      const lane = snapshot.lane as LaneIndex;
      ownLane ??= lane;
      const events = scene?.level.events ?? level.events;

      // The scenario in play: the one the world has open, else the next one
      // not yet decided, once it is near enough to set up for.
      const upcoming = events
        .filter(event => !decided.has(event.id) && event.triggerAtDistance + 40 > distance)
        .sort((a, b) => a.triggerAtDistance - b.triggerAtDistance)[0];
      const focus =
        snapshot.activeEvent && !decided.has(snapshot.activeEvent.id)
          ? snapshot.activeEvent
          : upcoming && upcoming.triggerAtDistance - distance < LOOKAHEAD
            ? upcoming
            : null;

      const want: Want = focus
        ? planFor(focus, level, cruise, distance, lane, snapshot.throttleCue)
        : { speed: cruise, lane: null };
      // A stop is made once: held at rest, then released, and the scenario's
      // window is driven out as a driver pulls away from a stop line.
      if (focus && want.stop) {
        const steps = (rested.get(focus.id) ?? 0) + (snapshot.speed <= 0.5 ? 1 : 0);
        rested.set(focus.id, steps);
        if (steps > STOP_HOLD_STEPS) want.stop = false;
      }

      // Nothing in the car's path is ever driven into: whatever stands there
      // is waited behind, as a driver waits.
      const nearest =
        car === undefined
          ? Number.POSITIVE_INFINITY
          : Math.min(
              Number.POSITIVE_INFINITY,
              ...(scene?.colliders ?? [])
                .filter(
                  body =>
                    body.x < car.x + CAR_WIDTH / 2 + PATH_MARGIN &&
                    body.x + body.width > car.x - CAR_WIDTH / 2 - PATH_MARGIN
                )
                .map(body => car.y - CAR_HEIGHT / 2 - (body.y + body.height))
                // Only what is ahead: a wall alongside is not in the way.
                .filter(gap => gap >= 0)
            );
      const blocked = nearest < STOP_PX + snapshot.speed / 2;
      if (nearest < CREEP_PX + snapshot.speed) want.speed = Math.min(want.speed, CREEP_SPEED);

      // Something that stays stopped in the car's path is driven round: to the
      // nearest place across the car's own side of the road with room for the
      // car beside it, which is a gap between the rocks as often as a lane.
      blockedSteps = blocked && snapshot.speed <= 0.5 ? blockedSteps + 1 : 0;
      if (blockedSteps > GO_ROUND_AFTER && car && scene) {
        const roadX = roadXAt(distance, scene.curves);
        const ownSide = roadX + (level.paint?.oncomingLanes ?? 0) * LANE_WIDTH;
        const room = (x: number) =>
          !scene.colliders.some(
            body =>
              body.x < x + CAR_WIDTH / 2 + ROOM_MARGIN &&
              body.x + body.width > x - CAR_WIDTH / 2 - ROOM_MARGIN &&
              body.y < car.y + CAR_HEIGHT &&
              body.y + body.height > car.y - CAR_HEIGHT * 3
          );
        const places: number[] = [];
        for (let x = ownSide + CURB_CLEARANCE; x <= roadX + ROAD_WIDTH - CURB_CLEARANCE; x += 2) places.push(x);
        const round = places.filter(room).sort((a, b) => Math.abs(a - car.x) - Math.abs(b - car.x))[0];
        if (round !== undefined) detour = { offset: round - roadX, until: distance + DETOUR_UNITS };
        blockedSteps = 0;
      }
      if (detour && distance > detour.until) detour = null;

      // Traffic coming up from behind is made way for when it is there, not
      // before: it takes the lane the car is in once it has closed up
      // (`CHASE_LOCK_RANGE` short of the scenario), so the car moves over after.
      if (
        focus?.npc?.path === 'closing_from_behind' &&
        focus.triggerAtDistance - distance > CHASE_LOCK_RANGE - CHASE_SETTLED
      ) {
        want.lane = null;
      }
      // Back to its own lane whenever nothing asks for another, as a driver
      // pulls out again after a stop at the curb; but never across a line a
      // scenario is already measuring the car's hold of.
      const holdingLine = Boolean(focus?.lineHold) && snapshot.activeEvent?.id === focus?.id;
      if (want.lane === null && !holdingLine && !detour) want.lane = ownLane;

      // An overtake: out into the passing lane, past, and back once the vehicle
      // passed is the scenario's clearance behind.
      if (focus?.overtake && car && scene) {
        const oncoming = level.paint?.oncomingLanes ?? 0;
        const passing = resolveLaneRole(focus.overtake.passingLane, oncoming);
        const travel = focus.npc?.lane ? resolveLaneRole(focus.npc.lane, oncoming) : ownLane;
        const travelX = laneCentreX(travel, roadXAt(distance, scene.curves));
        const passedVehicle = scene.colliders.find(
          body => body.kind === 'vehicle' && body.x < travelX && body.x + body.width > travelX
        );
        // Measured as the grade measures it: road distance from the car to
        // the vehicle, read back off where the vehicle stands on screen.
        const behindBy = passedVehicle
          ? distance - screenYToDistance(passedVehicle.y + passedVehicle.height / 2, distance)
          : Number.NEGATIVE_INFINITY;
        if (behindBy >= focus.overtake.clearBy + PASS_MARGIN) overtaken.add(focus.id);
        want.lane = overtaken.has(focus.id) ? travel : passing;
      }

      const roadHere = roadXAt(distance, scene?.curves ?? []);
      const laneX = !car
        ? null
        : want.lane !== null
          ? laneCentreX(want.lane, roadHere)
          : detour
            ? roadHere + detour.offset
            : null;
      // A lane is changed only into room: nothing alongside or just ahead in
      // the strip of road the car would sweep on its way across.
      const sweepClear =
        laneX === null ||
        !car ||
        !(scene?.colliders ?? []).some(body => {
          const from = Math.min(car.x, laneX) - CAR_WIDTH / 2;
          const to = Math.max(car.x, laneX) + CAR_WIDTH / 2;
          const outsideOwnPath = body.x >= car.x + CAR_WIDTH / 2 || body.x + body.width <= car.x - CAR_WIDTH / 2;
          return (
            outsideOwnPath &&
            body.x < to &&
            body.x + body.width > from &&
            body.y < car.y + CAR_HEIGHT &&
            body.y + body.height > car.y - CAR_HEIGHT * 1.5
          );
        });
      const target = sweepClear ? laneX : null;
      // A way round is a gap picked to the pixel; a lane is anywhere near its middle.
      const tolerance = want.lane === null && detour ? DETOUR_TOLERANCE : LANE_TOLERANCE;
      const steer = want.bay
        ? { left: want.bay === 'left', right: want.bay === 'right' }
        : want.turn
          ? { left: want.turn === 'left', right: want.turn === 'right' }
          : target === null || !car
            ? { left: false, right: false }
            : { left: car.x > target + tolerance, right: car.x < target - tolerance };

      const stopping = Boolean(want.stop) || blocked;
      const wanted = stopping ? 0 : want.speed;
      const input: InputState = {
        ...NO_INPUT,
        // Tapped up to the speed wanted, and on past it on a climb that holds
        // the car under its setting, but never far past it.
        throttle:
          !stopping &&
          !previous.throttle &&
          (snapshot.targetSpeed < wanted - 1 || snapshot.speed < wanted - SPEED_BAND) &&
          snapshot.targetSpeed < wanted + 3 * SPEED_STEP,
        // Slowed only when well over: a light touch drags the setting down to
        // the speed, and the next tap would overshoot it.
        brake: stopping
          ? snapshot.speed > 0 || snapshot.targetSpeed > 0
          : snapshot.speed > wanted + (want.atMost ? 0 : SPEED_BAND),
        ...steer,
        horn: Boolean(want.horn),
      };
      previous = input;

      if (trace) {
        const blocker = (scene?.colliders.length ?? 0) > 0
          ? `${blocked ? 'BLOCKED' : 'near'} ${(scene?.colliders ?? []).map(body => `${body.label}@${Math.round(body.x)},${Math.round(body.y)} ${body.width}x${body.height}`).join('; ')} car ${Math.round(car?.x ?? 0)},${Math.round(car?.y ?? 0)}`
          : '';
        trace(`${frame} d=${Math.round(distance)} v=${snapshot.speed.toFixed(1)} lane=${lane} focus=${focus?.id ?? '-'} want=${JSON.stringify(want)} ${blocker} state=${fsm.getState()}`);
      }
      drain(session.update(input));
      result.drivenSteps = session.getDrivenSteps();
    }
    return result;
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

/** What the driver does about the scenario in play. */
const planFor = (
  event: ScenarioEvent,
  level: LevelConfig,
  cruise: number,
  distance: number,
  lane: LaneIndex,
  throttle: ThrottleCue | null
): Want => {
  const toPoint = event.triggerAtDistance - distance;
  const want: Want = { speed: scenarioSpeed(event, level, cruise), lane: scenarioLane(event, level, lane) };

  // The tutorial grades each step on the car alone: a lane's width off the
  // middle for a steer, its slow zone's speed for the brake.
  if (isTutorial(level)) {
    if (event.correctAction === 'turn_left') want.lane = 0;
    if (event.correctAction === 'turn_right') want.lane = 3;
    if (event.correctAction === 'brake') {
      want.speed = TUTORIAL_SLOW_SPEED;
      want.atMost = true;
    }
  }

  // A jammed throttle is held on the brake until it lets go.
  if (event.effect?.stuckThrottle && throttle && throttle.phase !== 'freed') want.stop = true;

  if (event.correctAction === 'honk') want.horn = true;
  if (event.correctAction === 'brake' || (event.type === 'speed_limit' && event.speedRule !== 'minimum')) {
    want.atMost = true;
  }

  // A stop is made short of the point, inside the approach, and held at rest
  // for `STOP_HOLD_STEPS` before the car drives on (in the loop).
  const stops = event.correctAction === 'stop' || Boolean(event.inspection);
  if (stops && !event.bay && toPoint < STOP_SHORT_OF + CAR_LENGTH) want.stop = true;

  if (event.bay && event.correctAction === 'stop' && toPoint < CAR_LENGTH) {
    want.bay = event.bay.side;
    want.stop = toPoint < 0;
  }

  if (event.maneuver && event.correctAction.startsWith('turn_')) {
    const direction = event.correctAction === 'turn_left' ? 'left' : 'right';
    const commitAt = event.maneuver.commitAt;
    const atPoint =
      commitAt === undefined
        ? toPoint <= 100 && toPoint > -10
        : Math.abs(distance + CAR_LENGTH / 2 - commitAt) <= CAR_LENGTH / 2;
    if (atPoint) want.turn = direction;
    if (event.maneuver.maxSpeed !== undefined) want.speed = Math.min(want.speed, event.maneuver.maxSpeed);
  }
  return want;
};
