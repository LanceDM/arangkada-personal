/**
 * One drive, advancing.
 *
 * The session owns the authoritative runtime state - the car, the route, the
 * manoeuvre in progress, the scripted traffic - and advances it one frame at a
 * time.
 *
 * What it does not do is as important as what it does. It never touches a
 * canvas: it composes the world and hands the result to whoever is painting.
 * It never scores: when a frame reaches a graded decision it does its own
 * bookkeeping (the event is answered, the zone closes) and reports the decision
 * as a `GameEvent` for the host to grade, which is also what keeps the learner
 * model out of the frame. And it never touches React: the screen reads a
 * `DrivingSnapshot` projected from the world, not the world itself.
 *
 * Mutation is deliberate and contained. A frame runs ~60x/second and cannot
 * rebuild the world; nothing outside this file writes to it.
 *
 * It has no lifecycle of its own. It subscribes to nothing and schedules
 * nothing, so a drive stops simply by not being updated again — the host owns
 * the animation frame and is the only thing that can end one. There is
 * deliberately no `dispose()`.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { getRerollableSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { rerollUpcomingEvents } from '@/features/driving-sim/domain/scenario/pooling';
import type { DrivingCompetency, SupportLevel } from '@/domain/learner/competency';
import type { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import type { FSMState } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { composeWorldFrame, type NpcFrameOptions } from '@/features/driving-sim/domain/world/composeWorldFrame';
import type { SceneFrame } from '@/features/driving-sim/domain/scene/SceneFrame';
import { createDrivingWorld, type DrivingWorld } from '@/features/driving-sim/domain/world/GameWorld';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { resolveCollisions } from '@/features/driving-sim/domain/systems/resolveCollisions';
import { driveVehicle } from '@/features/driving-sim/domain/systems/driveVehicle';
import { advanceRoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import { roadPositionAt } from '@/features/driving-sim/domain/world/routeGeometry';
import { advanceToVerdict } from '@/features/driving-sim/domain/systems/fsmBridge';
import { isTutorial } from '@/features/driving-sim/domain/systems/tutorial';
import { scanEvents } from './scanEvents';
import { CANVAS_HEIGHT, ROAD_EFFECT_SPAN, ROAD_WIDTH, ROUNDABOUT_PATH_RADIUS, distanceToScreenY, laneCentreX, resolveLaneRole, roadXAt, 
  speedProfileFor, laneOf, BAY_WIDTH, SCREEN_PX_PER_UNIT, type CurveSpan, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { roadAtFor } from '@/features/driving-sim/domain/world/eventPlacement';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { generateEnvObjects } from '@/features/driving-sim/domain/world/roadsideScenery';
import { approachMeasurement, computeApproachFloors, gradedExitFor, computeApproachRooms, computeWarningDistances, stoppingDistanceFrom, type ApproachLimits, } from '@/features/driving-sim/domain/systems/eventScheduler';
import { approachTrace, type ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import { parkPose, rampPose, rightOfWayPose, roundaboutPose, turnPose, } from '@/features/driving-sim/domain/systems/maneuvers';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { NO_INPUT, type InputState } from '@/features/driving-sim/domain/world/InputState';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import { snapshotChanged, type DrivingSnapshot } from './DrivingSnapshot';

export { snapshotChanged };
export type { DrivingSnapshot };

export { NO_INPUT };
export type { InputState };

/** The frame to paint, and anything that goes over it. */
export interface DrivingFrame {
  /** The scene the session composed. A presentation layer decides how it looks. */
  scene: SceneFrame;
  /** Red impact flash, 0..1. */
  flash: number;
  /** Weather/visibility veil, 0..1. */
  veil: number;
}

/** How a graded decision came out, once the host has scored it. */
export interface DecisionOutcome {
  isCorrect: boolean;
  /**
   * The competency the learner is now weakest on, from the history the decision
   * just joined. The world re-rolls upcoming content when this changes.
   */
  weakCompetency: DrivingCompetency | null;
}

