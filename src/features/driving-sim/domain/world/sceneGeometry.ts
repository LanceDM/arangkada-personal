/**
 * Where the parts of a scene stand, as pure geometry.
 *
 * The one definition of those positions, and the scene builders are its only
 * readers. A node is placed against these numbers and carries both the sprite's
 * position and its solids, so a hitbox and the thing it belongs to cannot drift
 * apart.
 */
import type { LaneRequirement } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { CrossingPedestrian } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  CANVAS_WIDTH,
  LANE_COUNT,
  LANE_WIDTH,
  ROAD_WIDTH,
  laneEdges,
  resolveLaneRole,
} from './vehiclePhysics';
import { intersectionGeometry } from './junctionGeometry';
import type { RoadAt } from './eventPlacement';

export interface Point {
  x: number;
  y: number;
}

// ── Traffic islands ────────────────────────────────────────────────────────

/**
 * The raised island at a transition/approach marking. Centred on the driver's
 * own half, not on the whole carriageway: centred on the road it lands on the
 * centre line, with the guiding lines then inviting a pass through oncoming
 * traffic.
 */
export const islandApproachCentreX = (roadX: number, oncomingLanes: number): number => {
  const ownStart = roadX + LANE_WIDTH * oncomingLanes;
  return (ownStart + roadX + ROAD_WIDTH) / 2;
};

export interface ChevronIslandGeometry {
  apexY: number;
  wideY: number;
  markingOpensRight: boolean;
  maxWidth: number;
  fixedEdgeAt: (y: number) => number;
  closedEdgeAt: (y: number) => number;
  widthAt: (y: number) => number;
  /** The raised island at the wide end — the part that is actually solid. */
  island: { centreX: number; width: number; tipY: number; baseY: number };
}

/**
 * The gore marking's wedge and the island it protects.
 *
 * Offsets come from the closed lane's own edges rather than flat multiples of
 * LANE_WIDTH: written flat they happened to land on lane boundaries while the
 * road had three lanes, and on four they pointed at the centre line, building
 * a solid island in the oncoming lanes.
 */
export const chevronIslandGeometry = (
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  oncomingLanes: number,
  targetLane: LaneRequirement['lane'] = 'curb'
): ChevronIslandGeometry => {
  const opensRight = targetLane !== 'inner';
  const markingOpensRight = !opensRight;
  const apexY = bottomY - 20;
  const wideY = topY + 50;
  const span = apexY - wideY;

  const curbLane = resolveLaneRole('curb', oncomingLanes);
  const closedLane = opensRight ? Math.max(0, curbLane - 1) : curbLane;
  const closedLeft = LANE_WIDTH * closedLane;
  const closedRight = closedLeft + LANE_WIDTH;
  const markingFixedOffset = opensRight ? closedLeft : closedRight;
  const islandFixedOffset = opensRight ? closedRight : closedLeft;
  const maxWidth = LANE_WIDTH - 8;

  const fixedEdgeAt = (y: number) => roadAt(y) + markingFixedOffset;
  const islandFixedEdgeAt = (y: number) => roadAt(y) + islandFixedOffset;
  const widthAt = (y: number) => (maxWidth * (apexY - y)) / span;
  const closedEdgeAt = (y: number) =>
    fixedEdgeAt(y) + (markingOpensRight ? -widthAt(y) : widthAt(y));

  const centreX = islandFixedEdgeAt(wideY) + (opensRight ? -maxWidth / 2 : maxWidth / 2);
  const baseY = wideY - 6;

  return {
    apexY,
    wideY,
    markingOpensRight,
    maxWidth,
    fixedEdgeAt,
    closedEdgeAt,
    widthAt,
    island: { centreX, width: maxWidth * 0.75, tipY: baseY - 36, baseY },
  };
};

// ── Lane closures ──────────────────────────────────────────────────────────

export interface BarrierGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One concrete barrier, not a stack: a closure that takes a single lane is one
 * barrier's worth of road, and a run of identical segments marching up the
 * screen reads as several obstructions rather than the one described.
 */
export const concreteBarrierGeometry = (
  roadAt: RoadAt,
  screenY: number,
  side: 'left' | 'right'
): BarrierGeometry => {
  const width = LANE_WIDTH * 0.7;
  const height = 52;
  const roadX = roadAt(screenY);
  return {
    width,
    height,
    y: screenY - height / 2,
    x: side === 'left' ? roadX + 6 : roadX + ROAD_WIDTH - 6 - width,
  };
};

const CONE_TAPER_STEPS = 5;

/**
 * The cones closing off part of the carriageway. The taper walks in from the
 * curb, which is what tells the driver how far the closure reaches before they
 * are alongside it.
 */
