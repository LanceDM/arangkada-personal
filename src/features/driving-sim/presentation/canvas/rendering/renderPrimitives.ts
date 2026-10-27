/**
 * Category-agnostic primitives shared across the renderer split: the junction
 * surface, the pavement-paint helpers, and the handful of sprites more than one
 * category file needs. Nothing here knows about a specific `ScenarioEvent.type`,
 * `RoadScene` or `MarkingPlate.art` — anything that does belongs in a category
 * file, importing from this one.
 *
 * Where things stand is not decided here: the junction's own geometry is world
 * data (`domain/world/junctionGeometry`), and these helpers paint against it.
 */
import { CANVAS_WIDTH, ROAD_WIDTH, LANE_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { SignalAspect } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  CROSS_ROAD_WIDTH,
  CURB_DEPTH,

  intersectionGeometry,
  type IntersectionGeometry,
} from '@/features/driving-sim/domain/world/junctionGeometry';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';

export const drawVehicleShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  footY: number
) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, footY, width / 2 + 4, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const bodyGradient = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  light: string,
  mid: string,
  dark: string
) => {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, light);
  grad.addColorStop(0.5, mid);
  grad.addColorStop(1, dark);
  return grad;
};

export const strokeChrome = (ctx: CanvasRenderingContext2D) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
};

/**
 * The asphalt palette the main road is laid with. Cross streets use the same
 * gradient across their own width, so a junction reads as two roads meeting
 * rather than a grey band painted over the drive.
 */
export const laySurface = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  direction: 'across' | 'along'
) => {
  const grad = direction === 'across'
    ? ctx.createLinearGradient(0, y, 0, y + height)
    : ctx.createLinearGradient(x, 0, x + width, 0);
  grad.addColorStop(0, '#2a2a3a');
  grad.addColorStop(0.1, '#35354a');
  grad.addColorStop(0.5, '#3a3a50');
  grad.addColorStop(0.9, '#35354a');
  grad.addColorStop(1, '#2a2a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);
};

/**
 * The zebra stripe pattern shared by every pedestrian crossing in the game —
 * an open-road crossing, a driveway mouth, and the crosswalk painted through
 * a signal-controlled junction all use the exact same bars, so a crossing
 * reads as the same marking no matter where it turns up.
 */
export const drawZebraStripes = (ctx: CanvasRenderingContext2D, roadX: number, top: number, height: number) => {
  const barCount = 7;
  const barSpan = (ROAD_WIDTH - 16) / barCount;
  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < barCount; i++) {
    ctx.fillRect(roadX + 8 + i * barSpan, top + 3, barSpan * 0.6, height - 6);
  }
};

/**
 * The give-way approach shared by every pedestrian crossing that stands on
 * its own rather than inside a junction that already draws its own curbs and
 * stop/give-way lines: dropped curb ramps down to the crossing, the zebra
 * bars, and the dashed give-way line on the approach. What makes an open-road
 * crossing and a driveway mouth look the same crossing — each caller only
 * adds what is actually unique to its situation (a sign, a footpath backdrop,
 * how the pedestrian behaves) on top of this.
 */
export const drawCrossingApproach = (ctx: CanvasRenderingContext2D, roadX: number, top: number, height: number) => {
  const roadRight = roadX + ROAD_WIDTH;

  ctx.save();
  // Dropped curb ramps where the footpath meets the carriageway.
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(roadX - 20, top);
  ctx.lineTo(roadX, top + 7);
  ctx.lineTo(roadX, top + height - 7);
  ctx.lineTo(roadX - 20, top + height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(roadRight + 20, top);
  ctx.lineTo(roadRight, top + 7);
  ctx.lineTo(roadRight, top + height - 7);
  ctx.lineTo(roadRight + 20, top + height);
  ctx.closePath();
  ctx.fill();

  drawZebraStripes(ctx, roadX, top, height);

  // Give-way line on your approach.
  ctx.setLineDash([9, 7]);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(roadX + 4, top + height + 14);
  ctx.lineTo(roadRight - 4, top + height + 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

export const drawRoadsideSign = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  subtitle: string,
  fill = '#14532d'
) => {
  ctx.save();
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(x - 2, y + 24, 4, 38);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x - 48, y - 18, 96, 44, 5);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 10px Inter';
  ctx.fillText(title, x, y - 1);
  ctx.font = 'bold 8px Inter';
  ctx.fillText(subtitle, x, y + 13);
  ctx.restore();
};

export const drawTrafficCone = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-12, 18);
  ctx.lineTo(12, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-6, 0, 12, 4);
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(-15, 18, 30, 5);
  ctx.restore();
};

