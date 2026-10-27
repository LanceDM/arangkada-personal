/**
 * Junction geometry: crossroads, T-junctions, the give-way side street,
 * roundabouts, merges and toll plazas — everything a `RoadScene` of
 * `intersection`, `side_road`, `junction_t`, `signal`, `merge`, `toll`, or a
 * `scenario_trigger`/`maneuver` turn stands on. `drawIntersection` itself (the
 * shared crossroads surface both this file and crossingRenderer.ts build on) lives in
 * renderPrimitives.ts; this file is what is built on top of it.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT, ROAD_WIDTH, LANE_WIDTH, LANE_COUNT, ROUNDABOUT_PATH_RADIUS, laneEdges, laneCentreX, type LaneIndex, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawIntersection, drawCrossingCar, drawRoadsideSign, drawLaneArrow, drawOncomingVehicle, laySurface, } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import {
  CROSS_LANE,
  CROSS_ROAD_WIDTH,
  CURB_DEPTH,
  STOP_LINE_SETBACK,
  junctionExitY,
  type IntersectionGeometry,
} from '@/features/driving-sim/domain/world/junctionGeometry';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';
import { mergeLaneGeometry, tollGateBarriers, type MainRoadTraffic } from '@/features/driving-sim/domain/world/sceneGeometry';
import type { GantryPanel } from '@/features/driving-sim/domain/scene/SceneNode';

const drawCrossStreet = (ctx: CanvasRenderingContext2D, screenY: number) => {
  drawIntersection(ctx, (CANVAS_WIDTH - ROAD_WIDTH) / 2, screenY, { crossTraffic: true });
};

/**
 * The path a turn takes through the junction: up the lane it must be made from,
 * into the middle of the cross street, and out along it.
 *
 * Drawn to the same row `junctionExitY` gives the driving car, so the guide and
 * the manoeuvre the simulation actually performs describe one path rather than
 * two. It is a guide, not a decoration: the lane it starts in is the lane the
 * turn is refused from anywhere else, so this is the picture of the answer, and
 * the scene only asks for it where the support level shows the answer.
 */
const drawTurnPath = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  geometry: IntersectionGeometry,
  direction: 'left' | 'right',
  lane: LaneIndex
) => {
  const startX = laneCentreX(lane, roadX);
  const crossY = junctionExitY(screenY, direction);
  const outward = direction === 'right' ? 1 : -1;
  const endX = direction === 'right' ? CANVAS_WIDTH - 26 : 26;

  ctx.save();
  ctx.strokeStyle = 'rgba(240,201,41,0.9)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Straight up the lane, then a quadratic that leaves the corridor along the
  // cross street. The control point sits directly above the start, which is
  // what makes the car travel forward into the junction before it swings —
  // the same shape the turn animation uses, and the reason a turn does not
  // slide sideways over the curb.
  // The swing is sized off the lane, so the arc stays a lane-change-sized curve
  // rather than a flick that widens into a hairpin as the road grows.
  const swing = LANE_WIDTH * 0.7;
  ctx.beginPath();
  ctx.moveTo(startX, geometry.stopLineY + 34);
  ctx.lineTo(startX, crossY + CROSS_LANE * 0.55);
  ctx.quadraticCurveTo(startX, crossY, startX + outward * swing, crossY);
  ctx.lineTo(endX - outward * 16, crossY);
  ctx.stroke();

  // Arrow head, pointing the way out.
  ctx.fillStyle = 'rgba(240,201,41,0.95)';
  ctx.beginPath();
  ctx.moveTo(endX, crossY);
  ctx.lineTo(endX - outward * 18, crossY - 11);
  ctx.lineTo(endX - outward * 18, crossY + 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawMergeArrows = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  ctx.save();
  ctx.strokeStyle = '#f0c929';
  ctx.fillStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(roadX + ROAD_WIDTH + 30, screenY + 40);
  ctx.lineTo(roadX + ROAD_WIDTH - 20, screenY - 30);
  ctx.stroke();
  ctx.setLineDash([]);
  drawLaneArrow(ctx, roadX + ROAD_WIDTH - 20, screenY - 30, 'up', '#f0c929');
  ctx.restore();
};

/**
 * Paved ring radii. The circulating lane is centred on `ROUNDABOUT_PATH_RADIUS`
 * from vehiclePhysics, which is the same figure updateNpcVehicles circulates the NPC
 * on — the constant lives there precisely so the carriageway drawn here and
 * the car driven round it can never drift apart.
 */
const ROUNDABOUT_RING_OUTER = 118;
const ROUNDABOUT_RING_INNER = 58;
const ROUNDABOUT_ISLAND = 52;
/** How tall the paved plaza around the ring is, top to bottom. */
const ROUNDABOUT_BAND = 300;
/** Half-height of the left and right arms where they meet the plaza. */
const ROUNDABOUT_ARM_HALF = 60;
/**
 * How hard the grass corners are rounded off where the arms meet the road.
 *
 * `ROUNDABOUT_ARM_HALF` is chosen so the square corner of a quadrant lands
 * almost exactly on the ring — sqrt(100² + 60²) is 117 against a ring of 118 —
 * which is what keeps the grass tight against the circulating carriageway
 * instead of leaving a wide apron of empty asphalt around it. The rounding is
 * therefore only a fillet on a corner that already sits where it should be,
 * not a way of pulling a distant corner inwards.
 */
const ROUNDABOUT_CORNER = 30;
/** Width of the paved footway between the yellow edge line and the grass. */
const ROUNDABOUT_WALK = 14;

/** Grass, curb and tree colours, matching the roadside the rest of the drive uses. */
const GRASS = '#1d4427';
const GRASS_LIT = '#245231';
const WALKWAY = '#5b6066';

/** Which corner of a grass quadrant faces the junction and gets rounded off. */
type QuadrantCorner = 'tl' | 'tr' | 'bl' | 'br';

const cornerRadii = (corner: QuadrantCorner, r: number): [number, number, number, number] => ({
  tl: [r, 0, 0, 0] as [number, number, number, number],
  tr: [0, r, 0, 0] as [number, number, number, number],
  br: [0, 0, r, 0] as [number, number, number, number],
  bl: [0, 0, 0, r] as [number, number, number, number],
}[corner]);

/**
 * One corner block of land between two arms of the roundabout: a paved footway
 * with a yellow edge line along the carriageway, and grass with a rounded
 * corner behind it.
 *
 * Rounding is what makes the junction read as a roundabout rather than as a
 * circle dropped on a crossroads — a vehicle sweeping from one arm to the next
 * follows a curve, and the curb it follows has to curve with it.
 */
const drawRoundaboutQuadrant = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  corner: QuadrantCorner
) => {
  if (width <= 0 || height <= 0) return;

  // Footway first, filling the whole block, then grass inset from whichever two
  // sides face the carriageway — the strip of footway left showing is the
  // pavement, and it wraps the rounded corner for free.
  ctx.fillStyle = WALKWAY;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadii(corner, ROUNDABOUT_CORNER + ROUNDABOUT_WALK));
  ctx.fill();

  // The yellow edge line runs along that same outline, so it curves through the
  // corner exactly as the curb does.
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.stroke();

  const fromLeft = corner === 'tl' || corner === 'bl';
  const fromTop = corner === 'tl' || corner === 'tr';
  ctx.fillStyle = GRASS;
  ctx.beginPath();
  ctx.roundRect(
    x + (fromLeft ? ROUNDABOUT_WALK : 0),
    y + (fromTop ? ROUNDABOUT_WALK : 0),
    width - ROUNDABOUT_WALK,
    height - ROUNDABOUT_WALK,
    cornerRadii(corner, ROUNDABOUT_CORNER)
  );
  ctx.fill();
};