export interface DrivingSessionOptions {
  level: LevelConfig;
  fsm: DrivingFSM;
  /** Road distance the drive starts from. Dev-only; real play starts at 0. */
  initialDistance?: number;
  /** Which signs the learner still needs, for a mid-drive re-roll. */
  signCoverage: SignCoverage;
  /**
   * The support level h this level entry is played at. The session hands it to
   * the frame's composition and nowhere else: it decides whether the road marks
   * the response being graded, and never a solid, a grade, theta or
   * the machine. Omitted means `full`, the baseline machine.
   */
  support?: SupportLevel;
}

/**
 * Never re-roll an event closer than this. Derived from the renderer's own
 * visibility filter (the cutoff is 1300 distance-units ahead) plus a buffer, so
 * a re-roll can never swap a sign's appearance while it is already on screen.
 * Exported for the offline simulation, which re-rolls as a drive does.
 */
export const REROLL_SAFETY_MARGIN = 1400;

/** How long the frame holds on the impact before the results take over. */
export const CRASH_HOLD_MS = 1100;

/**
 * How long the road stands still after a mistake so the correction can be read.
 * Long enough to take in a sentence and the law citation without the drive
 * running out from under the player while they read.
 */
const CORRECTION_HOLD_MS = 3200;

/**
 * How far past a roundabout's centre the player emerges once the decision is
 * answered. The corridor cannot be driven round the central island, so the
 * roundabout is taken during the frozen resolution and the player is set down
 * just beyond it.
 */
const ROUNDABOUT_EXIT_CLEAR = 90;

/**
 * Charged when the car is held at a crawl on open road. Scored through the same
 * pipeline as everything else, but as a standing penalty rather than one of the
 * level's events, so it never counts towards "events cleared".
 */
export const CRAWL_PENALTY_EVENT: ScenarioEvent = {
  id: 'engine.crawl-penalty',
  triggerAtDistance: -1,
  type: 'speed_limit',
  description: 'Crawling on a clear road',
  correctAction: 'accelerate',
  points: 10,
  penaltyMessage:
    'You are holding the brake on clear road. Crawling blocks the traffic behind you and is not safe driving.',
  rewardMessage: '',
  duration: 0,
  competency: 'speed_control',
  severity: 'minor',
};

/**
 * Charged while the car travels in a lane reserved for opposing traffic.
 *
 * On a two-way road the centre line is only worth reading if being on the wrong
 * side of it costs something everywhere, not only at the handful of points the
 * level happens to score. Only charged on clear road: inside an event's window
 * the lane is already being judged by that event, and a legal overtake is
 * exactly the moment crossing the line is the correct answer.
 */
export const WRONG_SIDE_PENALTY_EVENT: ScenarioEvent = {
  id: 'engine.wrong-side-penalty',
  triggerAtDistance: -2,
  type: 'road_marking',
  description: 'Traveling in the oncoming lane',
  correctAction: 'turn_right',
  points: 12,
  penaltyMessage:
    'You are driving in the oncoming lane. Crossing the center line is for overtaking where the marking allows it, not for traveling.',
  rewardMessage: '',
  duration: 0,
  competency: 'lane_discipline',
  severity: 'major',
};

const isFsmState = (state: FSMState, states: readonly FSMState[]) => states.includes(state);

/**
 * How much of the road ahead is still visible at this point of the route.
 *
 * The frozen branch of the frame returns before the surface lookup runs, so the
 * veil needs its own way to ask the same question - otherwise the rain would
 * clear the instant a prompt opened and close again when it was dismissed.
 */
const visibilityAt = (events: ScenarioEvent[], distance: number): number => {
  const weather = events.find(event => {
    if (event.effect?.visibility === undefined) return false;
    return Math.abs(distance - event.triggerAtDistance) <= (event.effect.span ?? ROAD_EFFECT_SPAN);
  });
  return weather?.effect?.visibility ?? 1;
};

export class DrivingSession {
  private readonly level: LevelConfig;
  private readonly fsm: DrivingFSM;
  private readonly curves: CurveSpan[];
  private readonly speedProfile: ReturnType<typeof speedProfileFor>;
  /** Each event's baseline lead, and how far its approach may reach back and must leave, keyed by trigger distance. */
  private readonly limits: ApproachLimits;
  private readonly isTutorialLevel: boolean;
  private readonly initialDistance: number;
  /** What the road may mark of a response; read by the frame's composition only. */
  private readonly support: SupportLevel;
  private signCoverage: SignCoverage;

