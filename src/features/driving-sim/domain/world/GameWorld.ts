/**
 * Everything a drive is, at one instant.
 *
 * This is the authoritative runtime state: the car, the route, the manoeuvre in
 * progress, the standing penalties, the cues the HUD shows. One object, so that
 * "the state of a drive" is a thing that can be read, advanced and asserted
 * about without mounting a component.
 *
 * Mutated in place by the simulation systems, deliberately: the frame runs
 * ~60×/second and cannot afford to rebuild it. The mutation is contained — only
 * `DrivingSession` writes here, and React never sees this object, only the
 * snapshot projected from it.
 */
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { EventTelemetry } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import type { EnvObject } from './roadsideScenery';
import {
  CANVAS_HEIGHT,
  ROAD_CENTRE_X,
  laneCentreX,
  laneOf,
  resolveLaneRole,
  type CarState,
  type LaneIndex,
} from './vehiclePhysics';
import {
  createStandingPenaltyState,
  type StandingPenaltyState,
} from '@/features/driving-sim/domain/systems/standingPenalties';
import { isTutorial, tutorialStartX } from '@/features/driving-sim/domain/systems/tutorial';
import { auxiliaryAt, auxiliaryCentreX } from './routeGeometry';
import type {
  ParkManeuverState,
  RightOfWayRun,
  RoundaboutRun,
  RampManeuverState,
  TurnManeuverState,
} from '@/features/driving-sim/domain/systems/maneuvers';

/** Which way the active event is being announced: a heads-up, or act now. */
export type EventPhase = 'approach' | 'react';

export interface LaneCue {
  hint: string;
  inLane: boolean;
}

/**
 * The gap to the vehicle ahead, as the driver is being shown it.
 *
 * Quantised to the tenth of a second it is displayed at, and replaced only when
 * that display value changes, so a requirement measured every frame does not
 * re-render the screen every frame.
 */
export interface GapCue {
  seconds: number;
  /** Whether the gap currently meets the requirement being graded. */
  safe: boolean;
}

/**
 * How steadily the car is being held across the road, while a scenario is
 * measuring that.
 *
 * Quantised the same way the gap is, and for the same reason: a requirement
 * read every frame must not re-render the screen every frame.
 */
export interface HoldCue {
  /** Pixels of wander so far, rounded to something worth showing. */
  drift: number;
  /** Whether it is still inside what the scenario allows. */
  steady: boolean;
}

/**
 * Whether the brake is safe to use yet, while a scenario is grading that.
 *
 * Shown for the same reason the gap and the wander are: a requirement measured
 * every frame and never displayed is one the driver can only find out about by
 * failing it — and this one fails on a single press, so finding out afterwards
 * is finding out too late.
 */
/**
 * A jammed throttle, while one is being driven.
 *
 * The one failure in the game the player cannot see: the car simply accelerates,
 * and without a readout that is indistinguishable from a bug. Every state it
 * reports is a state the driver can act on — the engine is stuck, the brake is
 * holding it, the speed is coming down, it is back under control.
 */
export interface ThrottleCue {
  /**
   * `stuck` — the engine is driving the wheels and nothing is holding it.
   * `braking` — the brake is down against it.
   * `freed` — it has been brought under control and the jam has let go.
   */
  phase: 'stuck' | 'braking' | 'freed';
  /** The speed is actually coming down right now. */
  dropping: boolean;
}

/**
 * Whether the car is off the carriageway yet, while a scenario is grading that.
 *
 * The bay is the one requirement that was measured every frame and shown
 * nowhere. Everything else a scenario can ask for has a readout — the gap, the
 * wander, the lane, the brake — and a bay is graded on one thing only, whether
 * the car came to rest past the edge of the road, so a driver who steered most
 * of the way over and stopped had no way to find out they were still in the
 * lane until the verdict told them.
 */
export interface BayCue {
  /** The car is past the edge of the carriageway, in the bay. */
  inBay: boolean;
  /** And has come to rest there, which is the whole of what is graded. */
  stopped: boolean;
  /** Which side the bay is on, so the readout can say which way to go. */
  side: 'left' | 'right';
}