export const coneTaperPositions = (
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  side: 'left' | 'right'
): Point[] =>
  Array.from({ length: CONE_TAPER_STEPS + 1 }, (_, i) => {
    const y = bottomY - ((bottomY - topY) * i) / CONE_TAPER_STEPS;
    const roadX = roadAt(y);
    const inset = 12 + (LANE_WIDTH - 12) * (i / CONE_TAPER_STEPS);
    return { x: side === 'left' ? roadX + inset : roadX + ROAD_WIDTH - inset, y };
  });

export interface RoadworkGeometry {
  closedWidth: number;
  boardY: number;
  /** Top-left of the closure barrier board. */
  barrier: BarrierGeometry;
  cones: Point[];
}

/**
 * A work zone's closure. Exactly the curb lane, which is what the scene's
 * `narrowsTo` shuts: a wider painted closure neither reached the curb nor
 * stopped at the centre line, spilling onto the oncoming half while leaving
 * open the lane the car is actually blocked from.
 *
 * The board is placed to overlap the open lane by a hair on purpose. The
 * narrowing stops the car 25px short of the closed width, so a board that
 * stopped exactly at the lane boundary could never be reached and a closure
 * nothing can hit has the same consequence as one you drive through — see
 * `drivable.test.ts`. A driver holding the middle of the lane the sign sends
 * them to passes it cleanly; one who pushes right up against the coned edge
 * still hits it.
 *
 * The cones are the part that was wrong. Their taper used to walk 82px in from
 * the curb — 17px past the closure's own inner edge — which put a solid body
 * over the centre of the required lane. Holding that lane, which is the answer
 * the sign asks for, ended the run; the only clear line left was the oncoming
 * half. They now stop at the closed lane's edge, `HALF_CONE` included so it is
 * the cone's *body* that stops there and not just its centre.
 */
const HALF_CONE = 8;

export const roadworkGeometry = (roadX: number, screenY: number): RoadworkGeometry => {
  const roadRight = roadX + ROAD_WIDTH;
  const closedWidth = LANE_WIDTH;
  /** The inner edge of the closure: as far in as the taper may reach. */
  const closedFrom = roadRight - closedWidth;
  const boardY = screenY - 18;
  return {
    closedWidth,
    boardY,
    barrier: { x: closedFrom - 6, y: boardY - 11, width: closedWidth, height: 22 },
    cones: [
      { x: roadRight - 22, y: screenY + 18 },
      { x: roadRight - 40, y: screenY + 38 },
      { x: closedFrom + HALF_CONE, y: screenY + 58 },
    ],
  };
};

export interface Rock extends Point {
  radius: number;
}

/**
 * Rocks spread across the carriageway rather than hugging the cliff: fixed
 * offsets kept every rock in the first lane, which on a two-way road is the
 * oncoming side — a hazard the driver must slow for but could never meet.
 */
export const rockfallPositions = (roadX: number, screenY: number): Rock[] => [
  { x: roadX + ROAD_WIDTH * 0.15, y: screenY - 20, radius: 15 },
  { x: roadX + ROAD_WIDTH * 0.55, y: screenY + 16, radius: 11 },
  { x: roadX + ROAD_WIDTH * 0.85, y: screenY + 44, radius: 9 },
];

export interface TollGate {
  lane: number;
  x: number;
  width: number;
}

/** The closed gates across a toll plaza. A Red X you can drive through is a picture of a rule. */
export const tollGateBarriers = (roadX: number, openLane: number): TollGate[] => {
  const edges = laneEdges(roadX);
  const gates: TollGate[] = [];
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    if (lane === openLane) continue;
    gates.push({ lane, x: edges[lane] + 5, width: edges[lane + 1] - edges[lane] - 10 });
  }
  return gates;
};

// ── Vehicles that belong to a scene ────────────────────────────────────────

export interface MergeLaneGeometry {
  entryTop: Point;
  entryFoot: Point;
  laneHalfWidth: number;
  car: Point & { heading: number };
}

/** A lane joining from the right, with a vehicle already on it. */
export const mergeLaneGeometry = (roadX: number, screenY: number): MergeLaneGeometry => {
  const roadRight = roadX + ROAD_WIDTH;
  const entryTop = { x: CANVAS_WIDTH, y: screenY - 168 };
  const entryFoot = { x: roadRight, y: screenY + 40 };
  const laneHalfWidth = 34;

  // Facing the way the lane actually runs, or it reads as reversing up its own
  // slip road.
  const travelX = entryFoot.x - entryTop.x;
  const travelY = entryFoot.y - entryTop.y;
  return {
    entryTop,
    entryFoot,
    laneHalfWidth,
    car: {
      x: entryTop.x + travelX * 0.45 - 16,
      y: entryTop.y + travelY * 0.45 + laneHalfWidth * 0.4,
      heading: Math.atan2(-travelX, travelY),
    },
  };
};

/** The opposing vehicle on a two-way stretch, drawn in the oncoming lane. */
export const twoWayOncomingPoint = (roadX: number, screenY: number): Point => ({
  x: roadX + LANE_WIDTH / 2,
  y: screenY - 46,
});