  private world: DrivingWorld;
  private frame: DrivingFrame | null = null;
  private snapshot: DrivingSnapshot;

  constructor(options: DrivingSessionOptions) {
    this.level = options.level;
    this.fsm = options.fsm;
    this.support = options.support ?? 'full';
    this.curves = curvesForLevel(options.level);
    this.speedProfile = speedProfileFor(options.level.speedLimit);
    this.isTutorialLevel = isTutorial(options.level);
    // The two limits theta is held between, measured once for the whole drive
    // like the warning distances: both are facts about the route, not the frame.
    this.limits = {
      warningDistances: computeWarningDistances(options.level.events),
      approachRooms: computeApproachRooms(options.level.events, this.isTutorialLevel),
      approachFloors: computeApproachFloors(
        options.level.events,
        this.isTutorialLevel,
        stoppingDistanceFrom(options.level.speedLimit, paceOf(options.level))
      ),
    };
    this.initialDistance = options.initialDistance ?? 0;
    this.signCoverage = options.signCoverage;

    // The machine starts every drive from IDLE with an empty transition log.
    // Its learned theta is set separately, by whoever is entering the level, and
    // `reset()` deliberately leaves that alone.
    this.fsm.reset();
    this.world = createDrivingWorld(options.level, this.initialDistance);
    this.world.envObjects = generateEnvObjects(options.level.roadLength, Math.random, options.level.route);
    this.snapshot = project(this.world, options.level, this.curves);
  }

  /** Starts the drive over, on the same level. */
  reset(): void {
    this.fsm.reset();
    this.world = createDrivingWorld(this.level, this.initialDistance);
    this.world.envObjects = generateEnvObjects(this.level.roadLength, Math.random, this.level.route);
    this.frame = null;
    this.snapshot = project(this.world, this.level, this.curves);
  }

  /** What the screen should show. A fresh object each frame; compare with `snapshotChanged`. */
  getSnapshot(): DrivingSnapshot {
    this.snapshot = project(this.world, this.level, this.curves);
    return this.snapshot;
  }

  /** The frame to paint, or null before the first `update`. */
  getFrame(): DrivingFrame | null {
    return this.frame;
  }

  /** The FSM this drive is advancing, for telemetry at the end of the run. */
  getFsm(): DrivingFSM {
    return this.fsm;
  }

  /**
   * What theta did to `event`'s approach on this drive: the theta in force,
   * and the lead the guard fires at once the road's limits have held it.
   *
   * Read from the same measurements the frame reports into the machine, through
   * the same function the guard calls, so it is the lead the approach opened at
   * - or would have, for an event graded before its narrowed approach opened.
   * A query, not a report: it changes nothing, and theta is fixed for a level
   * entry, so it is the same whenever it is asked.
   */
  approachTraceFor(event: ScenarioEvent): ApproachTrace {
    const measured = approachMeasurement(event, this.limits, this.isTutorialLevel);
    return approachTrace(
      { warningDistance: measured.zone.enter, approachRoom: measured.room, approachFloor: measured.floor },
      this.fsm.getTransitionParams()
    );
  }

  /**
   * Applies the host's verdict on the decision the last frame reported.
   *
   * Split from `update` because both halves need something only the other has:
   * the world knows the decision happened, the host knows whether it was right
   * and what it did to the learner's history. Everything the frame itself
   * depends on was already done in `decide`, so this can safely land after it.
   */
  settleDecision({ isCorrect, weakCompetency }: DecisionOutcome): GameEvent[] {
    const { world } = this;
    // Hold the world still just long enough to read the correction. Getting it
    // right needs no explanation, so a good drive is never interrupted.
    if (!isCorrect) world.correctionHoldUntil = performance.now() + CORRECTION_HOLD_MS;

    // Live in-drive adaptation: react to how *this* run is going, not just the
    // prior-level history the initial roll used. Only re-rolls events well
    // beyond the render-visibility window, so nothing changes appearance on
    // screen, and only when the weak competency actually changes.
    const rerollable = getRerollableSlots(this.level.id);
    if (!rerollable || weakCompetency === world.lastWeakCompetency) return [];

    world.lastWeakCompetency = weakCompetency;
    world.weakCompetency = weakCompetency;
    world.events = rerollUpcomingEvents(
      world.events,
      rerollable.slots,
      rerollable.distances,
      world.car.distance,
      REROLL_SAFETY_MARGIN,
      weakCompetency,
      this.signCoverage
    );
    // Only announce when content genuinely just adapted toward a weak area -
    // there is nothing to tell the player when the signal clears back to null.
    if (!weakCompetency) return [];
    // The route ahead has just changed under the player, so the drive is held
    // while they are told which weak area it changed toward and why - but only
    // the first time this run is aimed at that area. The estimate can swing
    // between two competencies answer by answer early on, and a panel per swing
    // would be a drive spent dismissing panels rather than driving.
    if (!world.announcedAdaptations.has(weakCompetency)) {
      world.announcedAdaptations.add(weakCompetency);
      world.adaptationNotice = weakCompetency;
      world.paused = true;
    }
    return [{ kind: 'rerolled', competency: weakCompetency }];
  }