export interface CoastCue {
  /** True once the car is slow enough that holding the brake is the right answer. */
  safeToBrake: boolean;
  /** Speed the brake becomes free to hold at, for the readout. */
  brakeBelow: number;
  /** True once the brake has already been stood on too fast; the test is lost. */
  lost: boolean;
}

export interface FollowerState {
  /** Screen row last frame, so a follower moves continuously. Null = no history. */
  y: number | null;
  passing: boolean;
}

export interface DrivingWorld {
  // ── The vehicle ──────────────────────────────────────────────────────────
  car: CarState;
  /** Speed the driver has asked for; the car drives to it and holds it. */
  targetSpeed: number;
  /** True once the driver has first touched the throttle. */
  started: boolean;

  // ── The route ────────────────────────────────────────────────────────────
  /** Live, re-rollable copy of the level's events; the config itself never changes mid-run. */
  events: ScenarioEvent[];
  /** Trigger distances already answered. */
  handled: Set<number>;
  roadOffset: number;
  envObjects: EnvObject[];

  // ── The event being answered ─────────────────────────────────────────────
  activeEvent: ScenarioEvent | null;
  playerActed: boolean;
  /**
   * The event whose zone `telemetry` is measuring. Usually the active one, but
   * not always: the zone is fixed on the road while theta moves where the
   * approach opens, so a narrowed approach opens inside a zone that is already
   * being measured, and a widened one is active for a stretch before its zone
   * begins.
   */
  measuredEvent: ScenarioEvent | null;
  /** What the vehicle has done inside `measuredEvent`'s zone. */
  telemetry: EventTelemetry | null;
  eventPhase: EventPhase;
  /** How far off the active event still is: 1 as it is announced, 0 at it. */
  eventApproach: number;
  laneCue: LaneCue | null;
  /** Live headway readout while a following requirement is being measured. */
  gapCue: GapCue | null;
  /** Live lateral steadiness, while a scenario is measuring it. */
  holdCue: HoldCue | null;
  /** Live "are you off the road yet", while a scenario is measuring that. */
  bayCue: BayCue | null;
  /** Live "is the brake safe yet", while a scenario is measuring that. */
  coastCue: CoastCue | null;
  /** Live state of a jammed throttle, while one is being driven. */
  throttleCue: ThrottleCue | null;
  /**
   * The speed the car had when this frame began.
   *
   * Captured by `driveVehicle` before it touches anything, so a later pass in
   * the same frame can tell a car that is slowing from one that is holding a
   * speed. Only the jammed-throttle readout asks, and it asks because "the
   * brake is down" and "the brake is working" are different things to tell a
   * driver who cannot see either.
   */
  speedAtFrameStart: number;
  /**
   * The jammed throttle has been brought under control and has let go.
   *
   * Carried on the world rather than derived per frame because it is a latch:
   * once the driver has dragged the car down to a crawl against a stuck engine,
   * the engine stays freed for the rest of the stretch. Without it, holding the
   * brake is the only thing keeping the car down and releasing it re-pins the
   * throttle — so "hold the brake" is an instruction with no end, and the run
   * sits at a standstill that never grades. Reset on leaving the stretch.
   */
  throttleFreed: boolean;
  requiredLanes: number[];

