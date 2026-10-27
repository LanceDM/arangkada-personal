// Pure movement logic — no React, no canvas

/**
 * The carriageway is four lanes wide, which is what lets a level choose its own
 * layout: `oncomingLanes: 2` is an ordinary two-way street, `0` is a four-lane
 * one-way, and `1` is the asymmetric case some junctions need. Three lanes
 * could express none of that — a two-way split of three is always lopsided, and
 * a driver could not tell which side was theirs.
 *
 * The canvas widened with it, from 400 to 460. That pair of numbers is chosen
 * so `roadX` stays at 100 and the road's centre stays at `CANVAS_WIDTH / 2`,
 * exactly as at three lanes: every sign, bay and hazard positioned relative to
 * the curbs or to the centre of the screen keeps the margin it was drawn with.
 * Only the lane width really moves, and only from 66.7 to 65, so the car still
 * steers across a lane in the same time it always did.
 */
export const CANVAS_WIDTH = 460;
export const CANVAS_HEIGHT = 700;
export const CAR_WIDTH = 40;
export const CAR_HEIGHT = 68;
export const ROAD_WIDTH = 260;
export const LANE_COUNT = 4;
export const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;
export const MAX_SPEED = 120;

/**
 * Movement scaled to the road you are on. The flat 0.5/frame default adds about
 * 30 km/h every second, so a residential street's whole limit arrived in one
 * tap and the car could reach 120 on a 30 km/h road. Deriving both from the
 * posted limit keeps a side street calm and a highway quick.
 */
export const speedProfileFor = (speedLimit: number) => ({
  /** A little headroom over the limit, so exceeding it is possible but deliberate. */
  maxSpeed: Math.max(24, speedLimit * 1.6),
  /** Reaches the posted limit in roughly 2.5 seconds at 60fps. */
  acceleration: Math.max(0.08, speedLimit / 150),
});
export const BRAKE_FORCE = 1.2;
export const FRICTION = 0.15;

/**
 * The throttle is a setting, not a pedal. Tapping up or down moves a target
 * speed in steps and the car drives to it and holds it, so keeping a steady
 * speed costs no input at all — you are still choosing the speed, but you are
 * not holding or tapping a key to maintain one.
 */
export const speedStepFor = (speedLimit: number) => Math.max(5, Math.round(speedLimit / 3));

/** Eases the car toward its setting: accelerate up to it, drift down to it. */
export const approachTarget = (
  speed: number,
  target: number,
  acceleration: number
): number => {
  if (speed < target) return Math.min(target, speed + acceleration);
  if (speed > target) return Math.max(target, speed - FRICTION);
  return speed;
};

// Action zone: how far before/after event we detect the player's action
export const ACTION_ZONE_ENTER = 60;  // start detecting this far before trigger
export const ACTION_ZONE_EXIT = 20;   // fail if passed this far after trigger without correct action

/**
 * How far ahead a road event announces itself. At ~3 distance units per frame
 * this is roughly 2.5 seconds of reading and reacting time; the old 60-unit
 * window gave about a third of a second. Clamped per event at runtime so a
 * warning never opens before the previous event has been resolved.
 */
export const WARNING_ZONE_ENTER = 400;
/** Breathing room kept between one event's exit and the next one's warning. */
export const WARNING_ZONE_MARGIN = 40;

/**
 * Inside this distance the heads-up becomes an urgent call to act. Outside it
 * the player is still approaching and only gets a quiet notice.
 */
export const REACTION_ZONE_ENTER = 120;

/**
 * Clear road guaranteed at the start of a level before any warning may open,
 * so the first key pressed to get moving is never read as an answer.
 */
export const WARNING_START_RUNWAY = 200;

// Checkpoint zone: the player must brake to a full stop here, so the window has
// to be long enough to shed MAX_SPEED (~300 units of runway at BRAKE_FORCE).
export const CHECKPOINT_ZONE_ENTER = 340;
export const CHECKPOINT_ZONE_EXIT = 40;
export const CHECKPOINT_STOP_SPEED = 1.5; // counts as a full stop