  /**
   * Recomputes the hold from the three things that can be holding the drive.
   *
   * Each of them is released on its own, and more than one can be open at once
   * (an adaptation notice opening on the same frame a decision was settled,
   * say), so releasing one must never release the rest.
   */
  private syncPaused(): void {
    const { world } = this;
    world.paused = Boolean(
      world.inspectionEvent ||
        world.cutsceneEvent ||
        world.adaptationNotice ||
        world.briefingEvent
    );
  }

  /**
   * Player has read the scenario and released the drive. Idempotent.
   *
   * Fires `briefing_dismissed` into the machine, whose only effect is the entry
   * it writes: the reaction clock starts at that entry (`reactionClockMs`), so
   * this is what makes the interval start where the driving starts rather than
   * where the reading did.
   *
   * Releases exactly one hold. `syncPaused` recomputes from all four reasons,
   * so a briefing closing on the same frame an adaptation notice opened leaves
   * the drive held for the notice.
   */
  dismissBriefing(): GameEvent[] {
    const { world } = this;
    if (!world.briefingEvent) return [];
    world.briefingEvent = null;
    this.fsm.transition('briefing_dismissed');
    this.syncPaused();
    return [];
  }

  /** Player acknowledged that the route ahead was adapted. Idempotent. */
  dismissAdaptationNotice(): GameEvent[] {
    const { world } = this;
    if (!world.adaptationNotice) return [];
    world.adaptationNotice = null;
    this.syncPaused();
    return [];
  }

  /** Player picked a Go / No-Go answer at a checkpoint. */
  answerInspection(action: string): GameEvent[] {
    const { world } = this;
    const event = world.inspectionEvent;
    if (!event) return [];

    world.inspectionEvent = null;
    this.syncPaused();
    const events: GameEvent[] = [];
    this.decide(events, event, action, 'question');
    return events;
  }

  /** Player answered a right-of-way, parking or emergency call. */
  answerCutscene(action: string): GameEvent[] {
    const { world } = this;
    const event = world.cutsceneEvent;
    if (!event) return [];

    world.cutsceneEvent = null;
    this.syncPaused();
    world.parkingPlayed = false;
    world.rightOfWayPlayed = false;
    world.rightOfWay = null;

    const events: GameEvent[] = [];
    this.decide(events, event, action, 'question');

    // A roundabout cannot be *driven* on this straight corridor (the island is
    // dead ahead), so once the decision is answered the player is driven round
    // it by a scripted path - approach, circulate, take the exit - and only then
    // handed back to normal driving beyond it, so the vehicle is seen to go
    // through rather than teleporting past.
    if (event.scene === 'roundabout') {
      const car = world.car;
      const roadX = roadXAt(car.distance, this.curves);
      // Exit into the driver's own inner lane, nearest the centre line on their
      // side, not the middle of the road.
      const exitLane = resolveLaneRole('inner', this.level.paint?.oncomingLanes ?? 2);
      world.roundabout = {
        startedAt: performance.now(),
        fromX: car.x,
        fromY: car.y,
        island: {
          x: roadX + ROAD_WIDTH / 2,
          y: distanceToScreenY(event.triggerAtDistance, car.distance),
          r: ROUNDABOUT_PATH_RADIUS,
        },
        exitDistance: event.triggerAtDistance + ROUNDABOUT_EXIT_CLEAR,
        exitLaneX: laneCentreX(exitLane, roadX),
        // The scenario's own route: "turn right" takes the near exit, anything
        // else carries on round to the far one.
        exit: event.correctAction === 'turn_right' ? 'right' : 'straight',
      };
    }
    return events;
  }

