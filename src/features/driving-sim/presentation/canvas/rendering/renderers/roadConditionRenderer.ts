/**
 * Road alignment, width, terrain and surface conditions: the `bend`, `hump`,
 * `uneven`, `wet`, `flood`, `gradient_up`/`gradient_down`, `narrows`,
 * `divided_start`/`divided_end`, `bridge`, `two_way`, `railway` and
 * `roadwork` `RoadScene`s, plus the pavement markings that go with railway
 * and rumble-strip events. `drawWetRoad` and `drawGradient` are also reused
 * by the emergency-scene dispatcher in index.ts (a skid's wet surface, a
 * brake-loss descent).
 */
import { CANVAS_WIDTH, ROAD_WIDTH, LANE_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawChevron, drawTrafficCone, laySurface, drawOncomingVehicle, paintLegend } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';
import { roadworkGeometry, rockfallPositions, twoWayOncomingPoint, type BarrierGeometry } from '@/features/driving-sim/domain/world/sceneGeometry';

/**
 * Chevrons lining the outside of a bend.
 *
 * This used to paint a curb bulging into the carriageway, because the road was
 * straight and the bend had to be implied by something. The road bends for real
 * now, so that bulge became a lie — it depicted a narrowing nothing enforced,
 * and the car drove clean through it. The chevrons stand on the verge, which is
 * where chevrons stand, and the curve behind them does the rest.
 */
const drawBendScene = (ctx: CanvasRenderingContext2D, roadAt: RoadAt, screenY: number) => {
  // Each chevron stands on the verge beside the piece of road it marks. They
  // are spread down the screen, and on a bend that is exactly where the road is
  // moving, so each one asks for its own row.
  for (const offset of [-38, -8, 22]) {
    const y = screenY + offset;
    drawChevron(ctx, roadAt(y) + ROAD_WIDTH + 13, y);
  }
};

/**
 * Striped board standing across a closed part of the carriageway.
 *
 * Drawn from the board the scene declared, never from a width of its own. It
 * used to paint 55% of the road while the body it stood for covered one lane,
 * so the picture said the whole carriageway was shut and the driver swerved
 * onto the oncoming half to get round a closure that was never there.
 */
const drawObstructionBoard = (ctx: CanvasRenderingContext2D, board: BarrierGeometry) => {
  const { x: boardX, y: boardY, width, height } = board;
  const bottom = boardY + height;
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(boardX, boardY, width, height);
  ctx.fillStyle = '#dc2626';
  for (let i = 0; i < width; i += 22) {
    ctx.beginPath();
    ctx.moveTo(boardX + i, bottom);
    ctx.lineTo(boardX + i + 11, bottom);
    ctx.lineTo(boardX + i + 22, boardY);
    ctx.lineTo(boardX + i + 11, boardY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(boardX, boardY, width, height);
  ctx.fillStyle = '#475569';
  ctx.fillRect(boardX + 4, bottom, 5, 14);
  ctx.fillRect(boardX + width - 9, bottom, 5, 14);
  ctx.restore();
};

/**
 * Cones tapering the lane down past a work zone. The board and the cones are
 * solid: a closure you can drive straight through teaches nothing. The taper
 * always leaves the left lane open, which is what the sign's lane requirement
 * tells the driver to take.
 */
const drawRoadworkScene = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const roadRight = roadX + ROAD_WIDTH;
  const work = roadworkGeometry(roadX, screenY);
  // Exactly the curb lane, which is what the scene's `narrowsTo: 0.75` shuts.
  const closedWidth = work.closedWidth;
  ctx.save();
  ctx.fillStyle = 'rgba(251,146,60,0.16)';
  ctx.fillRect(roadRight - closedWidth, screenY - 34, closedWidth, 78);
  ctx.restore();

  drawObstructionBoard(ctx, work.barrier);

  for (const cone of work.cones) {
    drawTrafficCone(ctx, cone.x, cone.y, 0.55);
  }
};

/** Rails and sleepers cutting across the carriageway, with a stop line. */
const drawRailwayCrossing = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const top = screenY - 46;
  ctx.save();
  // Ballast bed across the full width, tracks continuing past the curbs.
  ctx.fillStyle = '#4b4740';
  ctx.fillRect(0, top, CANVAS_WIDTH, 38);
  ctx.fillStyle = '#5f5850';
  for (let x = 4; x < CANVAS_WIDTH; x += 22) {
    ctx.fillRect(x, top + 3, 14, 32);
  }
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, top + 8, CANVAS_WIDTH, 4);
  ctx.fillRect(0, top + 26, CANVAS_WIDTH, 4);

  // Stop line on your approach.
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(roadX + 5, screenY + 8, ROAD_WIDTH - 10, 6);
  ctx.restore();
};