/** A fire hydrant on the curb: base plate, barrel, the two side outlets and the cap. */
export const drawFireHydrant = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#475569';
  ctx.fillRect(-9, 10, 18, 4);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-11, -2, 22, 5);
  ctx.beginPath();
  ctx.roundRect(-6, -10, 12, 21, 3);
  ctx.fill();
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.arc(0, -10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fca5a5';
  ctx.beginPath();
  ctx.arc(0, -10, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawChevron = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.save();
  ctx.fillStyle = '#facc15';
  ctx.fillRect(x - 9, y - 13, 18, 26);
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.moveTo(-5 + x, y - 8);
  ctx.lineTo(4 + x, y);
  ctx.lineTo(-5 + x, y + 8);
  ctx.lineTo(-1 + x, y + 8);
  ctx.lineTo(8 + x, y);
  ctx.lineTo(-1 + x, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const drawLaneArrow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'up' | 'left' | 'right' | 'down',
  color = '#ffffff'
) => {
  ctx.save();
  ctx.translate(x, y);
  const rotations = {
    up: 0,
    right: Math.PI / 2,
    down: Math.PI,
    left: -Math.PI / 2,
  };
  ctx.rotate(rotations[direction]);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.lineTo(0, -18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(-14, -10);
  ctx.lineTo(14, -10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

export const drawCrossingCar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 26, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - 25, y - 12, 50, 24, 6);
  ctx.fill();
  strokeChrome(ctx);
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 9, 18, 18, 3);
  ctx.fill();
  ctx.restore();
};

/**
 * A vehicle travelling the opposite way to the player.
 *
 * The player's own car (`drawCarBody` in roadRenderer.ts) has its headlights at
 * the top of the sprite and its tail lights at the bottom, because it faces up
 * the screen, away from the viewer, the same way the road recedes into the
 * distance. A vehicle coming the other way is facing down the screen, toward
 * the viewer — so its lights are mirrored top to bottom: headlights near the
 * bottom, windshield toward the top. Without this the sprite used to carry the
 * same top-lit "facing away" cues as the player's own car, which read as
 * travelling the same direction rather than the oncoming traffic it is meant
 * to be.
 */
export const drawOncomingVehicle = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  drawVehicleShadow(ctx, x, 28 * scale, y + 26 * scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = bodyGradient(ctx, -14, -24, 14, 24, '#3457b0', '#1e3a8a', '#132760');
  ctx.beginPath();
  ctx.roundRect(-14, -24, 28, 48, 5);
  ctx.fill();
  strokeChrome(ctx);
  // Windshield toward the far end of the car — its rear, relative to us.
  ctx.fillStyle = '#87ceeb';
  ctx.beginPath();
  ctx.roundRect(-10, -16, 20, 12, 3);
  ctx.fill();
  // Headlights on the near end, facing the player.
  ctx.fillStyle = '#fef9c3';
  ctx.shadowColor = '#fef08a';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(-9, 20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, 20, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
};

/** Signal head on a mast, with only the live aspect lit. */
export const drawSignalHead = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  aspect: SignalAspect,
  cleared: boolean
) => {
  // Once the call has been made the junction releases you, so driving on after
  // a correct answer is not punished by a signal that never changes.
  const live = cleared ? 'green' : aspect;
  const blinkOn = Math.floor(Date.now() / 420) % 2 === 0;
  const lit = {
    red: live === 'red' || (live === 'flashing_red' && blinkOn),
    yellow: live === 'yellow' || (live === 'flashing_yellow' && blinkOn),
    green: live === 'green',
  };

  ctx.save();
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x - 2, y + 28, 5, 60);
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 32, 30, 62, 6);
  ctx.fill();
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const lamps: [number, boolean, string, string][] = [
    [-17, lit.red, '#ef4444', '#3a0d0d'],
    [1, lit.yellow, '#f59e0b', '#3a2a0d'],
    [19, lit.green, '#22c55e', '#0d3a1a'],
  ];
  for (const [offset, on, onColor, offColor] of lamps) {
    ctx.fillStyle = on ? onColor : offColor;
    if (on) {
      ctx.shadowColor = onColor;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(x, y + offset, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
};

export interface IntersectionOptions {
  stopLine?: boolean;
  giveWayLine?: boolean;
  crosswalk?: boolean;
  crossTraffic?: boolean;
  /** Only branch off one side, for a T-junction or side street. */
  side?: 'left' | 'right';
}


/**
 * A junction built the way the crossroads in Level 2 is: the cross street is
 * laid in the same asphalt as the road you are on, with its own curbs, edge
 * lines and lane dashes broken where the two meet, and a junction box painted
 * on the overlap. The line you have to stop at sits where you actually arrive,
 * with the junction itself beyond it rather than around you.
 *
 * Shared rather than kept inside the junctions category: a signal-controlled
 * crossing (crossingRenderer.ts) is built as a real intersection too — "at a
 * light-controlled intersection" is the module's own definition of that
 * marking, not a plain crossing with a light bolted on — so this is the one
 * function both categories need.
 */
export const drawIntersection = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  options: IntersectionOptions = {}
): IntersectionGeometry => {
  const roadRight = roadX + ROAD_WIDTH;
  const { stopLineY, boxBottom, boxTop } = intersectionGeometry(screenY);

  // A side street only reaches out on one side; a crossroads spans the canvas.
  const leftEdge = options.side === 'right' ? roadX : 0;
  const rightEdge = options.side === 'left' ? roadRight : CANVAS_WIDTH;
  const hasLeftArm = leftEdge < roadX;
  const hasRightArm = rightEdge > roadRight;

  /** Runs a path along the cross street's arms, skipping the junction box. */
  const alongArms = (y: number) => {
    ctx.beginPath();
    if (hasLeftArm) {
      ctx.moveTo(leftEdge, y);
      ctx.lineTo(roadX, y);
    }
    if (hasRightArm) {
      ctx.moveTo(roadRight, y);
      ctx.lineTo(rightEdge, y);
    }
    ctx.stroke();
  };

  ctx.save();

  // curbs running along the cross street, stopping either side of the box.
  ctx.fillStyle = '#555a5e';
  for (const y of [boxTop - CURB_DEPTH, boxBottom]) {
    if (hasLeftArm) ctx.fillRect(leftEdge, y, roadX - leftEdge, CURB_DEPTH);
    if (hasRightArm) ctx.fillRect(roadRight, y, rightEdge - roadRight, CURB_DEPTH);
  }

  // Cross street, then the main road relaid through the box so the two join.
  laySurface(ctx, leftEdge, boxTop, rightEdge - leftEdge, CROSS_ROAD_WIDTH, 'across');
  laySurface(ctx, roadX, boxTop, ROAD_WIDTH, CROSS_ROAD_WIDTH, 'along');

  // Yellow edge lines of the cross street, broken at the box.
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  alongArms(boxTop + 2);
  alongArms(boxBottom - 2);

  // The main road keeps its own edge line on any side nothing branches off.
  ctx.beginPath();
  if (!hasLeftArm) {
    ctx.moveTo(roadX + 2, boxTop);
    ctx.lineTo(roadX + 2, boxBottom);
  }
  if (!hasRightArm) {
    ctx.moveTo(roadRight - 2, boxTop);
    ctx.lineTo(roadRight - 2, boxBottom);
  }
  ctx.stroke();

  // Lane markings of the cross street, all broken at the box.
  //
  // A single centre dash made the cross street read as one lane each way,
  // which is narrower than the road it meets — the junction looked like a
  // main road crossing an alley. Marking it as two lanes each way, with a
  // solid centre line dividing them, makes the two roads read as peers and
  // matches the layout the main carriageway is moving to.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([26, 18]);
  alongArms(boxTop + CROSS_ROAD_WIDTH * 0.25);
  alongArms(boxTop + CROSS_ROAD_WIDTH * 0.75);
  ctx.setLineDash([]);

  // Centre line of the cross street: solid yellow, the way the divide between
  // opposing directions is painted everywhere else in this game.
  ctx.strokeStyle = 'rgba(240,201,41,0.85)';
  ctx.lineWidth = 2.5;
  alongArms(boxTop + CROSS_ROAD_WIDTH / 2);

  // curb corners, rounded and picked out in yellow where the two roads meet.
  //
  // Square corners are what made the junction read as two strips of asphalt
  // overlapping rather than as a place where one road joins another; the
  // radius is the single detail that turns the four quadrants into corners.
  {
    // Scaled off the lane, so the corner stays the same fraction of the road it
    // rounds rather than shrinking into a nick as the carriageway widens.
    const CORNER_RADIUS = LANE_WIDTH * 0.34;
    ctx.strokeStyle = 'rgba(240,201,41,0.9)';
    ctx.lineWidth = 3;
    const corners: Array<[number, number, number, number]> = [];
    if (hasLeftArm) {
      corners.push([roadX, boxTop, -1, -1], [roadX, boxBottom, -1, 1]);
    }
    if (hasRightArm) {
      corners.push([roadRight, boxTop, 1, -1], [roadRight, boxBottom, 1, 1]);
    }
    for (const [cornerX, cornerY, xDir, yDir] of corners) {
      ctx.beginPath();
      ctx.moveTo(cornerX + xDir * CORNER_RADIUS, cornerY);
      ctx.quadraticCurveTo(cornerX, cornerY, cornerX, cornerY + yDir * CORNER_RADIUS);
      ctx.stroke();
    }
  }

  // Yellow box painted on the overlap itself, outlined with a single X corner
  // to corner — the "do not block the intersection" marking, box and cross,
  // the way the real thing is painted. The cross is load-bearing: a bare
  // outline reads as a blank panel sitting on the road, and a repeating
  // diagonal hatch reads as construction striping.
  //
  // Every junction gets one, side streets included. Relaying the main road
  // through the box wipes the lane dashes painted down the rest of the
  // carriageway, so an unmarked junction reads as a blank slab. Because
  // every junction already carries this box, the dedicated Yellow Box marking
  // event does not need to draw a second one of its own.
  {
    const boxLeft = roadX + 6;
    const boxRight = roadX + ROAD_WIDTH - 6;
    const hatchTop = boxTop + 6;
    const hatchBottom = boxTop + CROSS_ROAD_WIDTH - 6;
    ctx.strokeStyle = 'rgba(240,201,41,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(boxLeft, hatchTop, boxRight - boxLeft, hatchBottom - hatchTop);
    ctx.beginPath();
    ctx.moveTo(boxLeft, hatchTop);
    ctx.lineTo(boxRight, hatchBottom);
    ctx.moveTo(boxRight, hatchTop);
    ctx.lineTo(boxLeft, hatchBottom);
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Crossing and stop markings on your approach, between you and the box —
  // the same zebra bars every other pedestrian crossing in the game draws, so
  // a junction crossing reads as the same marking rather than a different one.
  if (options.crosswalk) {
    drawZebraStripes(ctx, roadX, boxBottom + 4, 15);
  }

  if (options.stopLine) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(roadX + 5, stopLineY, ROAD_WIDTH - 10, 6);
  } else if (options.giveWayLine) {
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 7]);
    ctx.beginPath();
    ctx.moveTo(roadX + 5, stopLineY + 2);
    ctx.lineTo(roadRight - 5, stopLineY + 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();

  // A vehicle waiting on the cross street, kept well clear of the box so it
  // never reads as something the player is about to drive into.
  if (options.crossTraffic && hasLeftArm) {
    drawCrossingCar(ctx, roadX - 58, boxTop + CROSS_ROAD_WIDTH * 0.72, '#dc2626');
  }

  return { boxTop, boxBottom, stopLineY };
};

/* ------------------------------------------------------------------------- *
 * Pavement markings
 *
 * A marking is not a sign and cannot be drawn like one: it has no post and no
 * face, it lies on the carriageway, and most of them run with the traffic
 * rather than standing beside it. That is why these get their own routine
 * instead of another `RoadsideSignArt` case — and why the switch in
 * `drawMarkingEvent` is on the marking's own art rather than on a `RoadScene`.
 * For a marking, the paint IS the scene. Shared because both the marking
 * dispatcher and the road-conditions category need at least one of
 * these (the railway advance warning paints its own "R" legend).
 * ------------------------------------------------------------------------- */

export interface PaintOptions {
  color: string;
  width?: number;
  dash?: [number, number];
}

/**
 * Strokes a line that runs with the traffic at a fixed offset from the road's
 * left edge, sampling the road at each row so the paint follows a bend instead
 * of cutting across the grass on the inside of it.
 */
export const paintAlong = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  offset: number,
  { color, width = 4, dash }: PaintOptions
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (let y = topY; y <= bottomY; y += 6) {
    const x = roadAt(y) + offset;
    if (y === topY) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
};

/** Strokes a line across the carriageway, the way a traverse marking runs. */
export const paintAcross = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  y: number,
  { color, width = 6, dash }: PaintOptions,
  inset = 4
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(roadX + inset, y);
  ctx.lineTo(roadX + ROAD_WIDTH - inset, y);
  ctx.stroke();
  ctx.restore();
};

/** Text painted flat on the road surface. */
export const paintLegend = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  size = 13,
  color = '#f8fafc'
) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Inter`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  ctx.restore();
};

/** Diagonal hatching inside a closing wedge, for a lane that is running out. */
export const hatchWedge = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  side: 'left' | 'right'
) => {
  ctx.save();
  ctx.strokeStyle = 'rgba(248,250,252,0.55)';
  ctx.lineWidth = 2;
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const y = topY + ((bottomY - topY) * i) / steps;
    const t = (y - topY) / (bottomY - topY);
    // The wedge is widest at the top, where the lane has already gone.
    const width = LANE_WIDTH * (1 - t);
    const roadX = roadAt(y);
    const inner = side === 'left' ? roadX + LANE_WIDTH : roadX + ROAD_WIDTH - LANE_WIDTH;
    const outer = side === 'left' ? inner - width : inner + width;
    ctx.beginPath();
    ctx.moveTo(inner, y);
    ctx.lineTo(outer, y + 10);
    ctx.stroke();
  }
  ctx.restore();
};

/**
 * The flashing "something is there" glyph, for a hazard nothing more specific
 * is known about. `alpha` pulses, and is computed by the scene rather than read
 * off a clock here, so the same frame paints the same picture twice.
 */
export const drawHazardGlyph = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number
) => {
  ctx.fillStyle = '#ef4444';
  ctx.globalAlpha = alpha;
  ctx.font = '28px serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠', x, y + 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 16);
  ctx.lineTo(x, y + 4);
  ctx.lineTo(x + 8, y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 5, y + 10, 10, 2);
};

/** The barrier line under an overtaking judgment: cross it and you have passed. */
export const drawOvertakingBarrier = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(roadX + 6, screenY + 20);
  ctx.lineTo(roadX + ROAD_WIDTH - 6, screenY + 20);
  ctx.stroke();
  ctx.setLineDash([]);
};