/**
 * Radius of the lane a vehicle circulating a roundabout actually drives on,
 * measured from the centre of the island.
 *
 * It lives here rather than beside either of its two users because both need
 * it and neither may import the other: the renderer paints the ring around
 * this radius and `npcVehicle` drives the circulating car along it, so a figure
 * owned by one of them would either duplicate or make the pair circular. A
 * mismatch is immediately visible as a car floating off its own carriageway.
 */
export const ROUNDABOUT_PATH_RADIUS = 88;

/** A lane of the carriageway, counted from the left curb. */
export type LaneIndex = 0 | 1 | 2 | 3;

/**
 * Where a lane sits **on your own side of the road**, which is the only way a
 * traffic rule ever names one.
 *
 * RA 4136 does not say "lane 2". It says the lane nearest the centre line, and
 * the wheel nearest the curb — positions relative to the driver's carriageway,
 * not to the paint's left edge. Content written in absolute indices would be
 * silently wrong the moment a level changed its `oncomingLanes`: the lane a left
 * turn must be taken from is index 2 on a two-way street and index 0 on a
 * one-way, and both are "the lane nearest the centre line".
 *
 * So level content names the role and the engine resolves the index, against
 * the layout that level actually declared.
 */
export type LaneRole = 'inner' | 'middle' | 'curb';

/**
 * The index a role refers to on a carriageway with `oncomingLanes` lanes of
 * opposing traffic at the left.
 *
 * `middle` only genuinely exists where your side has three or more lanes; on an
 * ordinary two-by-two street it collapses onto `inner`, which is the safe way
 * round — it can never resolve to a lane that is not yours.
 */
export const resolveLaneRole = (role: LaneRole, oncomingLanes: number): LaneIndex => {
  const first = Math.max(0, Math.min(LANE_COUNT - 1, oncomingLanes));
  const last = LANE_COUNT - 1;
  if (role === 'curb') return last as LaneIndex;
  if (role === 'inner') return first as LaneIndex;
  return Math.floor((first + last) / 2) as LaneIndex;
};

/** Human-readable name for a lane, for the HUD and for correction messages. */
export interface CarState {
  x: number;
  y: number;
  speed: number;
  /** Which lane the car is currently sitting in, derived from `x` each frame. */
  lane: LaneIndex;
  distance: number;
  /** Facing, in radians. Non-zero only while a turn is being executed. */
  heading: number;
}

/** An axis-aligned box in canvas space - the minimum a collision test needs. */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The first box the car's footprint overlaps, or undefined if it is clear.
 *
 * Generic over the box type so the caller gets its own richer hitbox back
 * (with `kind`/`label` for the crash reason) rather than a stripped shape. Pure
 * AABB overlap against the car's CAR_WIDTH x CAR_HEIGHT footprint centred on
 * (car.x, car.y); lifted out of the frame loop so the collision rule is stated
 * and tested in one place.
 */
export const firstCarCollision = <T extends AABB>(car: CarState, boxes: readonly T[]): T | undefined =>
  boxes.find(box =>
    car.x - CAR_WIDTH / 2 < box.x + box.width &&
    car.x + CAR_WIDTH / 2 > box.x &&
    car.y - CAR_HEIGHT / 2 < box.y + box.height &&
    car.y + CAR_HEIGHT / 2 > box.y
  );

/**
 * Boundaries of the LANE_COUNT lanes, as x positions from the left curb
 * inwards — LANE_COUNT + 1 edges, since a lane needs one on each side.
 *
 * Equal quarters of the road, which is what a four-lane road looks like and
 * what the dashes are painted at. The car's centre is held 25px clear of each
 * curb, so the outer lanes have less reachable travel across them than the
 * inner ones. Dividing the reachable span equally instead fixed that, but
 * made the painted lanes visibly uneven, which is a worse trade: a driver
 * reads the road far more often than they read the edge of their steering.
 * Everything that reasons about lanes comes from here, so the logic and the
 * paint always agree.
 */
export const laneEdges = (roadX: number): number[] =>
  Array.from({ length: LANE_COUNT + 1 }, (_, i) => roadX + LANE_WIDTH * i);

/** Which lane a given screen position sits in. */
export const laneOf = (x: number, roadX: number): LaneIndex => {
  const offset = Math.floor((x - roadX) / LANE_WIDTH);
  return Math.max(0, Math.min(LANE_COUNT - 1, offset)) as LaneIndex;
};