  // ── Frozen decisions ─────────────────────────────────────────────────────
  /**
   * True while the road is held still and nothing advances — a checkpoint, a
   * cutscene, or an adaptation notice.
   *
   * Derived from the three fields below rather than owned separately: every
   * place that opens one of them sets this, and `DrivingSession` recomputes it
   * from all three when one is dismissed, so a second hold can never be
   * released by the first one ending.
   *
   * An ordinary road event is deliberately not one of them. Guidance for a
   * scenario answered by driving is shown beside the road while the car keeps
   * moving: a panel that stops the world to be read is a panel the player
   * cannot drive around, and one that has to be dismissed is one they can be
   * stuck behind.
   */
  paused: boolean;
  /**
   * The scenario being read before it is driven, or null.
   *
   * A road event answered with the car is announced while the car is still
   * moving, which is the right place for the *situation* and the wrong place
   * for the *reading*. Holding the drive once, at the point the scenario
   * becomes legible and while there is still road left to act in, separates
   * the two: the comprehension is untimed and the response is not.
   *
   * One at a time, and only ever for an event that is genuinely driven —
   * checkpoints, cutscenes and parking decisions already stop the world behind
   * a question of their own and must not be stopped twice.
   */
  briefingEvent: ScenarioEvent | null;
  /** Events already briefed, so one is never held for twice. */
  briefed: Set<string>;
  inspectionEvent: ScenarioEvent | null;
  cutsceneEvent: ScenarioEvent | null;
  /**
   * The competency a live re-roll just adapted the route toward, while the
   * player is being told about it.
   *
   * Held here rather than as a passing banner because the player is being
   * redirected: the content ahead of them has changed, and they acknowledge
   * that before driving into it.
   */
  adaptationNotice: DrivingCompetency | null;
  parkingPlayed: boolean;
  rightOfWayPlayed: boolean;

  // ── Scripted motion the loop hands over to ───────────────────────────────
  turn: TurnManeuverState | null;
  /**
   * Moving across onto an exit ramp. Unlike a turn this freezes nothing — the
   * road keeps coming and the car keeps being driven; only the wheel is taken
   * over while the car crosses onto the ramp's own line.
   */
  ramp: RampManeuverState | null;
  roundabout: RoundaboutRun | null;
  park: ParkManeuverState | null;
  rightOfWay: RightOfWayRun | null;

  // ── Standing penalties ───────────────────────────────────────────────────
  /**
   * Where the zone of the last decision settled ends, on the road. A verdict
   * can land before its zone does - a stop passes the moment it is made - and
   * the road is not clear until the car has driven out of the zone, so waiting
   * at the stop for what the scenario is about is never a standing offence.
   */
  settledZoneEnd: number;
  crawl: StandingPenaltyState;
  wrongSide: StandingPenaltyState;
  crawlWarning: boolean;
  wrongSideWarning: boolean;

  // ── Holds and effects ────────────────────────────────────────────────────
  /** While this is in the future the road stands still so a correction can be read. */
  correctionHoldUntil: number;
  /** When rough ground last threw the car about, so it fires once per stretch. */
  joltAt: number;
  /** Last frame's throttle/brake, for telling a tap from a hold. */
  prevInput: { up: boolean; down: boolean };
  /**
   * The steering keys as they were last frame, so a manoeuvre can ask for a
   * fresh press rather than a held one.
   *
   * A driver holding right to reach the deceleration lane is steering. Reading
   * that as a commitment took the ramp at whichever frame the speed gate
   * happened to clear, which is not a point on the road at all.
   */
  prevSteer: { left: boolean; right: boolean };

  // ── Scripted traffic ─────────────────────────────────────────────────────
  /**
   * The lane an emergency vehicle closing from behind has committed to. Taken
   * once, the frame it comes into range, and released when it is gone: it must
   * not track the player's lane live, because a vehicle that followed them
   * across the carriageway could never be moved out of the way, which is the
   * single thing the event asks for.
   */
  chaseLane: LaneIndex | null;
  followerState: FollowerState;
  /**
   * Where each self-driving scenario vehicle has got to, keyed by its event.
   *
   * Owned here rather than by the scene because it is the one piece of traffic
   * that persists between frames: a lead vehicle travels at its own speed, so
   * its position is a running total rather than a function of the player's.
   * `advanceRoadTraffic` moves it once per frame, before anything reads it.
   */
  traffic: RoadTraffic;

  // ── How the run ends ─────────────────────────────────────────────────────
  crashed: boolean;
  crashAt: number;
  /** True once the run is over; the session stops advancing. */
  finished: boolean;