/**
 * Where a vehicle stopped inside a yellow box stands, as a screen row: just
 * past the box's near edge, so it is in the box and clear of the queue jammed
 * across it. Measured from the vehicle's own `length`, so its back sits on the
 * edge whatever it is.
 */
export const insideBoxY = (screenY: number, length: number): number =>
  intersectionGeometry(screenY).boxBottom - length / 2 - 4;

/**
 * The queue jamming a yellow box: a two-lane, one-way stream travelling across
 * the junction from the west, stopped solid so there is nowhere to pull out to.
 */
export const blockingQueueCars = (
  roadX: number,
  screenY: number
): (Point & { color: string })[] => {
  const boxRow = intersectionGeometry(screenY).boxBottom - (ROAD_WIDTH * 0.75) / 2;
  const roadRight = roadX + ROAD_WIDTH;
  const laneA = boxRow - 15;
  const laneB = boxRow + 15;
  return [
    { x: roadX - 48, y: laneA, color: '#dc2626' },
    { x: roadX + 74, y: laneA, color: '#e2e8f0' },
    { x: roadX + 196, y: laneA, color: '#2563eb' },
    // Lower lane, offset so the two do not line up bumper-for-bumper.
    { x: roadX + 14, y: laneB, color: '#eab308' },
    { x: roadX + 136, y: laneB, color: '#64748b' },
    { x: roadRight + 44, y: laneB, color: '#dc2626' },
  ];
};

/**
 * A main road crossing yours, and the wave of traffic on it.
 *
 * The stream runs in waves rather than endlessly: waiting for the gap is the
 * lesson, and a free-running gap would expire while the driver accelerates from
 * the line, punishing exactly the behaviour the level teaches. Once they have
 * yielded the wave has passed for good.
 */
export const MAIN_ROAD_CYCLE_MS = 6000;
/** Fraction of the cycle with traffic crossing; the rest is a clear gap. */
const MAIN_ROAD_TRAFFIC_SHARE = 0.5;

export interface MainRoadTraffic {
  clear: boolean;
  /** The two crossing vehicles, empty while the gap is open. */
  cars: (Point & { color: string })[];
}

export const mainRoadTraffic = (
  screenY: number,
  yielded: boolean,
  nowMs: number
): MainRoadTraffic => {
  const phase = (nowMs % MAIN_ROAD_CYCLE_MS) / MAIN_ROAD_CYCLE_MS;
  if (yielded || phase >= MAIN_ROAD_TRAFFIC_SHARE) return { clear: true, cars: [] };

  const progress = phase / MAIN_ROAD_TRAFFIC_SHARE;
  const travel = CANVAS_WIDTH + 160;
  const top = screenY - ROAD_WIDTH / 2;
  return {
    clear: false,
    cars: [
      { x: -80 + progress * travel, y: top + ROAD_WIDTH / 3, color: '#dc2626' },
      { x: CANVAS_WIDTH + 80 - progress * travel, y: top + (ROAD_WIDTH * 2) / 3, color: '#2563eb' },
    ],
  };
};

// ── People ─────────────────────────────────────────────────────────────────

/**
 * Gap between people standing on the same crossing.
 *
 * Slot 0 is the far curb side and the rest of the group fans back toward the
 * near curb. A crossing with one person on it puts them in slot 0, so adding a
 * group to a crossing never moves the person already standing there — which is
 * what the collision golden pins.
 */
const CROSSING_SLOT_GAP = 16;

/** Where each person in a crossing's group stands. */
export const crossingPedestrianPositions = (
  roadX: number,
  people: readonly CrossingPedestrian[]
): number[] =>
  people.map((person, index) =>
    person.position === undefined
      ? roadX + ROAD_WIDTH - 15 - index * CROSSING_SLOT_GAP
      : roadX + person.position * ROAD_WIDTH
  );

/**
 * Stood in the driving lane, not off to one side: a centred car has to stop
 * rather than roll past while answering.
 */
export const drivewayPedestrianX = (walkedOff = 0): number =>
  CANVAS_WIDTH / 2 + 6 + walkedOff * 150;

/** One full pass across a signalised crossing, while the signal is still red. */
export const SIGNAL_CROSSING_WALK_MS = 2600;

/**
 * Where the pedestrian on a signalised crossing is right now. A light-controlled
 * crossing puts them on a walk signal, so they are walking rather than waiting
 * on the curb for a gap.
 */
export const signalCrossingPedestrian = (roadX: number, screenY: number, nowMs: number): Point => {
  const progress = (nowMs % SIGNAL_CROSSING_WALK_MS) / SIGNAL_CROSSING_WALK_MS;
  return {
    x: roadX + 12 + progress * (ROAD_WIDTH - 24),
    y: intersectionGeometry(screenY).boxBottom + 12,
  };
};
