/**
 * Where the road is, at any point of the route.
 *
 * A level that declares a `RouteLayout` has a carriageway that changes as it is
 * driven: an acceleration lane that runs out, a deceleration lane that opens
 * and becomes an exit, a verge that turns from planting into barrier. This is
 * the one place that is read from — by the paint, by the drivable bounds, by the
 * scenery generator, by the traffic on the road and by the grading that asks
 * whether the driver got across in time.
 *
 * That matters more than it sounds. The version of Level 7 this replaced drew
 * its acceleration lane as a picture beside a road that did not have one: the
 * car could not drive on it, the merging vehicle was not on it, and the event
 * that said "you are in the acceleration lane" was measuring a car in the
 * ordinary curb lane. One description of the road is what stops that.
 *
 * Pure geometry, like `sceneGeometry`: no clock, no canvas, no event.
 */
import type {
  AuxiliaryLaneRole,
  LaneSeparatorKind,
  RoadsideTheme,
  RouteLayout,
  RouteSegment,
} from '@/features/driving-sim/domain/scenario/scenarioScene';
import { LANE_WIDTH, ROAD_WIDTH, laneOf, type LaneIndex } from './vehiclePhysics';

/**
 * The stretch of route a point falls in, or null off the end of a declared route.
 *
 * Points before the route's first segment take that first segment. The camera
 * sees about 100 units behind the car, so a drive that begins at the start line
 * is always looking at a little road that has no segment of its own; treating
 * it as off-route made the acceleration lane stop dead at the car's own bumper.
 * Past the end is a different matter and stays null — there is no more route.
 */
export const segmentAt = (distance: number, route?: RouteLayout): RouteSegment | null => {
  const segments = route?.segments;
  if (!segments?.length) return null;
  if (distance < segments[0].from) return segments[0];
  return segments.find(segment => distance >= segment.from && distance < segment.to) ?? null;
};

/** What stands beside the road here. An undeclared route is an ordinary street. */
export const roadsideAt = (distance: number, route?: RouteLayout): RoadsideTheme =>
  segmentAt(distance, route)?.roadside ?? 'mixed';

/** The auxiliary lane in force at a point of the route, and how wide it is there. */
export interface AuxiliaryLaneAt {
  role: AuxiliaryLaneRole;
  /** Width in pixels: a full lane in the middle, tapering to nothing at each end. */
  width: number;
}

/**
 * The auxiliary lane at this point, or null where there is none.
 *
 * Width ramps linearly across each taper, which is what makes the lane's own
 * edge a line the driver can see closing rather than a lane that vanishes
 * between frames. A zero-width result is reported as null: a lane you cannot
 * put a wheel on is not a lane.
 */
export const auxiliaryAt = (distance: number, route?: RouteLayout): AuxiliaryLaneAt | null => {
  const segment = segmentAt(distance, route);
  const auxiliary = segment?.auxiliary;
  if (!segment || !auxiliary) return null;

  // Clamped into the segment so a point behind the route's start reads as its
  // opening rather than as a negative way through a taper.
  const at = Math.min(Math.max(distance, segment.from), segment.to);
  const fromStart = at - segment.from;
  const toEnd = segment.to - at;
  const opening = auxiliary.taperIn > 0 ? fromStart / auxiliary.taperIn : 1;
  const closing = auxiliary.taperOut > 0 ? toEnd / auxiliary.taperOut : 1;
  const share = Math.max(0, Math.min(1, opening, closing));
  if (share <= 0) return null;

  return { role: auxiliary.role, width: LANE_WIDTH * share };
};

/**
 * Where on the road's cross-section a car actually is.
 *
 * `laneOf` cannot answer this and must not be asked: it clamps everything
 * beyond the carriageway to the outermost through lane, so a car on a slip road
 * and a car in Lane 4 come back identical. They are not in the same place, and
 * a HUD that told a driver still on the acceleration lane that they were in
 * Lane 4 was telling them they had already done the thing they were about to be
 * graded on.
 *
 * One projection, read by the HUD, by the scenario guidance and by anything
 * else that has to say where the car is. Nothing derives it from an event id or
 * from prose.
 */