  /**
   * Player answered a right-of-way call. Nothing is scored yet: the junction
   * plays out on the canvas first, and only once they have read the verdict
   * does `answerCutscene` commit it. Seeing the other car clear ahead of you,
   * or arrive in the space you took, is what turns a remembered rule into a
   * consequence.
   */
  playRightOfWay(action: string): void {
    const { world } = this;
    const event = world.cutsceneEvent;
    if (!event) return;
    world.rightOfWay = {
      youYield: event.correctAction === 'brake' || event.correctAction === 'stop',
      good: action === event.correctAction,
      startedAt: performance.now(),
      fromDistance: world.car.distance,
      // The roundabout keeps the player parked through the resolution - driving
      // forward here would cross the island.
      holdPlayer: event.scene === 'roundabout',
    };
  }

  /**
   * Player picked a parking technique. Scored only after the car has performed
   * it on the canvas: seeing the tail swing into the space, or the nose bury
   * itself against the curb, is the consequence the question is about.
   */
  playParking(action: string): void {
    const { world } = this;
    const event = world.cutsceneEvent;
    if (!event?.bay) return;

    const car = world.car;
    world.park = {
      good: action === event.correctAction,
      side: event.bay.side,
      startedAt: performance.now(),
      fromX: car.x,
      fromY: car.y,
      bayDistance: event.triggerAtDistance,
    };
  }

  /**
   * Closes out a graded decision: the world's own bookkeeping, done whatever
   * the verdict turns out to be, plus the report the host grades from.
   */
  private decide(
    events: GameEvent[],
    event: ScenarioEvent,
    action: string,
    settlement: DecisionSettlement
  ): void {
    const { world } = this;
    world.handled.add(event.triggerAtDistance);
    world.activeEvent = null;
    world.playerActed = false;
    world.laneCue = null;
    world.requiredLanes = [];
    world.eventPhase = 'approach';
    world.eventApproach = 1;
    // The zone this decision was measured in closes with it. Whatever was being
    // measured belongs to the event being decided - a measurement only opens
    // for the active event or while none is active - so the next one starts
    // from nothing.
    world.measuredEvent = null;
    world.telemetry = null;
    // The road stays the zone's until the car leaves it, whenever the verdict
    // landed (`settledZoneEnd`).
    const { zone } = approachMeasurement(event, this.limits, this.isTutorialLevel);
    world.settledZoneEnd = Math.max(world.settledZoneEnd, event.triggerAtDistance + gradedExitFor(event, zone));
    // Part of closing the decision out, not of grading it: the verdict the host
    // is about to return can only be logged from inside the event, and nothing
    // else takes the machine there once the event has been settled and cleared.
    // Left undone, an answer given early stranded the machine in
    // APPROACHING_EVENT — which has no verdict edge and no event trigger out of
    // it — so the decision went unrecorded and every later event's approach was
    // refused until the car happened to come to rest.
    advanceToVerdict(this.fsm, event.type);
    events.push({ kind: 'decision', event, action, settlement });
  }