  // ── Adaptation ───────────────────────────────────────────────────────────
  /** The weak competency the last re-roll was based on, so re-rolls only fire on a change. */
  lastWeakCompetency: DrivingCompetency | null;
  weakCompetency: DrivingCompetency | null;
  /**
   * Weak areas the player has already been told the route was aimed at.
   *
   * The estimate moves after every answer, and early in a drive it can swing
   * between two competencies answer by answer — which is a re-roll each time,
   * and would be a panel to dismiss each time. The player is told about each
   * area the first time the route is aimed at it; the swings back and forth
   * after that re-roll silently, because there is nothing new to say.
   */
  announcedAdaptations: Set<DrivingCompetency>;
}

export const createDrivingWorld = (level: LevelConfig, initialDistance = 0): DrivingWorld => {
  // Spawn inside a lane rather than straddling two, and on your own side. Levels
  // that declare no `paint` still draw as an ordinary two-way street, so the
  // spawn assumes two oncoming lanes: `resolveLaneRole('inner', 2)` lands the
  // car in the rightmost of its own two lanes instead of the oncoming pair.
  //
  // The tutorial is the exception and says so itself: it is a closed practice
  // course with no oncoming half, and it starts in the middle of the road
  // (see `tutorialStartX`).
  // On a two-way street `inner` is the lane nearest the centre line, which is
  // the sensible half of the driver's own side. On a one-way carriageway it is
  // the lane against the median — the overtaking lane — and starting every
  // drive in it means starting in the one lane an expressway's lane table
  // forbids travelling in, then grading the driver for being there before they
  // have touched a control. `middle` is a general-traffic lane on either road.
  const oncoming = level.paint?.oncomingLanes ?? 2;
  const startLane = resolveLaneRole(oncoming > 0 ? 'inner' : 'middle', oncoming);
  // A route that opens with an auxiliary lane starts the drive on it. A level
  // whose first scenario says "you are in the acceleration lane" has to put the
  // car there: saying it while starting the player in an ordinary through lane
  // made the whole merge a description of something that was not happening.
  const openingLane = auxiliaryAt(initialDistance, level.route);
  const startX = isTutorial(level)
    ? tutorialStartX(ROAD_CENTRE_X)
    : openingLane
      ? auxiliaryCentreX(ROAD_CENTRE_X, openingLane)
      : laneCentreX(startLane, ROAD_CENTRE_X);

  return {
    car: {
      x: startX,
      y: CANVAS_HEIGHT - 120,
      speed: 0,
      lane: laneOf(startX, ROAD_CENTRE_X),
      distance: initialDistance,
      heading: 0,
    },
    targetSpeed: 0,
    started: false,

    events: level.events,
    handled: new Set<number>(),
    roadOffset: 0,
    envObjects: [],

    activeEvent: null,
    playerActed: false,
    measuredEvent: null,
    telemetry: null,
    eventPhase: 'approach',
    eventApproach: 1,
    laneCue: null,
    gapCue: null,
    holdCue: null,
    bayCue: null,
    coastCue: null,
    throttleCue: null,
    throttleFreed: false,
    speedAtFrameStart: 0,
    requiredLanes: [],

    paused: false,
    briefingEvent: null,
    briefed: new Set<string>(),
    inspectionEvent: null,
    cutsceneEvent: null,
    adaptationNotice: null,
    parkingPlayed: false,
    rightOfWayPlayed: false,

    turn: null,
    ramp: null,
    roundabout: null,
    park: null,
    rightOfWay: null,

    settledZoneEnd: 0,
    crawl: createStandingPenaltyState(),
    wrongSide: createStandingPenaltyState(),
    crawlWarning: false,
    wrongSideWarning: false,

    correctionHoldUntil: 0,
    joltAt: 0,
    prevInput: { up: false, down: false },
    prevSteer: { left: false, right: false },

    chaseLane: null,
    followerState: { y: null, passing: false },
    traffic: new Map(),

    crashed: false,
    crashAt: 0,
    finished: false,

    lastWeakCompetency: null,
    weakCompetency: null,
    announcedAdaptations: new Set<DrivingCompetency>(),
  };
};