export type RoadPlace =
  /** Out on an acceleration lane, which is a different road from the one beside it. */
  | 'acceleration-lane'
  /** Out on a deceleration lane alongside the carriageway. */
  | 'deceleration-lane'
  /** On the ramp an exit leaves by, which is a different road from the one left. */
  | 'ramp'
  /** In one of the through lanes of the carriageway. */
  | 'through-lane'
  /** On the road an exit led to, past the expressway. */
  | 'toll-approach';

export interface RoadPosition {
  place: RoadPlace;
  /** Which through lane, counted from the median, or null when not in one. */
  lane: LaneIndex | null;
  /**
   * The auxiliary lane running beside the carriageway here, or null where there
   * is none — so a readout can show that the road has one without having to
   * work out whether the car is on it.
   */
  auxiliary: AuxiliaryLaneRole | null;
  /**
   * Whether the auxiliary lane and the carriageway are one surface here, so the
   * car may cross between them. False while a nose divides them.
   */
  crossingOpen: boolean;
}

/** Where the car is, from the route rather than from the lane arithmetic alone. */
export const roadPositionAt = (
  x: number,
  roadX: number,
  distance: number,
  route?: RouteLayout
): RoadPosition => {
  const aux = auxiliaryAt(distance, route);
  const onAuxiliary = aux !== null && isOnAuxiliaryLane(x, roadX);
  const crossingOpen = aux !== null && separatorAt(distance, route) === null;

  if (onAuxiliary) {
    // A deceleration lane running beside the expressway and the ramp it becomes
    // once the road has parted are different places, and the roadside is what
    // tells them apart: past the gore the road alongside is the approach, not
    // the expressway.
    const leaving = roadsideAt(distance, route) === 'toll_approach';
    return {
      place:
        aux.role === 'acceleration' ? 'acceleration-lane'
        : leaving ? 'ramp'
        : 'deceleration-lane',
      lane: null,
      auxiliary: aux.role,
      crossingOpen,
    };
  }
  return {
    place: roadsideAt(distance, route) === 'toll_approach' ? 'toll-approach' : 'through-lane',
    lane: laneOf(x, roadX),
    auxiliary: aux?.role ?? null,
    crossingOpen,
  };
};

/**
 * Whether a car at this position is out on the auxiliary lane rather than in a
 * through lane.
 *
 * `laneOf` cannot answer this: it clamps everything beyond the carriageway to
 * the outermost through lane, so a car on the acceleration lane and a car in
 * Lane 4 read as the same lane. They are not the same place, and "did you merge
 * before the lane ran out" is exactly the difference.
 */
export const isOnAuxiliaryLane = (x: number, roadX: number): boolean => x > roadX + ROAD_WIDTH;

/** The centre of the auxiliary lane, for placing something travelling on it. */
export const auxiliaryCentreX = (roadX: number, aux: AuxiliaryLaneAt): number =>
  roadX + ROAD_WIDTH + aux.width / 2;

/**
 * The divider standing between the auxiliary lane and the through lanes at this
 * point of the route, or null where the two are one surface.
 *
 * `x` is measured from the left edge of the carriageway, like every other
 * lateral figure here, and is the *centre* of the divider. It is drawn from
 * this and it is solid from this, so the nose a driver can see and the nose the
 * wheel cannot cross are one object.
 */
export interface LaneSeparatorAt {
  kind: LaneSeparatorKind;
  /** Offset of the divider's centre from the carriageway's left edge. */
  x: number;
  /** Full width of the divider. */
  width: number;
}

/** How wide a kerbed nose or a painted gore is drawn and collided at. */
export const SEPARATOR_WIDTH = 14;

/**
 * How far before its end the divider narrows to a point.
 *
 * A nose between a slip road and a carriageway does not stop square; it tapers
 * away, and that taper is the thing a driver reads as "the opening is here".
 * Drawn and collided at the same narrowing width, so the wheel gets through
 * exactly where the eye says it can.
 */
const SEPARATOR_TAPER = 180;

/**
 * The car's own length, in route units.
 *
 * `distanceToScreenY` puts half a pixel of screen on each unit, so the 68px
 * sprite is 136 units of road — which is the span of route a car occupies at
 * any instant, and the span a divider has to be clear of before it may cross.
 */
export const CAR_LENGTH = 136;

/**
 * Route units to a meter along the road, on the scale the car is drawn at:
 * its `CAR_LENGTH` is a 4.5-meter car.
 *
 * An assumption, stated once. The game has no metric scale of its own, and its
 * speed implies a different one (about 11 units a meter at 40 km/h). Where a
 * rule says how close a car may stand to something,
 * the driver judges it by eye against the car on screen, so that is the scale
 * the rule is measured on.
 */