export const laneCentreX = (lane: LaneIndex, roadX: number): number =>
  roadX + LANE_WIDTH * lane + LANE_WIDTH / 2;

/** Canvas pixels one unit of road distance takes up the screen. */
export const SCREEN_PX_PER_UNIT = 0.5;

export const distanceToScreenY = (objDistance: number, playerDistance: number): number =>
  CANVAS_HEIGHT - 150 - (objDistance - playerDistance) * SCREEN_PX_PER_UNIT;

/**
 * The inverse: which point of the route a given screen row is showing.
 *
 * Needed wherever something is drawn at an offset from its own anchor — an
 * overhead gantry hangs below the junction it belongs to, and on a bend the
 * road down there is not the road up here.
 */
export const screenYToDistance = (screenY: number, playerDistance: number): number =>
  playerDistance + (CANVAS_HEIGHT - 150 - screenY) / SCREEN_PX_PER_UNIT;

/**
 * `grip` below 1 is a slippery, flooded or loose surface: the brakes still work,
 * they simply take longer to shed the same speed.
 */
export const applyBrake = (speed: number, grip = 1): number =>
  Math.max(speed - BRAKE_FORCE * Math.max(0.15, grip), 0);

/** Default span either side of a sign over which its road effect is felt. */
export const ROAD_EFFECT_SPAN = 70;

/** Where the road sits when it is running straight. */
export const ROAD_CENTRE_X = (CANVAS_WIDTH - ROAD_WIDTH) / 2;

/**
 * One bend in the road: how far the carriageway swings sideways, centred on a
 * point along the route.
 *
 * The view only ever scrolls straight up, so a bend cannot be shown by turning
 * the camera. It is shown by moving the road instead — the whole carriageway
 * sweeps across the screen as you drive into it and back as you leave, which
 * is how driving games have drawn curves since long before this one. The swing
 * returns to zero at both ends so the road is straight everywhere else and
 * bends never accumulate down the route.
 */
export interface CurveSpan {
  /** Distance along the route the bend is centred on. */
  at: number;
  /** How far either side of that centre the bend is felt. */
  span: number;
  /** Peak sideways shift in pixels; positive swings the road right. */
  amount: number;
}

/** How far the road has swung sideways at a given point along the route. */
export const roadOffsetAt = (distance: number, curves: CurveSpan[]): number => {
  let offset = 0;
  for (const curve of curves) {
    const t = (distance - curve.at) / curve.span;
    if (t <= -1 || t >= 1) continue;
    offset += curve.amount * (1 + Math.cos(t * Math.PI)) / 2;
  }
  return offset;
};

/** Left edge of the carriageway at a given point along the route. */
export const roadXAt = (distance: number, curves: CurveSpan[]): number =>
  ROAD_CENTRE_X + roadOffsetAt(distance, curves);

/**
 * How much of the road's sideways slope the car takes on as lean.
 *
 * The view compresses a long stretch of road into a short piece of screen, so
 * the road's slope in screen pixels is far steeper than the angle a real car
 * would sit at. Taken literally it put the car at about thirty degrees, which
 * reads as sliding sideways rather than following the bend. Scaled by this it
 * tops out near twelve, which reads as leaning into it.
 */
const LEAN_SCALE = 1.5;

/**
 * Which way the road is heading here, in radians, for tilting the car into the
 * bend. Positive leans right.
 */
export const roadHeadingAt = (distance: number, curves: CurveSpan[]): number => {
  const lookahead = 24;
  const slope =
    (roadOffsetAt(distance + lookahead, curves) - roadOffsetAt(distance, curves)) / lookahead;
  return Math.atan(slope / LEAN_SCALE);
};

/** Width of a roadside pull-over bay. */
export const BAY_WIDTH = 46;
/** How far before its point a roadside bay starts to open the curb line. */
export const BAY_SPAN = 90;
/**
 * How far past its point the bay runs before the curb line is closed again.
 *
 * Shorter than the approach half, and equal to how far the bay is graded
 * (`gradedExitFor`): the zone may run on no further than the road kept clear
 * after it, 20 past the point plus the 40 kept before the next approach, or a
 * widened approach could open inside it. A bay drawn past that let a car come
 * to rest in it unread.
 */