/** A tree in the same two-blob style the roadside scenery uses. */
const drawSceneryTree = (ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) => {
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x - 1.5 * scale, y - 4 * scale, 3 * scale, 12 * scale);
  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.arc(x, y - 9 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#388e3c';
  ctx.beginPath();
  ctx.arc(x + 2 * scale, y - 11 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
};

/** A lit block of flats, matching the buildings the roadside already draws. */
const drawSceneryBuilding = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = '#546e7a';
  ctx.fillRect(x - 11, y - 26, 22, 26);
  ctx.fillStyle = '#fff9c4';
  for (let wy = 0; wy < 3; wy++) {
    for (let wx = 0; wx < 2; wx++) {
      ctx.fillRect(x - 7 + wx * 9, y - 22 + wy * 8, 4, 4);
    }
  }
};

/**
 * A four-arm roundabout: a road in from the bottom, one out the top, an arm to
 * each side, and a planted island inside a circulating ring, with footways,
 * curb curves, buildings and trees filling the four corners.
 *
 * The side arms are scenery, and deliberately so. This corridor only ever
 * scrolls straight (see the `RoadScene` note on why), so there is no second
 * road the drive could actually turn into — but a roundabout with no other
 * approaches is not a roundabout, it is a traffic island, and the whole rule
 * being taught here is about vehicles arriving from the arms you cannot take.
 * Drawing them costs nothing and is the difference between a junction the
 * player recognises and a grey circle.
 *
 * The event that uses this freezes into `RoadDecision` on arrival, so
 * this scene is what the player reads on the approach and drives away through
 * afterwards, while the frozen prompt shows the same junction from above.
 */