/** A raised hump banded across the carriageway. */
const drawHump = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  ctx.save();
  const crest = ctx.createLinearGradient(0, screenY - 18, 0, screenY + 18);
  crest.addColorStop(0, '#4a4a62');
  crest.addColorStop(0.5, '#6b6b86');
  crest.addColorStop(1, '#33334a');
  ctx.fillStyle = crest;
  ctx.fillRect(roadX, screenY - 18, ROAD_WIDTH, 36);

  ctx.fillStyle = '#f8fafc';
  for (let i = 0; i < ROAD_WIDTH; i += 26) {
    ctx.fillRect(roadX + i, screenY - 18, 13, 36);
  }
  ctx.fillStyle = 'rgba(17,24,39,0.35)';
  ctx.fillRect(roadX, screenY + 12, ROAD_WIDTH, 6);
  ctx.restore();
};

/** Broken, patched surface. */
const drawUnevenSurface = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(20,20,28,0.55)';
  const patches: [number, number, number, number][] = [
    [18, -34, 46, 20], [82, -8, 62, 24], [30, 22, 52, 18],
    [120, 34, 44, 16], [58, -56, 38, 14], [140, -40, 40, 18],
  ];
  for (const [dx, dy, w, h] of patches) {
    ctx.beginPath();
    ctx.ellipse(roadX + dx + w / 2, screenY + dy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(15,15,22,0.7)';
  ctx.lineWidth = 2;
  for (const [dx, dy, w] of patches) {
    ctx.beginPath();
    ctx.moveTo(roadX + dx, screenY + dy - 6);
    ctx.lineTo(roadX + dx + w * 0.6, screenY + dy + 8);
    ctx.stroke();
  }
  ctx.restore();
};

/** A wet sheen with the reflections that come with it. */
const drawWetRoad = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(96,140,180,0.26)';
  ctx.fillRect(roadX, screenY - 90, ROAD_WIDTH, 180);
  ctx.fillStyle = 'rgba(210,235,255,0.22)';
  for (let i = 0; i < 7; i++) {
    const y = screenY - 78 + i * 24;
    ctx.fillRect(roadX + 12 + (i % 3) * 46, y, 44, 4);
  }
  ctx.restore();
};

/** Standing water across the carriageway. */
const drawFloodWater = (ctx: CanvasRenderingContext2D, screenY: number) => {
  ctx.save();
  const water = ctx.createLinearGradient(0, screenY - 55, 0, screenY + 55);
  water.addColorStop(0, 'rgba(52,92,126,0.85)');
  water.addColorStop(0.5, 'rgba(74,124,160,0.9)');
  water.addColorStop(1, 'rgba(52,92,126,0.85)');
  ctx.fillStyle = water;
  ctx.fillRect(0, screenY - 55, CANVAS_WIDTH, 110);

  ctx.strokeStyle = 'rgba(226,240,252,0.4)';
  ctx.lineWidth = 2;
  const drift = (Date.now() % 3000) / 3000;
  for (let i = 0; i < 5; i++) {
    const y = screenY - 44 + ((i + drift) % 5) * 22;
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += 16) {
      const wobble = Math.sin((x + i * 40) * 0.05) * 3;
      if (x === 0) ctx.moveTo(x, y + wobble);
      else ctx.lineTo(x, y + wobble);
    }
    ctx.stroke();
  }
  ctx.restore();
};

