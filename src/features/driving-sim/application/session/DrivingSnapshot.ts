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
  /** True while the road is held still so a correction can be read. */
  holdingForCorrection: boolean;
  crawlWarning: boolean;
  wrongSideWarning: boolean;

  /** The competency the drive is currently adapting toward, if any. */
  weakCompetency: DrivingCompetency | null;
}

/** Whether anything the screen shows changed between two frames. */
export const snapshotChanged = (a: DrivingSnapshot, b: DrivingSnapshot): boolean =>
  a.speed !== b.speed ||
  a.targetSpeed !== b.targetSpeed ||
  a.progress !== b.progress ||
  a.lane !== b.lane ||
  a.activeEvent !== b.activeEvent ||
  a.eventPhase !== b.eventPhase ||
  a.eventApproach !== b.eventApproach ||
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
  a.holdingForCorrection !== b.holdingForCorrection ||
  a.crawlWarning !== b.crawlWarning ||
  a.wrongSideWarning !== b.wrongSideWarning ||
  a.weakCompetency !== b.weakCompetency ||
  a.requiredLanes.length !== b.requiredLanes.length ||
  a.requiredLanes.some((lane, i) => lane !== b.requiredLanes[i]);
