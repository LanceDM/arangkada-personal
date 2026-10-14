/**
 * Pedestrian crossings — the road furniture, not the people on it.
 *
 * Three pieces of road live here, and they are three genuinely different things
 * rather than three spellings of one:
 *
 * - `drawZebraCrossing` — a crossing standing on its own: `drawCrossingApproach`
 *   (dropped curb ramps, zebra bars, a give-way line) with someone waiting on
 *   the curb. Open-road crossings (Levels 5, 8, 11) draw the same
 *   `drawCrossingApproach` element directly, composing their own cast on top,
 *   so every pedestrian crossing in the game reads as one piece of road.
 * - `drawDrivewayMouth` — a *footpath* carried across a driveway, which needs
 *   the sidewalk drawn either side because the driveway crosses it rather
 *   than meeting it end-on. This is the one Level 2 uses, and it is not the
 *   same world object as a road crossing.
 * - `drawSignalizedCrossing` — a crossing built into a light-controlled
 *   junction, where the pedestrian walks on a signal rather than on judgment.
 *
 * All three lean on `drawCrossingApproach` / `drawZebraStripes` /
 * `drawIntersection` from renderPrimitives.ts rather than duplicating the stripes.
 *
 * Who is *on* a crossing is deliberately not part of any of them — that's
 * `drawPedestrian`/`drawCrossingPedestrians` in pedestrianRenderer.ts. A scene
 * composes the two. That is what lets Level 5 stand a parent and a child on
 * the same crossing element Level 3 stands a lone pedestrian beside, without
 * either level needing a crossing of its own — and it is why none of these
 * functions takes a sign, a school, or a level id.
 */
import { ROAD_WIDTH, CANVAS_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawCrossingApproach, drawIntersection, drawSignalHead, } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import { DRIVEWAY_CROSSING_HEIGHT } from '@/features/driving-sim/domain/world/junctionGeometry';
import { drivewayPedestrianX, type Point } from '@/features/driving-sim/domain/world/sceneGeometry';
import type { PedestrianKind } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { drawPedestrian, SPRITE_FOR_KIND } from './pedestrianRenderer';

/** Zebra crossing with dropped curbs and someone waiting to use it. */
const drawZebraCrossing = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  waiting: PedestrianKind
) => {
  const top = screenY - 34;
  const height = 40;

  drawCrossingApproach(ctx, roadX, top, height);

  // Waiting on the curb, not in the lane: the lesson is reading the sign and
  // slowing early, not swerving around a body in the road. They stand on the
  // opposite curb to the sign so the two never sit on top of each other.
  drawPedestrian(ctx, roadX - 13, screenY - 14, SPRITE_FOR_KIND[waiting]);
};

// Sprite positions live in these helpers rather than inline in the drawing, so
// the collision boxes below are guaranteed to sit exactly where the sprite is
// painted instead of drifting from a second copy of the maths.


/**
 * Footpath running across the mouth of a driveway, marked as a proper
 * pedestrian crossing: zebra bars over the carriageway, dropped curb ramps
 * where the footpath meets the road, and a give-way line on the approach.
 */
const drawDrivewayMouth = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  walkedOff = 0
) => {
  const half = DRIVEWAY_CROSSING_HEIGHT / 2;
  const top = screenY - half;
  const roadRight = roadX + ROAD_WIDTH;

  // Footpath either side of the carriageway — the one thing a driveway mouth
  // has that an open-road crossing doesn't: a sidewalk running the full width
  // of the scene, since a driveway crosses it rather than meeting it end-on.
  ctx.save();
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, top, roadX, DRIVEWAY_CROSSING_HEIGHT);
  ctx.fillRect(roadRight, top, CANVAS_WIDTH - roadRight, DRIVEWAY_CROSSING_HEIGHT);
  ctx.strokeStyle = 'rgba(15,23,42,0.2)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 24) {
    if (x > roadX - 24 && x < roadRight) continue;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + DRIVEWAY_CROSSING_HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  // Same crossing every other pedestrian crossing in the game draws: curb
  // ramps, zebra bars, give-way line.
  drawCrossingApproach(ctx, roadX, top, DRIVEWAY_CROSSING_HEIGHT);

  if (walkedOff < 1) {
    drawPedestrian(ctx, drivewayPedestrianX(walkedOff), screenY - 2, 'regular');
  }
};

/**
 * A crossing controlled by its own signal, rather than by the driver reading
 * the marking alone.
 *
 * Built as a real intersection — `drawIntersection` with a crosswalk — because
 * the module's own definition of this marking is "at a light-controlled
 * intersection", not a plain crossing with a light bolted on. The pedestrian
 * is actually walking, not waiting on the curb, since a light-controlled
 * crossing puts them on a walk signal rather than a judgment call about
 * traffic gaps. The signal starts red — the same red the driver is being
 * asked to stop for — and only turns green once `cleared`, at which point the
 * pedestrian has finished crossing and stepped off the road, the same "the
 * junction releases you" moment every other signal head in this game uses.
 */
const drawSignalizedCrossing = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  cleared: boolean,
  walker: Point | null
) => {
  const junction = drawIntersection(ctx, roadX, screenY, { crosswalk: true, crossTraffic: true });
  drawSignalHead(ctx, roadX + ROAD_WIDTH + 20, junction.boxBottom - 36, 'red', cleared);

  // Drawn where the world put them this frame. Reading the clock again here
  // would put the sprite a few milliseconds ahead of the body you can hit.
  if (walker) drawPedestrian(ctx, walker.x, walker.y, 'regular');
};

export {
  drawZebraCrossing,
  drawDrivewayMouth,
  drawSignalizedCrossing,
};