/** A climb or a descent, shaded so the grade reads at a glance. */
const drawGradient = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  direction: 'up' | 'down'
) => {
  // The view here is from directly above, so a grade cannot be shown by hiding
  // the road beyond a crest — there is no horizon to hide it behind. It is
  // shown instead the way a map shows one: shading across the slope, and
  // repeated arrows pointing the way the road falls.
  const top = screenY - 130;
  const height = 220;
  const climbing = direction === 'up';

  ctx.save();
  const shade = ctx.createLinearGradient(0, top, 0, top + height);
  if (climbing) {
    shade.addColorStop(0, 'rgba(226,236,255,0.26)');
    shade.addColorStop(0.75, 'rgba(226,236,255,0.05)');
    shade.addColorStop(1, 'rgba(226,236,255,0)');
  } else {
    shade.addColorStop(0, 'rgba(6,10,20,0.34)');
    shade.addColorStop(0.75, 'rgba(6,10,20,0.07)');
    shade.addColorStop(1, 'rgba(6,10,20,0)');
  }
  ctx.fillStyle = shade;
  ctx.fillRect(roadX, top, ROAD_WIDTH, height);

  // Slope bars across the carriageway, tightening toward the steepest part.
  ctx.strokeStyle = climbing ? 'rgba(236,242,255,0.35)' : 'rgba(8,12,22,0.4)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const y = top + 18 + i * 30;
    const inset = 10 + i * 5;
    ctx.beginPath();
    ctx.moveTo(roadX + inset, y);
    ctx.quadraticCurveTo(roadX + ROAD_WIDTH / 2, y + (climbing ? -9 : 9), roadX + ROAD_WIDTH - inset, y);
    ctx.stroke();
  }

  // Chevrons on the verge pointing up or down the grade.
  ctx.fillStyle = climbing ? 'rgba(236,242,255,0.5)' : 'rgba(8,12,22,0.55)';
  for (let i = 0; i < 3; i++) {
    const y = top + 46 + i * 54;
    const tip = climbing ? y - 12 : y + 12;
    for (const x of [roadX - 14, roadX + ROAD_WIDTH + 14]) {
      ctx.beginPath();
      ctx.moveTo(x, tip);
      ctx.lineTo(x - 7, y + (climbing ? 6 : -6));
      ctx.lineTo(x + 7, y + (climbing ? 6 : -6));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
};

/** curbs pinching in from both sides. */
const drawNarrowing = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  const roadRight = roadX + ROAD_WIDTH;
  const squeeze = ROAD_WIDTH * 0.22;

  ctx.save();
  ctx.fillStyle = '#555a5e';
  ctx.beginPath();
  ctx.moveTo(roadX, screenY + 90);
  ctx.lineTo(roadX + squeeze, screenY - 40);
  ctx.lineTo(roadX + squeeze, screenY - 110);
  ctx.lineTo(roadX - 26, screenY - 110);
  ctx.lineTo(roadX - 26, screenY + 90);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(roadRight, screenY + 90);
  ctx.lineTo(roadRight - squeeze, screenY - 40);
  ctx.lineTo(roadRight - squeeze, screenY - 110);
  ctx.lineTo(roadRight + 26, screenY - 110);
  ctx.lineTo(roadRight + 26, screenY + 90);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(roadX + 2, screenY + 90);
  ctx.lineTo(roadX + squeeze + 2, screenY - 40);
  ctx.lineTo(roadX + squeeze + 2, screenY - 110);
  ctx.moveTo(roadRight - 2, screenY + 90);
  ctx.lineTo(roadRight - squeeze - 2, screenY - 40);
  ctx.lineTo(roadRight - squeeze - 2, screenY - 110);
  ctx.stroke();
  ctx.restore();
};

/** A central median beginning or ending. */
const drawMedian = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  phase: 'start' | 'end'
) => {
  const cx = roadX + ROAD_WIDTH / 2;
  const nose = phase === 'start' ? screenY + 30 : screenY - 30;
  const tail = phase === 'start' ? screenY - 150 : screenY + 150;

  ctx.save();
  ctx.fillStyle = '#555a5e';
  ctx.beginPath();
  ctx.moveTo(cx, nose);
  ctx.lineTo(cx - 16, nose + (phase === 'start' ? -34 : 34));
  ctx.lineTo(cx - 16, tail);
  ctx.lineTo(cx + 16, tail);
  ctx.lineTo(cx + 16, nose + (phase === 'start' ? -34 : 34));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2d5a3f';
  ctx.fillRect(cx - 10, Math.min(nose, tail) + 12, 20, Math.abs(tail - nose) - 24);

  // Hazard marker on the nose facing the traffic that meets it first.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(cx - 11, nose - (phase === 'start' ? 8 : 0), 22, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cx - 11, nose - (phase === 'start' ? 8 : 0), 11, 10);
  ctx.restore();
};

/** A bridge deck with parapets and expansion joints. */
const drawBridge = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  const roadRight = roadX + ROAD_WIDTH;
  ctx.save();
  // Water beneath, showing through either side of the deck.
  ctx.fillStyle = '#2c4a5e';
  ctx.fillRect(0, screenY - 120, CANVAS_WIDTH, 240);
  laySurface(ctx, roadX - 8, screenY - 120, ROAD_WIDTH + 16, 240, 'along');

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(roadX - 14, screenY - 120, 10, 240);
  ctx.fillRect(roadRight + 4, screenY - 120, 10, 240);
  ctx.fillStyle = '#64748b';
  for (let y = screenY - 116; y < screenY + 120; y += 26) {
    ctx.fillRect(roadX - 14, y, 10, 5);
    ctx.fillRect(roadRight + 4, y, 10, 5);
  }

  ctx.fillStyle = 'rgba(15,23,42,0.5)';
  ctx.fillRect(roadX, screenY - 118, ROAD_WIDTH, 5);
  ctx.fillRect(roadX, screenY + 113, ROAD_WIDTH, 5);
  ctx.restore();
};

