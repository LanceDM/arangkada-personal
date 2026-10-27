/**
 * Where each of a frame's events stands.
 *
 * One pass per frame, feeding the single scene composition: a placement names
 * the event, the row it stands on, and whether it has already been answered.
 * Everything the renderer paints and everything the collision pass tests is
 * built from these, so neither can put a scene where the other did not.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  CANVAS_HEIGHT,
  distanceToScreenY,
  laneCentreX,
  resolveLaneRole,
  roadXAt,
  screenYToDistance,
  type CurveSpan,
} from './vehiclePhysics';

/** Samples the road's left edge at any screen row, following the bend. */
export type RoadAt = (screenY: number) => number;

/**
 * The road's shape this frame, as a function of screen row.
 *
 * One definition, used by the placement pass and by whoever paints the frame,
 * so paint that runs with the road cannot sample a different curve from the
 * scene it belongs to.
 */
export const roadAtFor = (distance: number, curves: CurveSpan[]): RoadAt =>
  y => roadXAt(screenYToDistance(y, distance), curves);

/**
 * Deterministic, well-distributed left/right pick keyed by event index — avoids
 * the clustering `Math.sin(triggerAtDistance)` produced for nearby distances.
 */
export const pickSide = (index: number): 1 | -1 =>
  ((index * 2654435761) >>> 0) % 2 === 0 ? 1 : -1;

/** Two scenes placed on the same side closer than this are pushed apart. */
const MIN_SIDE_SEPARATION = 70;

/** How far up and down the screen a marking is painted, in screen pixels. */
export const MARKING_REACH = 115;

export interface EventPlacement {
  event: ScenarioEvent;
  /** Position in `level.events`, which is what the side alternation is keyed on. */
  index: number;
  screenY: number;
  roadX: number;
  roadAt: RoadAt;
  /** True once this event has been answered. */
  handled: boolean;
  /**
   * The scene is only still here because its traffic has not finished leaving.
   *
   * The composer keeps the vehicles from such a placement and drops everything
   * else: a scene that outstays its event must not also leave its furniture on
   * the road, because a taper's cones and a gore's fixtures are solid and the
   * driver has already dealt with them.
   */
  runOn: boolean;
}

/**
 * Picks a side for a scene, pushing it away from the last scene placed on the
 * same side.
 *
 * Deliberately lazy and stateful: only the two scenes that actually stand to
 * one side (a road actor with no declared side, and the unknown-hazard glyph)
 * consult it, and only those advance the alternation. Resolving a side for
 * every event instead would shift the sequence every other scene sees.
 */
export type SideResolver = (index: number, screenY: number) => 1 | -1;

export const createSideResolver = (): SideResolver => {
  let last: { side: 1 | -1; screenY: number } | null = null;
  return (index, screenY) => {
    let side = pickSide(index);
    if (last && side === last.side && Math.abs(screenY - last.screenY) < MIN_SIDE_SEPARATION) {
      side = side === 1 ? -1 : 1;
    }
    last = { side, screenY };
    return side;
  };
};

export interface FrameView {
  level: LevelConfig;
  /** The player's road distance, which everything on screen is placed against. */
  distance: number;
  handled: ReadonlySet<number>;
  curves: CurveSpan[];
  /**
   * The support level the level is played at, for the one thing a frame shows
   * that depends on it: whether the road marks the response being graded.
   * It reaches no solid, no grade and no part of the machine.
   * Absent means `full`, the baseline machine, as a missing h does everywhere.
   */
  support?: SupportLevel;
}

/** The support level a frame is composed at. */
export const supportOf = (view: FrameView): SupportLevel => view.support ?? 'full';

/**
 * Centre of one of the driver's own lanes, for a hazard meant to be in their
 * way. Placed by lane *role* rather than by a fixed offset from the canvas
 * centre, so an obstacle never lands in the oncoming lanes on a four-lane road.
 */