  update(input: InputState): readonly GameEvent[] {
    const events: GameEvent[] = [];
    const {
      world,
      level,
      curves,
      fsm,
      isTutorialLevel,
      speedProfile,
      limits,
    } = this;
    if (world.finished) return events;

    const car = world.car;
    // The level with the live (possibly re-rolled) events swapped in, which is
    // how the world sees a re-roll without the config itself ever changing.
    const liveLevel: LevelConfig = { ...level, events: world.events };
    // Where the road is at the point of the route the car is standing on. On a
    // bend this moves under the car, which is what makes holding a lane an act
    // of steering rather than of doing nothing.
    const roadX = roadXAt(car.distance, curves);

    /**
     * Composes the frame and records what should be painted over it. Composing
     * is what advances the scripted vehicles, so it happens exactly once per
     * frame; the host paints from the result afterwards. A branch only ever
     * varies `advance` (the frozen right-of-way resolution) or `followerState`
     * (ordinary driving).
     */
    const composeFrame = (
      npc: NpcFrameOptions = {},
      overlay: { flash?: number; veil?: number } = {}
    ) => {
      const composed = composeWorldFrame(
        { level: liveLevel, distance: car.distance, handled: world.handled, curves, support: this.support },
        {
          chaseLane: world.chaseLane ?? undefined,
          playerLane: car.lane,
          playerSpeed: car.speed,
          traffic: world.traffic,
          ...npc,
        }
      );
      this.frame = {
        scene: {
          car,
          roadOffset: world.roadOffset,
          envObjects: world.envObjects,
          curves,
          level: liveLevel,
          nodes: composed.nodes,
          colliders: composed.colliders,
          roadAt: roadAtFor(car.distance, curves),
        },
        flash: overlay.flash ?? 0,
        veil: overlay.veil ?? 0,
      };
      return composed.colliders;
    };

    // Crashed: hold the frame on the impact so the player can see what they
    // hit, with the flash fading out, until the results take over.
    if (world.crashed) {
      const elapsed = performance.now() - world.crashAt;
      composeFrame({}, { flash: Math.max(0, 0.55 * (1 - elapsed / CRASH_HOLD_MS)) });
      return events;
    }

    // Turning: the car swings out of the lane and off the side of the frame,
    // then the road hands over -- the street being turned into becomes the
    // road being driven. Input, events and collisions are all suspended for
    // the duration, so the turn always completes once it is committed.
    const turn = world.turn;
    if (turn) {
      const pose = turnPose(turn, performance.now() - turn.startedAt);
      car.x = pose.x;
      car.y = pose.y;
      car.heading = pose.heading;

      composeFrame();

      if (pose.done) {
        world.turn = null;
        car.heading = 0;
        car.y = CANVAS_HEIGHT - 120;
        // You come out of the turn on the near side of the new road — but
        // "near side" means the nearest lane that is actually yours. On a
        // two-way carriageway lane 0 belongs to opposing traffic, so landing
        // a left turn there put the car on the wrong side of the road and
        // started charging it for being there, for doing the turn correctly.
        const nearsideLane = Math.min(2, level.paint?.oncomingLanes ?? 0) as 0 | 1 | 2;
        // A manoeuvre that named the lane it hands over into gets that one: a
        // ramp leads to the outside of the road it joins, not to the middle of
        // a cross street.
        car.lane = turn.exitLane ?? (turn.dir === -1 ? nearsideLane : 2);
        car.x = laneCentreX(car.lane, roadX);
        // Far enough past the junction that it is behind you rather than
        // sliding back into view on the road you are now driving.
        car.distance = turn.exitDistance;
        // The roadside is regenerated rather than shifted, because this is a
        // different street now. Carrying the old scenery across made the
        // hand-off read as the world jumping 85px sideways; replacing it
        // makes the same jump read as having arrived somewhere else.
        world.envObjects = generateEnvObjects(level.roadLength, Math.random, level.route);
        // The lane dashes keep their phase, so at least the paint under the
        // car is continuous through the change.
      }

      return events;
    }

    // Roundabout: the answered decision hands over to a scripted trip round
    // the island. The road is frozen (the island stays put on screen) while
    // the car approaches, circulates and takes the exit; then it is set down
    // beyond the roundabout and normal driving resumes — so the vehicle is
    // seen to go *through* rather than teleporting past.
    const roundabout = world.roundabout;
    if (roundabout) {
      const pose = roundaboutPose(roundabout, performance.now() - roundabout.startedAt);
      car.x = pose.x;
      car.y = pose.y;
      car.heading = pose.heading;

      composeFrame();

      if (pose.done) {
        world.roundabout = null;
        car.heading = 0;
        car.y = CANVAS_HEIGHT - 120;
        car.lane = resolveLaneRole('inner', level.paint?.oncomingLanes ?? 2);
        // Set down beyond the island so it is behind, in the same lane the
        // pose finished in — so there is no sideways snap — and give the exit
        // road fresh scenery, since you have come out somewhere new.
        car.distance = roundabout.exitDistance;
        car.x = roundabout.exitLaneX;
        world.envObjects = generateEnvObjects(level.roadLength, Math.random, level.route);
      }

      return events;
    }

    // Parking: the technique has been chosen and the car is now performing
    // it, on this canvas, at the actual space. The road is frozen underneath
    // — only the car moves — so the manoeuvre is read as a manoeuvre rather
    // than as more driving.
    const park = world.park;
    if (park) {
      // Where the space is on screen. The road is frozen for the manoeuvre,
      // so this is constant; it is recomputed each frame only because the
      // player's distance is the only thing that defines it.
      const pose = parkPose(park, performance.now() - park.startedAt, {
        x: park.side === 'right' ? roadX + ROAD_WIDTH + BAY_WIDTH / 2 : roadX - BAY_WIDTH / 2,
        y: distanceToScreenY(park.bayDistance, car.distance),
      });
      car.x = pose.x;
      car.y = pose.y;
      car.heading = pose.heading;

      composeFrame();

      if (pose.done) {
        world.park = null;
        world.parkingPlayed = true;
      }

      return events;
    }

    // Held on a correction: the scene stays painted and the car stays where
    // it stopped, but nothing advances, so the explanation is not competing
    // with the road for attention.
    if (performance.now() < world.correctionHoldUntil) {
      composeFrame();
      return events;
    }

    // Held at a checkpoint: keep painting the scene, but freeze physics,
    // distance and event scanning until the player answers.
    if (world.paused) {
      // A right-of-way answer plays the junction out on this canvas rather
      // than in a diagram over it: the player is held still and the other
      // vehicle is advanced on its own clock, then the player is driven
      // through. Everything else about the frame is unchanged, so the road,
      // the lanes and the sprites are the ones they have been driving on.
      const yielding = world.rightOfWay;
      let npcAdvance = 0;
      let impact = 0;
      if (yielding) {
        const pose = rightOfWayPose(yielding, performance.now() - yielding.startedAt);
        impact = pose.impact;
        const travelled = car.distance;
        car.distance = yielding.fromDistance + pose.playerAdvance;
        // Same scale as driveVehicle: the paint moves with the distance.
        if (car.distance > travelled) world.roadOffset = car.distance * SCREEN_PX_PER_UNIT;
        if (pose.done) {
          world.rightOfWay = null;
          world.rightOfWayPlayed = true;
        }
        // The scene places a scripted NPC at (the distance it is handed) +
        // (this advance), and the distance it is handed here is car.distance
        // — which this branch has just set to fromDistance + playerAdvance,
        // because that is also what positions the junction itself on screen
        // as the player drives through it.
        //
        // A "held" NPC (npcAdvance 0 — it already yielded, or the priority
        // was the player's) is supposed to sit exactly where it was when the
        // sim froze, for the whole resolution. Passing pose.npcAdvance
        // straight through does not do that: car.distance is moving under
        // it via playerAdvance, so the NPC's own position — which is always
        // computed as a function of that shared distance, the same way it
        // is during ordinary driving — silently drifts by the same amount,
        // and a "held" vehicle instead keeps sweeping across the junction as
        // if it were still crossing. Subtracting playerAdvance here cancels
        // exactly that drift, so what the scene adds to car.distance nets
        // out to fromDistance + pose.npcAdvance — the NPC's own progress
        // from the freeze point, with the player's movement backed out.
        npcAdvance = pose.npcAdvance - pose.playerAdvance;
      }

      composeFrame(
        // The follower is handed in so it is drawn where it was, and `frozen`
        // stops it being advanced past that: a vehicle carrying its own motion
        // must not cover ground in the time the driver spends reading.
        { advance: npcAdvance, followerState: world.followerState, frozen: true },
        {
          flash: impact > 0 ? 0.5 * impact : 0,
          veil: 1 - (visibilityAt(world.events, car.distance) ?? 1),
        }
      );
      return events;
    }

    const driven = driveVehicle(input, {
      world,
      level,
      liveLevel,
      fsm,
      curves,
      roadX,
      isTutorialLevel,
      speedProfile,
      crawlPenaltyEvent: CRAWL_PENALTY_EVENT,
      wrongSidePenaltyEvent: WRONG_SIDE_PENALTY_EVENT,
    });
    events.push(...driven.events);

    // Crossing onto an exit ramp. Applied after the car has been driven rather
    // than instead of driving it: the road is still coming, the speed is still
    // the driver's, and only the wheel is taken over for the four hundred units
    // it takes to cross. Nothing is frozen, nothing teleports, and the car never
    // leaves the frame — all three of which the junction turn this replaced did.
    //
    // Measured in road rather than in time, so the line the car follows is the
    // ramp's own whatever speed it is taken at.
    if (world.ramp) {
      const pose = rampPose(world.ramp, car.distance);
      car.x = pose.x;
      car.heading = pose.heading;
      car.lane = laneOf(car.x, roadX);
      if (pose.done) {
        world.ramp = null;
        car.heading = 0;
      }
    }

    // The scenario's own moving traffic, advanced once, before anything reads
    // it. Deliberately after the car and before the scan: the gap the scan
    // grades is the gap as it stands at the end of this frame, and composing
    // the frame afterwards draws the same vehicles at the same distances.
    advanceRoadTraffic(
      world.traffic,
      liveLevel,
      world.events,
      car.distance,
      car.lane,
      (world.activeEvent ?? world.measuredEvent)?.id ?? null
    );

    events.push(
      ...scanEvents(input, {
        world,
        level,
        fsm,
        roadX,
        isTutorialLevel,
        limits,
        decide: (into, event, action, settlement) => this.decide(into, event, action, settlement),
        isFsmState,
      })
    );

    // A scenario that has just taken the approach opens its briefing, which is
    // a fourth reason the drive can be held. Recomputed rather than assigned,
    // so opening one never clears another.
    this.syncPaused();

    // The world's own solids, composed alongside the frame that draws them.
    // The veil goes over everything, because that is what poor visibility is:
    // not a change to the road but a limit on how much of it reaches the driver.
    // What the weather hides is still solid, which is the reason to slow for it.
    const collidables = composeFrame(
      { followerState: world.followerState },
      { veil: driven.surface?.visibility !== undefined ? 1 - driven.surface.visibility : 0 }
    );

    // Traffic, pedestrians and barriers are solid, and hitting one ends the
    // run there and then rather than costing points.
    const impact = resolveCollisions(car, collidables);

    if (impact) {
      world.crashed = true;
      world.crashAt = performance.now();
      car.speed = 0;
      fsm.transition('crash');

      const crashReason =
        impact.kind === 'pedestrian'
          ? `You drove into ${impact.label}. A pedestrian already crossing has the right of way, and striking one ends the run whatever your score.`
          : `You drove into ${impact.label}. Traffic already on the road has priority; you must wait for the gap before entering.`;

      events.push({ kind: 'crashed', reason: crashReason });
      return events;
    }

    if (car.distance >= level.roadLength) {
      fsm.transition('level_end');
      world.finished = true;
      events.push({ kind: 'finished' });
      return events;
    }

    return events;
  }
}