/** Loose rock fallen from the cutting alongside the road. */

/**
 * The setting a road crash sits in: debris across the asphalt, and the vehicle
 * that left the road lying in the water beside it.
 *
 * Everything the scenario's own words promise and the wreck alone cannot show.
 * None of it is solid — the only thing the driver can hit is the wreck, which
 * is composed alongside this as a `road-actor` by the same prefab, so what is
 * seen and what is struck come from one declaration.
 */
const drawCrashScene = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.save();

  // The creek off the right-hand shoulder, and the van nose-down in it. Drawn
  // beyond the carriageway, so it reads as "left the road" rather than as
  // traffic.
  const waterX = roadX + ROAD_WIDTH + 6;
  ctx.fillStyle = 'rgba(12,74,110,0.55)';
  ctx.beginPath();
  ctx.ellipse(waterX + 26, screenY + 6, 40, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(186,230,253,0.45)';
  ctx.lineWidth = 1.4;
  for (const r of [18, 27]) {
    ctx.beginPath();
    ctx.ellipse(waterX + 26, screenY + 6, r + 10, r * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(waterX + 24, screenY + 2);
  ctx.rotate(0.6);
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-13, -22, 26, 44, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,232,240,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // The half of it already under: the reason this is urgent rather than untidy.
  ctx.fillStyle = 'rgba(12,74,110,0.66)';
  ctx.beginPath();
  ctx.roundRect(-13, 2, 26, 20, 4);
  ctx.fill();
  ctx.restore();

  // Debris scattered between the two, thickest near the wreck.
  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  for (const [dx, dy, w, h] of [
    [18, -26, 7, 4],
    [46, -12, 5, 5],
    [30, 10, 9, 3],
    [62, 4, 6, 4],
    [8, 20, 5, 5],
    [74, -22, 4, 4],
    [52, 26, 7, 3],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(roadX + dx, screenY + dy, w, h, 1);
    ctx.fill();
  }

  // A skid mark running into the wreck, so the crash reads as something that
  // happened rather than something that was placed.
  ctx.strokeStyle = 'rgba(24,24,27,0.5)';
  ctx.lineWidth = 4;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(roadX + ROAD_WIDTH * 0.42, screenY + 74);
  ctx.quadraticCurveTo(
    roadX + ROAD_WIDTH * 0.46,
    screenY + 28,
    roadX + ROAD_WIDTH * 0.32,
    screenY + 4
  );
  ctx.stroke();

  ctx.restore();
};

const drawRockfall = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.save();
  // Cut face rising on the left of the carriageway, broken into irregular
  // blocks. Even banding read as a ladder rather than as rock.
  const faceWidth = roadX - 6;
  const face = ctx.createLinearGradient(0, 0, faceWidth, 0);
  face.addColorStop(0, '#4a4139');
  face.addColorStop(1, '#6a5f53');
  ctx.fillStyle = face;
  ctx.fillRect(0, screenY - 130, faceWidth, 260);

  // Irregular facets. Anything evenly spaced or rectangular reads as masonry
  // rather than as a rock cutting, so both the shapes and the shading vary.
  const facets: [number, number, number, number, number][] = [
    [-6, -132, 54, 46, 0.10], [34, -118, 44, 62, -0.22], [4, -80, 38, 40, 0.07],
    [44, -58, 46, 36, -0.18], [-4, -40, 50, 58, -0.12], [40, -6, 40, 52, 0.09],
    [2, 26, 44, 44, -0.20], [46, 44, 38, 60, 0.06], [-2, 74, 52, 50, -0.15],
    [38, 100, 42, 40, 0.08],
  ];
  for (const [dx, dy, w, h, tone] of facets) {
    ctx.fillStyle = tone > 0 ? `rgba(255,246,232,${tone})` : `rgba(0,0,0,${-tone})`;
    ctx.beginPath();
    ctx.moveTo(dx, screenY + dy);
    ctx.lineTo(dx + w, screenY + dy + h * 0.18);
    ctx.lineTo(dx + w * 0.72, screenY + dy + h);
    ctx.lineTo(dx - 6, screenY + dy + h * 0.68);
    ctx.closePath();
    ctx.fill();
  }
  // Ragged lip where the cutting meets the carriageway.
  ctx.fillStyle = 'rgba(18,14,10,0.55)';
  ctx.beginPath();
  ctx.moveTo(faceWidth, screenY - 130);
  for (let y = screenY - 130; y <= screenY + 130; y += 26) {
    ctx.lineTo(faceWidth - (y % 52 === 0 ? 9 : 3), y + 13);
  }
  ctx.lineTo(faceWidth, screenY + 130);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Spread across the carriageway rather than hugging the cliff. Fixed offsets
  // of 26, 54 and 12 kept every rock within the first lane, which on a two-way
  // road is the oncoming side — a hazard the driver is required to slow for and
  // could never actually meet.
  for (const { x, y, radius: r } of rockfallPositions(roadX, screenY)) {
    ctx.save();
    ctx.fillStyle = '#6b6157';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.82, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

/** Opposing traffic, with the centre line changed to match. */
const drawTwoWayTraffic = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.save();
  // Double solid yellow: no overtaking, opposing traffic either side of it.
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  for (const offset of [-6, 6]) {
    ctx.beginPath();
    ctx.moveTo(roadX + ROAD_WIDTH / 2 + offset, screenY - 150);
    ctx.lineTo(roadX + ROAD_WIDTH / 2 + offset, screenY + 150);
    ctx.stroke();
  }
  // Mask the lane dashes on the opposing side, which now runs the other way.
  ctx.fillStyle = '#37374d';
  ctx.fillRect(roadX + LANE_WIDTH - 2, screenY - 150, 4, 300);
  ctx.restore();

  const oncoming = twoWayOncomingPoint(roadX, screenY);
  drawOncomingVehicle(ctx, oncoming.x, oncoming.y, 1);
};

/** Transverse bars that hum and shake the car when driven over at speed. */
const drawRumbleStrips = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  topY: number,
  bottomY: number
) => {
  ctx.save();
  for (let y = topY; y <= bottomY; y += 13) {
    const roadX = roadAt(y);
    ctx.fillStyle = 'rgba(248,250,252,0.85)';
    ctx.fillRect(roadX + 8, y, ROAD_WIDTH - 16, 5);
    // A raised bar throws a shadow on its far side; without one the strip
    // reads as flat paint, which is the one thing it is not.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(roadX + 8, y + 5, ROAD_WIDTH - 16, 2);
  }
  ctx.restore();
};

/** The advance warning painted on the road before a level crossing. */
const drawRailwayPavementMarking = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const centreX = roadX + ROAD_WIDTH / 2;
  ctx.save();
  paintLegend(ctx, centreX, screenY - 26, 'R', 32);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(centreX - 34, screenY + 2);
  ctx.lineTo(centreX + 34, screenY + 2);
  ctx.moveTo(centreX - 34, screenY + 18);
  ctx.lineTo(centreX + 34, screenY + 18);
  ctx.moveTo(centreX - 18, screenY - 8);
  ctx.lineTo(centreX - 18, screenY + 28);
  ctx.moveTo(centreX + 18, screenY - 8);
  ctx.lineTo(centreX + 18, screenY + 28);
  ctx.stroke();
  ctx.restore();
};

export {
  drawBendScene,
  drawHump,
  drawUnevenSurface,
  drawWetRoad,
  drawFloodWater,
  drawGradient,
  drawNarrowing,
  drawMedian,
  drawBridge,
  drawTwoWayTraffic,
  drawRumbleStrips,
  drawRailwayCrossing,
  drawRailwayPavementMarking,
  drawCrashScene,
  drawRockfall,
  drawRoadworkScene,
};

/**
 * The debris a blown tyre leaves across the lane: broken concrete, drawn flat.
 *
 * No hitbox, on purpose. This is the cause of the emergency rather than an
 * obstacle to avoid, and made solid it would end the run on contact instead of
 * opening the emergency it exists to cause.
 */
export const drawBlowoutDebris = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const slabs: Array<[number, number, number]> = [
    [0.34, -6, 15], [0.48, 4, 20], [0.62, -2, 13], [0.55, 16, 10],
  ];
  for (const [across, dy, size] of slabs) {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(roadX + ROAD_WIDTH * across, screenY + dy - size * 0.5);
    ctx.lineTo(roadX + ROAD_WIDTH * across + size, screenY + dy);
    ctx.lineTo(roadX + ROAD_WIDTH * across + size * 0.4, screenY + dy + size * 0.55);
    ctx.lineTo(roadX + ROAD_WIDTH * across - size * 0.35, screenY + dy + size * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};