export const ownLaneX = (roadX: number, oncomingLanes: number, side: 1 | -1): number =>
  laneCentreX(resolveLaneRole(side === -1 ? 'inner' : 'curb', oncomingLanes), roadX);

/** How much of the carriageway belongs to opposing traffic on this level. */
export const oncomingLanesOf = (level: LevelConfig): number => level.paint?.oncomingLanes ?? 0;

/**
 * Every event close enough to be on screen, farthest first so nearer scenes
 * overlay farther ones, with each one's anchor already resolved.
 *
 * Each scene is anchored to where the road is at *its own* point of the route,
 * not where the road is under the car: on a bend those differ, and using the
 * car's would leave signs, crossings and junctions floating off the asphalt.
 */
/**
 * How far past an answered event its traffic stays placed, in road units.
 *
 * Enough road for a vehicle to leave the top of the frame under its own power.
 * Nothing is kept on screen by this: each path decides its own `active`, and
 * this only stops the composition being taken away while one still says yes.
 */
const VEHICLE_RUN_ON = 340;

/**
 * Whether this scenario's traffic drives on up the road after it is answered.
 *
 * The two cases where the driver is left watching somebody move off: a vehicle
 * pulling out of a side road they were let out of, and a vehicle they were
 * asked to stop behind. Both are scenarios whose answer is "wait" — so the
 * thing waited for has to be seen to go, or the wait had no visible point.
 *
 * Not a lead vehicle in general. One that was merely followed or overtaken is
 * traffic the driver has dealt with, and holding its scene on the board past
 * its own event puts it back in their way.
 */
const runsOn = (event: ScenarioEvent): boolean =>
  event.npc?.emerges === true ||
  (event.npc?.path === 'travelling_ahead' && event.correctAction === 'stop');

export const placeVisibleEvents = (view: FrameView): EventPlacement[] => {
  const visible = view.level.events
    .map((event, index) => ({
      event,
      index,
      screenY: distanceToScreenY(event.triggerAtDistance, view.distance),
    }))
    .filter(({ screenY }) => screenY >= -100 && screenY <= CANVAS_HEIGHT + 50)
    .sort((a, b) => a.screenY - b.screenY);

  const placements: EventPlacement[] = [];
  const roadAt = roadAtFor(view.distance, view.curves);

  for (const { event, index, screenY } of visible) {
    const handled = view.handled.has(event.triggerAtDistance);
    // An answered event that has gone past is off the board entirely.
    //
    // Except where the answer left traffic on the road in front of the
    // driver, still moving off. `updateNpcVehicles` is explicit that a
    // scripted vehicle is part of the world rather than a prop struck the
    // instant the event is scored — it keeps to its path and leaves only once
    // it has actually driven off — and dropping the whole placement fifty
    // units past the trigger defeated that for the two paths that carry on *up
    // the player's own carriageway*: a jeepney let out of a side street pulled
    // onto the road, drove two car lengths and vanished mid-screen, and a
    // school van the driver had stopped behind blinked out the moment the stop
    // was scored. Their own `active` retires them instead.
    //
    // Deliberately these two and no others. A scene kept on the board keeps its
    // furniture too, and the ramps and tapers of an expressway exit are solid:
    // holding those past their event puts cones in the road behind a driver who
    // has already dealt with them.
    const past = event.triggerAtDistance - view.distance;
    const runOn = handled && past < -50;
    if (runOn && !(runsOn(event) && past >= -VEHICLE_RUN_ON)) continue;

    placements.push({ event, index, screenY, roadAt, roadX: roadAt(screenY), handled, runOn });
  }

  return placements;
};

/** How far the pedestrian has walked clear, 0..1, once the event is answered. */
export const pedestrianWalkOff = (distance: number, trigger: number, handled: boolean): number =>
  handled ? Math.min(1, Math.max(0, (distance - trigger + 140) / 200)) : 0;

/** The lane an oncoming vehicle uses on a two-way stretch. */
/** The curb-side edge of the carriageway. */