const drawRoundaboutScene = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const roadRight = roadX + ROAD_WIDTH;
  const cx = roadX + ROAD_WIDTH / 2;
  const bandTop = screenY - ROUNDABOUT_BAND / 2;
  const bandBottom = screenY + ROUNDABOUT_BAND / 2;
  const armTop = screenY - ROUNDABOUT_ARM_HALF;
  const armBottom = screenY + ROUNDABOUT_ARM_HALF;

  ctx.save();

  // Everything is asphalt to begin with; the corner blocks below carve the
  // four arms back out of it, which is far easier to keep watertight than
  // trying to lay four arms and a circle that meet without seams.
  laySurface(ctx, 0, bandTop, CANVAS_WIDTH, ROUNDABOUT_BAND, 'across');
  laySurface(ctx, roadX, bandTop, ROAD_WIDTH, ROUNDABOUT_BAND, 'along');

  drawRoundaboutQuadrant(ctx, 0, bandTop, roadX, armTop - bandTop, 'br');
  drawRoundaboutQuadrant(ctx, roadRight, bandTop, CANVAS_WIDTH - roadRight, armTop - bandTop, 'bl');
  drawRoundaboutQuadrant(ctx, 0, armBottom, roadX, bandBottom - armBottom, 'tr');
  drawRoundaboutQuadrant(ctx, roadRight, armBottom, CANVAS_WIDTH - roadRight, bandBottom - armBottom, 'tl');

  // Lane dashes on the side arms, broken well clear of the ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.moveTo(0, screenY);
  ctx.lineTo(cx - ROUNDABOUT_RING_OUTER - 12, screenY);
  ctx.moveTo(cx + ROUNDABOUT_RING_OUTER + 12, screenY);
  ctx.lineTo(CANVAS_WIDTH, screenY);
  // And on the approach and exit of the road actually being driven.
  ctx.moveTo(cx, bandTop);
  ctx.lineTo(cx, screenY - ROUNDABOUT_RING_OUTER - 12);
  ctx.moveTo(cx, screenY + ROUNDABOUT_RING_OUTER + 30);
  ctx.lineTo(cx, bandBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Circulating carriageway: a wide ring of asphalt with a yellow curb line at
  // each edge and a dashed lane guide down the middle of it.
  ctx.fillStyle = '#3a3a50';
  ctx.beginPath();
  ctx.arc(cx, screenY, ROUNDABOUT_RING_OUTER, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 9]);
  ctx.beginPath();
  ctx.arc(cx, screenY, ROUNDABOUT_PATH_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // curbed island, with a paved apron between it and the running lane.
  ctx.fillStyle = WALKWAY;
  ctx.beginPath();
  ctx.arc(cx, screenY, ROUNDABOUT_RING_INNER, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = GRASS_LIT;
  ctx.beginPath();
  ctx.arc(cx, screenY, ROUNDABOUT_ISLAND, 0, Math.PI * 2);
  ctx.fill();
  for (const [dx, dy] of [[-19, -14], [19, -12], [-16, 18], [17, 16]]) {
    drawSceneryTree(ctx, cx + dx, screenY + dy, 1.05);
  }

  // Give-way teeth and holding line at the entry: the "yield to whatever is
  // already going round" cue, and the line the frozen prompt holds you at.
  //
  // Only on the player's own entry lanes — the right half, from the centre line
  // to the curb. The give-way marking governs the driver entering; carried
  // across the oncoming lanes it would mark an entry nobody in this scene
  // uses.
  const entryY = screenY + ROUNDABOUT_RING_OUTER + 18;
  const entryLeft = cx + 4;
  const entryRight = roadRight - 6;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 3;
  ctx.setLineDash([9, 6]);
  ctx.beginPath();
  ctx.moveTo(entryLeft, entryY + 6);
  ctx.lineTo(entryRight, entryY + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#eab308';
  const teeth = 4;
  for (let i = 0; i < teeth; i++) {
    const tx = entryLeft + 4 + (i + 0.5) * ((entryRight - entryLeft - 8) / teeth);
    ctx.beginPath();
    ctx.moveTo(tx - 5, entryY);
    ctx.lineTo(tx + 5, entryY);
    ctx.lineTo(tx, entryY - 10);
    ctx.closePath();
    ctx.fill();
  }

  // The town around the junction. Each quadrant is only about 90px deep once
  // the arms are cut out of it, and the rounded corner takes a bite out of the
  // side nearest the ring, so everything is set well back towards the outer
  // edges where there is actually grass to stand on.
  drawSceneryBuilding(ctx, 32, armTop - 34);
  drawSceneryTree(ctx, 66, armTop - 26);
  drawSceneryTree(ctx, 20, bandTop + 34);

  drawSceneryBuilding(ctx, CANVAS_WIDTH - 32, armTop - 34);
  drawSceneryTree(ctx, CANVAS_WIDTH - 66, armTop - 26);

  drawSceneryTree(ctx, 62, armBottom + 44);
  drawSceneryBuilding(ctx, 28, bandBottom - 14);

  drawSceneryTree(ctx, CANVAS_WIDTH - 62, armBottom + 44);
  drawSceneryBuilding(ctx, CANVAS_WIDTH - 28, bandBottom - 14);

  ctx.restore();
};

/**
 * The crossing road runs in cycles with a genuine clear window rather than an
 * endless stream. Waiting for that gap is exactly the lesson ("yield until
 * there is a safe gap"), and it means driving on after a correct call is safe
 * instead of a coin flip.
 */

// Anchored in the world like everything else, never pinned to a screen row:
// the junction holds still exactly when you do, because you are the thing that
// stopped moving. Pinned, it would travel down the road with a driver who
// never stopped for it.

/**
 * Full crossroads: a main road crossing yours, drawn with the same surface,
 * curbs and edge lines as the road you are driving on, with the junction
 * markings painted onto the asphalt itself.
 */
const drawMainRoadJunction = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  traffic: MainRoadTraffic
) => {
  const half = ROAD_WIDTH / 2;
  const top = screenY - half;
  const roadRight = roadX + ROAD_WIDTH;

  ctx.save();

  // curbs running along the crossing road, matching the vertical sidewalks.
  ctx.fillStyle = '#555a5e';
  ctx.fillRect(0, top - 25, CANVAS_WIDTH, 25);
  ctx.fillRect(0, top + ROAD_WIDTH, CANVAS_WIDTH, 25);

  // Crossing road surface: same palette as the main road, gradient across its
  // own width so the two roads read as the same material.
  const acrossGrad = ctx.createLinearGradient(0, top, 0, top + ROAD_WIDTH);
  acrossGrad.addColorStop(0, '#2a2a3a');
  acrossGrad.addColorStop(0.1, '#35354a');
  acrossGrad.addColorStop(0.5, '#3a3a50');
  acrossGrad.addColorStop(0.9, '#35354a');
  acrossGrad.addColorStop(1, '#2a2a3a');
  ctx.fillStyle = acrossGrad;
  ctx.fillRect(0, top, CANVAS_WIDTH, ROAD_WIDTH);

  // Re-lay the vertical road through the box so the cross joins up.
  const alongGrad = ctx.createLinearGradient(roadX, 0, roadRight, 0);
  alongGrad.addColorStop(0, '#2a2a3a');
  alongGrad.addColorStop(0.1, '#35354a');
  alongGrad.addColorStop(0.5, '#3a3a50');
  alongGrad.addColorStop(0.9, '#35354a');
  alongGrad.addColorStop(1, '#2a2a3a');
  ctx.fillStyle = alongGrad;
  ctx.fillRect(roadX, top, ROAD_WIDTH, ROAD_WIDTH);

  // Yellow edge lines of the crossing road, broken where the roads meet.
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  for (const y of [top + 2, top + ROAD_WIDTH - 2]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(roadX, y);
    ctx.moveTo(roadRight, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Lane dashes along the crossing road, also broken at the box.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([40, 30]);
  for (const y of [top + ROAD_WIDTH / 3, top + (ROAD_WIDTH * 2) / 3]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(roadX, y);
    ctx.moveTo(roadRight, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Junction box painted on the intersection itself.
  ctx.strokeStyle = 'rgba(240,201,41,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(roadX + 6, top + 6, ROAD_WIDTH - 12, ROAD_WIDTH - 12);
  // Clip to the box first, then lay the hatching inside it.
  ctx.save();
  ctx.beginPath();
  ctx.rect(roadX + 6, top + 6, ROAD_WIDTH - 12, ROAD_WIDTH - 12);
  ctx.clip();
  ctx.beginPath();
  for (let i = -ROAD_WIDTH; i < ROAD_WIDTH; i += 26) {
    ctx.moveTo(roadX + 6 + i, top + ROAD_WIDTH - 6);
    ctx.lineTo(roadX + 6 + i + ROAD_WIDTH - 12, top + 6);
  }
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Stop line on your approach, painted on the road surface.
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(roadX + 4, top + ROAD_WIDTH + 10, ROAD_WIDTH - 8, 6);

  ctx.restore();

  // Posed by the world, not recomputed here: these are the same vehicles the
  // collision pass tests, so the banner below cannot say CLEAR while a body
  // you can still hit is on the road.
  for (const car of traffic.cars) {
    drawCrossingCar(ctx, car.x, car.y, car.color);
  }

  // Say plainly, in the scene, whether it is safe to move.
  ctx.save();
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  const banner = traffic.clear ? 'CLEAR — SAFE TO GO' : 'TRAFFIC CROSSING — WAIT';
  const bannerWidth = ctx.measureText(banner).width + 20;
  ctx.fillStyle = traffic.clear ? 'rgba(34,197,94,0.92)' : 'rgba(220,38,38,0.92)';
  ctx.beginPath();
  ctx.roundRect(CANVAS_WIDTH / 2 - bannerWidth / 2, top + ROAD_WIDTH + 22, bannerWidth, 20, 5);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillText(banner, CANVAS_WIDTH / 2, top + ROAD_WIDTH + 36);
  ctx.restore();

  drawRoadsideSign(ctx, roadRight + 40, top + ROAD_WIDTH + 44, 'GIVE', 'WAY', '#b91c1c');
};

/**
 * The gantry over the approach to a scenario that grades a lane, that lane
 * picked out. It is the road marking the response, so the scene composes it
 * only where the support level shows one, and hands over the lane already
 * resolved: nothing here reads what the scenario requires.
 */
const drawTurnLaneMarkings = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  stopLineY: number,
  wanted: LaneIndex
) => {
  // The gantry hangs well below the junction it belongs to, which on a bend is
  // a different part of the road entirely. Reading the road at the gantry's own
  // row is what keeps the beam spanning the carriageway instead of hanging out
  // over the grass beside it.
  const gantryY = stopLineY + 96;
  const roadX = roadAt(gantryY);
  const edges = laneEdges(roadX);
  const panelH = 26;

  ctx.save();

  // Posts either side of the carriageway, carrying the beam over the road.
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(roadX - 12, gantryY - panelH / 2, 7, 74);
  ctx.fillRect(roadX + ROAD_WIDTH + 5, gantryY - panelH / 2, 7, 74);

  // Beam.
  ctx.fillStyle = '#374151';
  ctx.fillRect(roadX - 12, gantryY - panelH / 2 - 7, ROAD_WIDTH + 24, 7);

  // One panel per lane, the required one picked out. Overhead signs are what
  // real roads use to assign lanes, and they keep the carriageway itself clear
  // instead of burying it under paint.
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const isWanted = lane === wanted;
    // Panels sit over the lanes as the logic divides them, so the sign points
    // at the same strip of road the grader is measuring.
    const panelX = edges[lane] + 4;
    const panelW = edges[lane + 1] - edges[lane] - 8;

    ctx.fillStyle = isWanted ? '#15803d' : '#1f2937';
    ctx.beginPath();
    ctx.roundRect(panelX, gantryY - panelH / 2, panelW, panelH, 3);
    ctx.fill();
    ctx.strokeStyle = isWanted ? '#f0c929' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = isWanted ? 2 : 1;
    ctx.stroke();

    // Arrow drawn small enough to sit inside the panel.
    ctx.save();
    ctx.translate(panelX + panelW / 2, gantryY);
    ctx.scale(0.4, 0.4);
    drawLaneArrow(ctx, 0, 0, 'up', isWanted ? '#f0c929' : '#9ca3af');
    ctx.restore();
  }

  ctx.restore();
};

/**
 * Verge fill for painting road out of existence. The gradient is built over the
 * whole canvas and only a slice of it drawn, so it lines up exactly with the
 * background the road was laid on and leaves no seam.
 */
const layVerge = (ctx: CanvasRenderingContext2D, y: number, height: number) => {
  const grass = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grass.addColorStop(0, '#1a472a');
  grass.addColorStop(0.4, '#2d5a3f');
  grass.addColorStop(1, '#1a3a2a');
  ctx.fillStyle = grass;
  ctx.fillRect(0, y, CANVAS_WIDTH, height);
};

/**
 * T-junction: the road you are on simply stops. Everything beyond the cross
 * street is verge, and a hazard board faces you across the end of it.
 */
const drawTJunction = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  const stopLineY = screenY + 8;
  const boxBottom = stopLineY - STOP_LINE_SETBACK;
  const boxTop = boxBottom - CROSS_ROAD_WIDTH;
  const roadRight = roadX + ROAD_WIDTH;

  ctx.save();
  layVerge(ctx, -10, boxTop + 10);

  ctx.fillStyle = '#555a5e';
  ctx.fillRect(0, boxTop - CURB_DEPTH, CANVAS_WIDTH, CURB_DEPTH);
  ctx.fillRect(0, boxBottom, roadX, CURB_DEPTH);
  ctx.fillRect(roadRight, boxBottom, CANVAS_WIDTH - roadRight, CURB_DEPTH);

  laySurface(ctx, 0, boxTop, CANVAS_WIDTH, CROSS_ROAD_WIDTH, 'across');
  laySurface(ctx, roadX, boxTop, ROAD_WIDTH, CROSS_ROAD_WIDTH, 'along');

  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, boxTop + 2);
  ctx.lineTo(CANVAS_WIDTH, boxTop + 2);
  ctx.moveTo(0, boxBottom - 2);
  ctx.lineTo(roadX, boxBottom - 2);
  ctx.moveTo(roadRight, boxBottom - 2);
  ctx.lineTo(CANVAS_WIDTH, boxBottom - 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([28, 20]);
  ctx.beginPath();
  ctx.moveTo(0, boxTop + CROSS_ROAD_WIDTH / 2);
  ctx.lineTo(CANVAS_WIDTH, boxTop + CROSS_ROAD_WIDTH / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(roadX + 5, stopLineY, ROAD_WIDTH - 10, 6);
  ctx.restore();

  // Hazard board across the dead end. Scenery, not solid: the sign asks you to
  // slow for a junction, and crashing a driver who obeyed it would be unjust.
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(roadX + 6, boxTop - 16, ROAD_WIDTH - 12, 13);
  ctx.fillStyle = '#111827';
  for (let i = 0; i < ROAD_WIDTH - 12; i += 20) {
    ctx.beginPath();
    ctx.moveTo(roadX + 6 + i, boxTop - 3);
    ctx.lineTo(roadX + 6 + i + 10, boxTop - 3);
    ctx.lineTo(roadX + 6 + i + 20, boxTop - 16);
    ctx.lineTo(roadX + 6 + i + 10, boxTop - 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

/** A lane joining from the right, with a vehicle already on it. */
const drawMergeLane = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  const roadRight = roadX + ROAD_WIDTH;

  // The joining lane, described once by the world so the surface, its curb, its
  // markings and the vehicle on it all follow the same line.
  const { entryTop, entryFoot, laneHalfWidth, car } = mergeLaneGeometry(roadX, screenY);

  ctx.save();
  // curb on the outer side only. The previous edge line ran down the inner
  // side and read as a stray yellow stripe cutting across the carriageway.
  ctx.fillStyle = '#555a5e';
  ctx.beginPath();
  ctx.moveTo(entryTop.x, entryTop.y - 14);
  ctx.lineTo(entryTop.x, entryTop.y + laneHalfWidth * 2);
  ctx.lineTo(entryFoot.x, entryFoot.y);
  ctx.lineTo(entryFoot.x, entryFoot.y - laneHalfWidth * 2 - 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#37374d';
  ctx.beginPath();
  ctx.moveTo(entryTop.x, entryTop.y);
  ctx.lineTo(entryTop.x, entryTop.y + laneHalfWidth * 2);
  ctx.lineTo(entryFoot.x, entryFoot.y - 8);
  ctx.lineTo(entryFoot.x, entryFoot.y - laneHalfWidth * 2);
  ctx.closePath();
  ctx.fill();

  // Yellow only on the far edge, where the joining lane meets its own curb.
  ctx.strokeStyle = '#f0c929';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(entryTop.x, entryTop.y + 2);
  ctx.lineTo(entryFoot.x + 4, entryFoot.y - laneHalfWidth * 2);
  ctx.stroke();

  // Broken give-way line where the joining traffic must yield into your lane.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.beginPath();
  ctx.moveTo(roadRight - 1, screenY + 40);
  ctx.lineTo(roadRight - 1, screenY - 70);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  drawOncomingVehicle(ctx, 0, 0, 0.8);
  ctx.restore();
};

/**
 * The painted nose an exit leaves through.
 *
 * Only the nose and its chevrons: the deceleration lane beside it is road, and
 * road is painted by the road pass from the route's own declaration. Drawing
 * the lane here as well is how the version this replaced ended up with a wedge
 * of tarmac that nothing could be driven on.
 *
 * The nose opens off `exitLane` — the outermost lane, which is the one the
 * auxiliary lane runs beside and the one the exit is taken from.
 */
const drawExitGore = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  exitLane: LaneIndex
) => {
  const edges = laneEdges(roadX);
  // The boundary between the outermost through lane and the lane that leaves.
  const noseX = edges[exitLane + 1];
  // How far out the sign stands from that boundary, clear of the ramp's own
  // edge line.
  const signOffset = 46;

  ctx.save();

    // Which lane goes where, painted on the road itself. The clearest thing on a
  // real exit is not the sign: it is the arrow in the lane that leaves curving
  // away while the others run straight on.
  const arrowY = screenY + 96;
  ctx.strokeStyle = 'rgba(248,250,252,0.85)';
  ctx.fillStyle = 'rgba(248,250,252,0.85)';
  ctx.lineWidth = 4;
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const cx = (edges[lane] + edges[lane + 1]) / 2;
    if (lane === exitLane) {
      // Straight, then peeling right — the shape of the manoeuvre being asked for.
      ctx.beginPath();
      ctx.moveTo(cx - 4, arrowY + 26);
      ctx.quadraticCurveTo(cx - 4, arrowY + 4, cx + 12, arrowY - 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 18, arrowY - 9);
      ctx.lineTo(cx + 6, arrowY - 10);
      ctx.lineTo(cx + 11, arrowY + 1);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(cx, arrowY + 26);
    ctx.lineTo(cx, arrowY - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, arrowY - 12);
    ctx.lineTo(cx - 6, arrowY - 1);
    ctx.lineTo(cx + 6, arrowY - 1);
    ctx.closePath();
    ctx.fill();
  }

  // The sign at the point the exit is taken, on a post beside the road.
  //
  // Nothing is painted between the two carriageways any more. A gore is tarmac
  // nobody may drive on, and on this road that stretch is a kerbed nose the
  // wheel cannot cross — so paint saying the same thing was a second, softer
  // claim about the same piece of road. What is left is what a driver acts on:
  // the arrow in the lane that leaves, and the sign at the place it leaves.
  const plateW = 50;
  const plateH = 16;
  const plateX = noseX + signOffset;
  // Lifted clear of the row the scenario's own roadside plate stands on, so the
  // two do not print over each other at the one moment both are being read.
  const plateY = screenY - plateH - 30;
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(plateX + plateW / 2 - 1.5, plateY + plateH, 3, 42);
  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, 3);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px Inter';
  ctx.fillText('EXIT', plateX + 6, plateY + 11);
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(plateX + 30, plateY + 8);
  ctx.lineTo(plateX + 43, plateY + 8);
  ctx.lineTo(plateX + 38, plateY + 4);
  ctx.moveTo(plateX + 43, plateY + 8);
  ctx.lineTo(plateX + 38, plateY + 12);
  ctx.stroke();

  ctx.restore();
};

/**
 * Where an auxiliary lane runs out: arrows across the closing tarmac and the
 * legend that says so.
 *
 * `width` is the lane's own width at this point, from the route, so the arrows
 * span exactly the lane that is closing rather than a guess at one.
 */
const drawMergeTaper = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  width: number
) => {
  if (width <= 0) return;
  const roadRight = roadX + ROAD_WIDTH;
  ctx.save();

  // The legend and nothing else. The three arrows that used to be painted
  // across the closing lane read as a marking of their own on a lane already
  // carrying a kerbed nose, a taper and a sign — four things saying one thing.
  ctx.fillStyle = 'rgba(248,250,252,0.9)';
  ctx.font = 'bold 9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('LANE ENDS', roadRight + width / 2, screenY + 74);
  ctx.restore();
};

/** How each gantry panel is coloured, by what the lane under it is for. */
/**
 * One colour per meaning, and never one colour for two.
 *
 * `target` is green because green is what the rest of the game means by "this
 * is the right one" — the in-lane cue, a correct verdict, the open toll gate.
 * `restricted` is amber because amber is caution everywhere else. The board
 * that used amber for the overtaking lane and nothing for the car's own lane
 * was read as recommending the one lane it marks a cruising car down for.
 */
const GANTRY_TONES: Record<GantryPanel['tone'], { fill: string; edge: string; text: string; badge: string }> = {
  lane: { fill: '#111827', edge: 'rgba(148,163,184,0.55)', text: '#e2e8f0', badge: '#94a3b8' },
  target: { fill: '#052e16', edge: '#22c55e', text: '#dcfce7', badge: '#4ade80' },
  restricted: { fill: '#1c1917', edge: '#f59e0b', text: '#fcd34d', badge: '#fbbf24' },
  exit: { fill: '#052e16', edge: '#22c55e', text: '#bbf7d0', badge: '#4ade80' },
};

/**
 * A sign gantry over the carriageway, one panel per lane it speaks for.
 *
 * The only way a lane rule can be read off the road instead of out of a
 * sentence. Panels sit over the lanes exactly as `laneEdges` divides them, so
 * the board naming Lane 1 hangs over the lane the grader measures as Lane 1.
 */
const drawOverheadGantry = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  panels: GantryPanel[]
) => {
  const edges = laneEdges(roadX);
  const badged = panels.some(panel => panel.badge);
  const panelH = badged ? 44 : 36;
  ctx.save();

  // Posts and beam.
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(roadX - 13, screenY - panelH / 2, 7, 74);
  ctx.fillRect(roadX + ROAD_WIDTH + 6, screenY - panelH / 2, 7, 74);
  ctx.fillStyle = '#374151';
  ctx.fillRect(roadX - 13, screenY - panelH / 2 - 8, ROAD_WIDTH + 26, 8);

  for (const panel of panels) {
    const tone = GANTRY_TONES[panel.tone];
    const panelX = edges[panel.lane] + 3;
    const panelW = edges[panel.lane + 1] - edges[panel.lane] - 6;
    const cx = panelX + panelW / 2;

    ctx.fillStyle = tone.fill;
    ctx.beginPath();
    ctx.roundRect(panelX, screenY - panelH / 2, panelW, panelH, 3);
    ctx.fill();
    ctx.strokeStyle = tone.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    // The badge first, so the meaning is legible without reading the colour.
    const top = badged ? screenY - panelH / 2 : screenY - panelH / 2;
    if (panel.badge) {
      ctx.fillStyle = tone.badge;
      ctx.font = 'bold 7px Inter';
      ctx.fillText(panel.badge, cx, top + 9);
    }
    ctx.fillStyle = tone.text;
    ctx.font = 'bold 9px Inter';
    ctx.fillText(panel.top, cx, top + (badged ? 20 : 13));

    // The use line is authored as its own halves, split on the slash, and each
    // half is shrunk until it fits the lane it hangs over. A single line at a
    // fixed size ran off both ends of a 59px panel and printed itself over the
    // panel beside it, which is how a board meant to be read became a smear.
    const lines = panel.bottom.split('/').map(part => part.trim()).filter(Boolean);
    lines.slice(0, 2).forEach((line, i) => {
      let size = 7;
      ctx.font = `${size}px Inter`;
      while (size > 4 && ctx.measureText(line).width > panelW - 4) {
        size -= 0.5;
        ctx.font = `${size}px Inter`;
      }
      ctx.fillText(line, cx, top + (badged ? 30 : 23) + i * 8);
    });
  }

  ctx.restore();
};

/**
 * The kerbed nose or painted gore dividing an auxiliary lane from the
 * carriageway, drawn from the node's own offset and width — the same figures
 * its solid was built from.
 */
const drawLaneSeparator = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  offsetX: number,
  width: number,
  kind: 'island' | 'gore'
) => {
  const x = roadX + offsetX - width / 2;
  ctx.save();
  if (kind === 'gore') {
    // Hatching between two solid lines: paint, not concrete.
    ctx.fillStyle = 'rgba(248,250,252,0.14)';
    ctx.fillRect(x, screenY - 14, width, 28);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 1, screenY - 14);
    ctx.lineTo(x + 1, screenY + 14);
    ctx.moveTo(x + width - 1, screenY - 14);
    ctx.lineTo(x + width - 1, screenY + 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, screenY + 14);
    ctx.lineTo(x + width, screenY - 14);
    ctx.stroke();
    ctx.restore();
    return;
  }
  // A kerbed island: grey concrete with a white-over-red nose band, which is
  // how a divider between a slip road and a carriageway is marked.
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(x, screenY - 14, width, 28);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x + 1, screenY - 14, width - 2, 7);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x + 1, screenY - 7, width - 2, 7);
  ctx.restore();
};