export const BAY_RUN_ON = 60;

/**
 * How far open the bay is at `offset` from its point, 0 to 1: easing open
 * over the approach half and shut over the run-on, fully open at the point.
 */
export const bayOpenAt = (offset: number): number =>
  Math.max(0, offset < 0 ? 1 + offset / BAY_SPAN : 1 - offset / BAY_RUN_ON);

/**
 * Lateral limits with a roadside bay open, so the car can leave the
 * carriageway to stop in it. Without this the bay would be drawn beyond
 * anywhere the car is allowed to reach.
 */
export const boundsWithBay = (
  roadX: number,
  side: 'left' | 'right',
  openAmount: number
) => {
  const base = laneBounds(roadX);
  const reach = BAY_WIDTH * Math.max(0, Math.min(1, openAmount));
  return side === 'right'
    ? { min: base.min, max: base.max + reach }
    : { min: base.min - reach, max: base.max };
};

/** True once the car has left the carriageway into the bay on that side. */
export const isInBay = (x: number, roadX: number, side: 'left' | 'right'): boolean => {
  const base = laneBounds(roadX);
  return side === 'right' ? x > base.max + 6 : x < base.min - 6;
};

/** Which side of the carriageway is still open where the road narrows. */
export type OpenSide = 'left' | 'right' | 'centre';

/**
 * Lateral limits of the usable carriageway. `narrowsTo` is the fraction of the
 * road still open, and `openSide` says where that remaining width is — a work
 * zone closes one side, not both, so squeezing toward the centre line would
 * push the vehicle into the very barrier the sign warns about.
 */
export const laneBounds = (roadX: number, narrowsTo = 1, openSide: OpenSide = 'centre') => {
  const usable = ROAD_WIDTH * Math.min(1, Math.max(0.3, narrowsTo));
  const start =
    openSide === 'left' ? roadX
    : openSide === 'right' ? roadX + ROAD_WIDTH - usable
    : roadX + (ROAD_WIDTH - usable) / 2;

  return {
    min: start + CAR_WIDTH / 2 + 5,
    max: start + usable - CAR_WIDTH / 2 - 5,
  };
};

/** How far the wheel moves the car sideways in one frame. */
export const STEER_PER_FRAME = 2.5;

export const moveLeft = (x: number, roadX: number, narrowsTo = 1, openSide: OpenSide = 'centre'): number =>
  Math.max(x - STEER_PER_FRAME, laneBounds(roadX, narrowsTo, openSide).min);

export const moveRight = (x: number, roadX: number, narrowsTo = 1, openSide: OpenSide = 'centre'): number =>
  Math.min(x + STEER_PER_FRAME, laneBounds(roadX, narrowsTo, openSide).max);

export const isHonking = (keys: Set<string>): boolean => keys.has('h') || keys.has('H');

export const getPlayerAction = (
  keys: Set<string>,
  speed = Number.POSITIVE_INFINITY,
  expectedAction?: string
): string | null => {
  // The horn is checked first so it can be sounded while braking. Without its
  // own key every "sound the horn" choice was unreachable, which quietly turned
  // three-way questions into a brake-or-accelerate coin flip.
  if (isHonking(keys)) return 'honk';

  const isBraking = keys.has('ArrowDown') || keys.has('s') || keys.has('S') || keys.has(' ');

  if (isBraking) {
    if (expectedAction === 'stop') {
      return speed <= 3 ? 'stop' : null;
    }

    return 'brake';
  }

  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) return 'turn_left';
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) return 'turn_right';
  if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) return 'accelerate';
  return null;
};

/** How far back a following vehicle can be and still register in the mirror. */
export const MIRROR_RANGE = 190;

/** Screen row the player's own car occupies, which is what "behind" is measured from. */
const PLAYER_ROW = CANVAS_HEIGHT - 150;

/**
 * How close a following vehicle is, 0 (at the edge of mirror range) to 1 (level
 * with the player). Clamped to 0 once it has drawn alongside and passed.
 */
export const rearProximity = (followerY: number): number =>
  Math.min(Math.max(1 - (followerY - PLAYER_ROW) / MIRROR_RANGE, 0), 1);
