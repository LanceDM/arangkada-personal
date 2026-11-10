/**
 * What the screen needs to know about the drive, and nothing else.
 *
 * The world is mutated ~60×/second and must never reach React; this is the
 * projection of it that can. It carries only values the DOM shows, so the hook
 * can compare one frame's projection with the last and re-render only when
 * something visible actually changed — the canvas keeps painting either way.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { BayCue, CoastCue, EventPhase, GapCue, HoldCue, LaneCue, ThrottleCue } from '@/features/driving-sim/domain/world/GameWorld';
import type { RoadPosition } from '@/features/driving-sim/domain/world/routeGeometry';

export interface DrivingSnapshot {
  speed: number;
  /** The speed the driver has set, shown beside the speedometer. */
  targetSpeed: number;
  /** The maximum in force where the car is (`limitInForce`), for the HUD. */
  speedLimit: number;
  /** 0..1 along the route. */
  progress: number;
  lane: number;
  requiredLanes: number[];

  activeEvent: ScenarioEvent | null;
  eventPhase: EventPhase;
  /** How far off the active event still is: 1 as it is announced, 0 at it. */
  eventApproach: number;
  laneCue: LaneCue | null;
  /** Live headway to the vehicle ahead, while one is being measured. */
  gapCue: GapCue | null;
  /** Live lateral steadiness, while a scenario is measuring it. */
  holdCue: HoldCue | null;
  /** Live "are you off the road yet", where a scenario is grading that. */
  bayCue: BayCue | null;
  coastCue: CoastCue | null;
  throttleCue: ThrottleCue | null;

  /** A checkpoint holding the drive for a Go / No-Go answer. */
  inspectionEvent: ScenarioEvent | null;
  /** A right-of-way, parking or emergency call holding the drive. */
  cutsceneEvent: ScenarioEvent | null;
  /**
   * The scenario the drive is held on while it is read, or null.
   *
   * Distinct from `activeEvent`, which stays set for the whole of the event's
   * window: this is only the reading, and it is gone the moment the player
   * releases the drive.
   */
  briefingEvent: ScenarioEvent | null;
  /**
   * Where the car is on the road's cross-section, from the route rather than
   * from the lane arithmetic.
   *
   * `lane` alone cannot say this: it clamps a car outside the carriageway to
   * the outermost through lane, so a driver still on the acceleration lane was
   * shown as being in Lane 4 — told they had already done the thing they were
   * about to be graded on.
   */
  roadPosition: RoadPosition;
  /** A live re-roll holding the drive until the player acknowledges it. */
  adaptationNotice: DrivingCompetency | null;
  /** True once a chosen parking technique has finished playing out. */
  parkingPlayed: boolean;
  /** True once the junction has finished playing out under a right-of-way answer. */
  rightOfWayPlayed: boolean;

  crashed: boolean;
  /**
   * Whole seconds of driving left before "time's up", or null where the level
   * has no limit. Counts only steps that drive the car, so it stands still
   * while a panel is open.
   */
  drivingSecondsLeft: number | null;
  /**
   * Whole seconds left on the panel or panels holding the drive, or null when
   * nothing is. At 0 the world closes them: a question goes unanswered.
   */
  panelSecondsLeft: number | null;
  /** True while the road is held still so a correction can be read. */
  holdingForCorrection: boolean;
  crawlWarning: boolean;
  wrongSideWarning: boolean;
  overLimitWarning: boolean;

  /** The competency the drive is currently adapting toward, if any. */
  weakCompetency: DrivingCompetency | null;
}

/**
 * A speed as precisely as the screen can tell two apart: half a km/h, which
 * moves both where the dial rounds and where a whole-number threshold - a
 * merge's minimum - is crossed.
 */
const shownSpeed = (speed: number) => Math.floor(speed * 2);

/**
 * A 0..1 fraction as precisely as the screen shows it: half a percent, which
 * moves both where a percentage rounds and where a whole percent is crossed.
 */
const shownFraction = (fraction: number) => Math.floor(fraction * 200);

/**
 * Whether anything the screen shows changed between two frames.
 *
 * The continuous values - speed, set speed, route progress, the approach bar -
 * change on nearly every frame the car moves, and compared exactly they
 * re-rendered the whole drive screen on nearly every frame, which was most of
 * the drive's cost per frame. They are compared at the precision they are
 * shown at; the snapshot itself still carries them exactly.
 */
export const snapshotChanged = (a: DrivingSnapshot, b: DrivingSnapshot): boolean =>
  shownSpeed(a.speed) !== shownSpeed(b.speed) ||
  shownSpeed(a.targetSpeed) !== shownSpeed(b.targetSpeed) ||
  a.speedLimit !== b.speedLimit ||
  shownFraction(a.progress) !== shownFraction(b.progress) ||
  a.lane !== b.lane ||
  a.activeEvent !== b.activeEvent ||
  a.eventPhase !== b.eventPhase ||
  shownFraction(a.eventApproach) !== shownFraction(b.eventApproach) ||
  a.laneCue !== b.laneCue ||
  a.gapCue !== b.gapCue ||
  a.holdCue !== b.holdCue ||
  a.bayCue !== b.bayCue ||
  a.coastCue !== b.coastCue ||
  a.throttleCue !== b.throttleCue ||
  a.inspectionEvent !== b.inspectionEvent ||
  a.cutsceneEvent !== b.cutsceneEvent ||
  a.briefingEvent !== b.briefingEvent ||
  a.roadPosition.place !== b.roadPosition.place ||
  a.roadPosition.lane !== b.roadPosition.lane ||
  a.roadPosition.crossingOpen !== b.roadPosition.crossingOpen ||
  a.adaptationNotice !== b.adaptationNotice ||
  a.parkingPlayed !== b.parkingPlayed ||
  a.rightOfWayPlayed !== b.rightOfWayPlayed ||
  a.crashed !== b.crashed ||
  a.drivingSecondsLeft !== b.drivingSecondsLeft ||
  a.panelSecondsLeft !== b.panelSecondsLeft ||
  a.holdingForCorrection !== b.holdingForCorrection ||
  a.crawlWarning !== b.crawlWarning ||
  a.wrongSideWarning !== b.wrongSideWarning ||
  a.overLimitWarning !== b.overLimitWarning ||
  a.weakCompetency !== b.weakCompetency ||
  a.requiredLanes.length !== b.requiredLanes.length ||
  a.requiredLanes.some((lane, i) => lane !== b.requiredLanes[i]);