export const UNITS_PER_METER = CAR_LENGTH / 4.5;

/**
 * The divider in force at a point of the route.
 *
 * It sits on the carriageway's outer edge: the through lanes end at
 * `ROAD_WIDTH`, the auxiliary lane begins outside it, and the nose occupies the
 * line between them. Outside the separator's declared stretch there is nothing
 * there and the two surfaces are one road.
 */
export const separatorAt = (distance: number, route?: RouteLayout): LaneSeparatorAt | null => {
  const segment = segmentAt(distance, route);
  const separator = segment?.auxiliary?.separator;
  if (!separator) return null;
  if (distance < separator.from || distance >= separator.to) return null;
  // Only where there is a lane on the other side of it. A nose dividing the
  // carriageway from nothing is a nose in the verge.
  if (!auxiliaryAt(distance, route)) return null;

  const toEnd = separator.to - distance;
  const share = SEPARATOR_TAPER > 0 ? Math.min(1, toEnd / SEPARATOR_TAPER) : 1;
  const width = SEPARATOR_WIDTH * share;
  if (width < 1) return null;
  return { kind: separator.kind, x: ROAD_WIDTH, width };
};

/**
 * The lateral limits of everything a car at `x` may drive on here.
 *
 * Where the route divides the auxiliary lane from the through lanes, this is
 * two corridors rather than one interval, and which one a car gets depends on
 * which one it is already in. That is the difference between a lane and a
 * separate road running alongside: a driver on the slip road cannot steer onto
 * the expressway until the nose ends, and a driver already on the expressway
 * cannot steer onto the slip road either.
 *
 * Where nothing divides them the two are one surface and this is the single
 * widened interval it has always been — which is what lets the same car cross
 * once it reaches the opening, and what makes the closing taper push it in
 * rather than strand it outside.
 */
export const drivableBounds = (
  bounds: { min: number; max: number },
  x: number,
  distance: number,
  route: RouteLayout | undefined,
  /** Left edge of the carriageway, which the separator is measured from. */
  roadX: number,
  /** Half the car's width, so a body stops at the nose rather than over it. */
  halfCar: number
): { min: number; max: number } => {
  const aux = auxiliaryAt(distance, route);
  if (!aux) return bounds;

  const outer = bounds.max + aux.width;
  // A car is a length of road, not a point on it. Asked only about its own
  // centre, a driver could start across the moment the nose passed the
  // windscreen — with the tail still alongside it, which the collision pass
  // reads as driving into it. The corridor holds until the whole car is clear.
  const separator = separatorAt(distance, route) ?? separatorAt(distance - CAR_LENGTH, route);
  if (!separator) return { min: bounds.min, max: outer };

  // Measured from the carriageway's own edge rather than from `bounds`, which
  // is already inset by half a car. The node that draws the nose and the body
  // that makes it solid are built from these same two figures.
  const noseFrom = roadX + separator.x - separator.width / 2;
  const noseTo = noseFrom + separator.width;
  const corridor =
    x > noseTo
      ? { min: noseTo + halfCar, max: outer }
      : { min: bounds.min, max: noseFrom - halfCar };

  // A corridor narrower than the car is not a corridor. It happens where a lane
  // is tapering away underneath a nose that has not finished — the outer edge
  // closing in while the inner one is still solid — and squeezing the car into
  // nothing there means driving it into the thing it was being kept away from.
  // The wider road is the honest answer: the nose is going, not the tarmac.
  if (corridor.max <= corridor.min) return { min: bounds.min, max: outer };
  return corridor;
};

/**
 * The lateral limits of everything a car may drive on here: the through lanes,
 * plus any auxiliary lane beside them.
 *
 * Taking the auxiliary width from the same declaration the paint reads is what
 * keeps the edge of the drivable road and the edge of the drawn road the same
 * edge — and what makes an acceleration lane that runs out *push* the car into
 * the carriageway rather than letting it drive along a verge.
 *
 * Says nothing about a divider. Use `drivableBounds` where one may stand.
 */
export const widenForAuxiliary = (
  bounds: { min: number; max: number },
  aux: AuxiliaryLaneAt | null
): { min: number; max: number } =>
  aux ? { min: bounds.min, max: bounds.max + aux.width } : bounds;