/** The world, projected down to what the screen shows. */
const project = (
  world: DrivingWorld,
  level: LevelConfig,
  curves: CurveSpan[] = []
): DrivingSnapshot => ({
  speed: world.car.speed,
  targetSpeed: world.targetSpeed,
  progress: world.car.distance / level.roadLength,
  lane: world.car.lane,
  requiredLanes: world.requiredLanes,
  activeEvent: world.activeEvent,
  eventPhase: world.eventPhase,
  eventApproach: world.eventApproach,
  laneCue: world.laneCue,
  gapCue: world.gapCue,
  holdCue: world.holdCue,
  bayCue: world.bayCue,
  coastCue: world.coastCue,
  throttleCue: world.throttleCue,
  inspectionEvent: world.inspectionEvent,
  cutsceneEvent: world.cutsceneEvent,
  briefingEvent: world.briefingEvent,
  roadPosition: roadPositionAt(
    world.car.x,
    roadXAt(world.car.distance, curves),
    world.car.distance,
    level.route
  ),
  adaptationNotice: world.adaptationNotice,
  parkingPlayed: world.parkingPlayed,
  rightOfWayPlayed: world.rightOfWayPlayed,
  crashed: world.crashed,
  holdingForCorrection: performance.now() < world.correctionHoldUntil,
  crawlWarning: world.crawlWarning,
  wrongSideWarning: world.wrongSideWarning,
  weakCompetency: world.weakCompetency,
});

export const createDrivingSession = (options: DrivingSessionOptions): DrivingSession =>
  new DrivingSession(options);