/**
 * A toll plaza: booth islands splitting the carriageway into gates, and a
 * gantry over them showing which gate is taking traffic.
 *
 * `openLane` comes from the event's own lane requirement rather than from a
 * layout fixed here, for the same reason the turn gantry takes one: a red X
 * painted over a lane the grader would have accepted teaches the opposite of
 * the sign it is imitating.
 *
 * Only the closed gates are solid. The islands are drawn but not collidable —
 * at 65px of lane and 40px of car, giving every divider a hitbox would grade
 * the plaza on steering precision instead of on reading the indicator, and a
 * driver who picked the right gate could still be stopped by its curb.
 */
const drawTollPlaza = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  openLane: LaneIndex
) => {
  const edges = laneEdges(roadX);
  const gantryY = screenY - 96;
  const panelH = 24;

  ctx.save();

  // Plaza deck, so the gates read as one structure rather than as loose posts.
  ctx.fillStyle = 'rgba(15,23,42,0.30)';
  ctx.fillRect(roadX - 14, screenY - 44, ROAD_WIDTH + 28, 88);

  // Islands between the gates, banded white over red the way a curb nose is.
  for (let i = 0; i <= LANE_COUNT; i++) {
    const x = edges[i];
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 4, screenY - 40, 8, 80);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x - 4, screenY - 40, 8, 7);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x - 4, screenY - 33, 8, 7);
  }

  // Cabins on the interior islands, set back up the plaza so they never sit on
  // the barrier line the gates are judged at.
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = edges[i];
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.roundRect(x - 9, screenY - 36, 18, 22, 3);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 6, screenY - 32, 12, 9);
  }

  // Gantry posts and beam.
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(roadX - 12, gantryY - panelH / 2, 7, 70);
  ctx.fillRect(roadX + ROAD_WIDTH + 5, gantryY - panelH / 2, 7, 70);
  ctx.fillStyle = '#374151';
  ctx.fillRect(roadX - 12, gantryY - panelH / 2 - 7, ROAD_WIDTH + 24, 7);

  // One indicator per gate: a green arrow over the open one, a red X over the
  // rest. Panels sit over the lanes exactly as `laneEdges` divides them.
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const open = lane === openLane;
    const panelX = edges[lane] + 4;
    const panelW = edges[lane + 1] - edges[lane] - 8;
    const cx = panelX + panelW / 2;

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(panelX, gantryY - panelH / 2, panelW, panelH, 3);
    ctx.fill();
    ctx.strokeStyle = open ? '#22c55e' : 'rgba(148,163,184,0.5)';
    ctx.lineWidth = open ? 2 : 1;
    ctx.stroke();

    if (open) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, gantryY - 7);
      ctx.lineTo(cx, gantryY + 6);
      ctx.moveTo(cx - 5, gantryY + 1);
      ctx.lineTo(cx, gantryY + 6);
      ctx.lineTo(cx + 5, gantryY + 1);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 6, gantryY - 6);
      ctx.lineTo(cx + 6, gantryY + 6);
      ctx.moveTo(cx + 6, gantryY - 6);
      ctx.lineTo(cx - 6, gantryY + 6);
      ctx.stroke();
    }
  }

  // Barrier arms across the closed gates. A Red X you can drive through is a
  // picture of a rule; this one is the rule.
  for (const gate of tollGateBarriers(roadX, openLane)) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(gate.x, screenY - 3, gate.width, 7);
    ctx.fillStyle = '#dc2626';
    for (let stripe = 0; stripe < gate.width; stripe += 16) {
      ctx.fillRect(gate.x + stripe, screenY - 3, Math.min(8, gate.width - stripe), 7);
    }
  }

  ctx.restore();
};

export {
  drawLaneSeparator,
  drawCrossStreet,
  drawTurnPath,
  drawTJunction,
  drawMainRoadJunction,
  drawMergeLane,
  drawExitGore,
  drawMergeTaper,
  drawOverheadGantry,
  drawTollPlaza,
  drawTurnLaneMarkings,
  drawRoundaboutQuadrant,
  drawRoundaboutScene,
  drawMergeArrows,
};
