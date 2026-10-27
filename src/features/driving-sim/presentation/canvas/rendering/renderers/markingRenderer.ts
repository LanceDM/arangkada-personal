/**
 * Pavement paint and the furniture that goes with it: the yellow box, lane
 * paint, parking and loading bays, painted curbs, the raised island and its
 * guiding lines, chevrons, cone tapers and concrete barriers.
 */
import { ROAD_WIDTH, LANE_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawTrafficCone } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';
import {
  chevronIslandGeometry,
  concreteBarrierGeometry,
  coneTaperPositions,
  islandApproachCentreX,
} from '@/features/driving-sim/domain/world/sceneGeometry';
import type { LaneRequirement } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const drawYellowBoxMarking = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.save();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.strokeRect(roadX + 8, screenY - 20, ROAD_WIDTH - 16, 40);
  ctx.beginPath();
  for (let i = -1; i < 6; i++) {
    ctx.moveTo(roadX + 8 + i * 14, screenY - 20);
    ctx.lineTo(roadX + 8 + i * 14 - 20, screenY + 20);
  }
  ctx.stroke();
  ctx.restore();
};

const drawLanePaint = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  label: string,
  color: string,
  onLeft: boolean
) => {
  ctx.save();
  const laneX = onLeft ? roadX + 4 : roadX + ROAD_WIDTH - 4 - LANE_WIDTH;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.fillRect(laneX, screenY - 22, LANE_WIDTH, 44);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(laneX, screenY - 22, LANE_WIDTH, 44);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 8px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(label, laneX + LANE_WIDTH / 2, screenY + 2);
  ctx.restore();
};

const drawParkingBay = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  const bayX = roadX + ROAD_WIDTH - 34;
  ctx.strokeRect(bayX, screenY - 20, 30, 44);
  ctx.beginPath();
  ctx.moveTo(bayX + 15, screenY - 20);
  ctx.lineTo(bayX + 15, screenY + 24);
  ctx.stroke();
  ctx.fillStyle = '#4169e1';
  ctx.font = 'bold 9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('P', bayX + 15, screenY + 4);
  ctx.restore();
};

const drawPaintedCurb = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  color: string
) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(roadX - 6, screenY - 22, 5, 44);
  ctx.fillRect(roadX + ROAD_WIDTH + 1, screenY - 22, 5, 44);
  ctx.restore();
};

/** A raised island with the paint that guides traffic around it. */
const drawIslandApproach = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  screenY: number,
  oncomingLanes: number
) => {
  const centreX = islandApproachCentreX(roadAt(screenY), oncomingLanes);

  // Guiding lines splitting either side of the nose, drawn first so the island
  // sits on top of them.
  ctx.save();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  for (const direction of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(centreX + direction * 14, screenY - 46);
    ctx.lineTo(centreX + direction * 52, screenY + 70);
    ctx.stroke();
  }
  ctx.restore();

  // The island itself: curbed, with a hazard board on the nose.
  ctx.save();
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.moveTo(centreX, screenY - 44);
  ctx.lineTo(centreX - 15, screenY + 16);
  ctx.lineTo(centreX + 15, screenY + 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(centreX - 9, screenY - 30, 18, 6);
  ctx.restore();

};

/**
 * The chevron marking as it is really painted: a tapering wedge whose nose
 * faces the traffic it divides, filled with nested chevrons that shrink into
 * that nose, with the raised island it is protecting at the wide end.
 *
 * A chevron marking is not a row of arrows: it is a hatched *area*, bounded by
 * the straight edge the open lane runs along and the diagonal opening away
 * from it, and the arrows are what fills that area.
 *
 * The nose sits nearest the driver and the wedge opens out behind it, which is
 * the direction a gore marking actually runs: the point is where the traffic
 * splits, and the hatching grows as the space being closed off grows.
 *
 * The scenario supplies which side stays open. The wedge's fixed, straight
 * edge sits against that lane, while the diagonal opens out across the lane
 * being closed.
 */
const drawChevronIsland = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  oncomingLanes: number,
  targetLane: LaneRequirement['lane'] = 'curb'
) => {
  const white = '#f8fafc';
  // Geometry comes from the world, which is also what makes the island solid.
  const {
    apexY,
    wideY,
    markingOpensRight,
    fixedEdgeAt,
    closedEdgeAt,
    widthAt,
    island,
  } = chevronIslandGeometry(roadAt, topY, bottomY, oncomingLanes, targetLane);
  const span = apexY - wideY;

  ctx.save();
  ctx.strokeStyle = white;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The wedge outline: straight edge and diagonal edge mirrored horizontally
  // from the route target. Sampled per row so both follow the carriageway on a
  // bend.
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let y = apexY; y >= wideY; y -= 6) {
    const x = fixedEdgeAt(y);
    if (y === apexY) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let y = apexY; y >= wideY; y -= 6) {
    const x = closedEdgeAt(y);
    if (y === apexY) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Nested chevrons filling the wedge, each sized to the width available where
  // it sits, so the run tapers into the nose the way the painted marking does.
  // Depth is held under the spacing so consecutive arrowheads stay separate:
  // at a deeper setting they ran into each other and the wedge filled in as a
  // solid zigzag instead of a row of distinct chevrons.
  ctx.lineWidth = 6;
  const count = 4;
  const spacing = span / (count + 0.6);
  for (let i = 1; i <= count; i++) {
    const y = apexY - spacing * i;
    const width = widthAt(y);
    if (width < 10) continue;
    const fixed = fixedEdgeAt(y);
    const left = markingOpensRight ? fixed - width + 6 : fixed + 3;
    const right = markingOpensRight ? fixed - 3 : fixed + width - 6;
    const depth = Math.min(spacing * 0.62, width * 0.5);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo((left + right) / 2, y - depth);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  ctx.restore();

  // The raised island the hatching is protecting, standing at the wide end.
  // Built the way Level 3's median island is: a concrete curb (the raised part
  // a driver could actually hit) framing a grass inset, capped with a small
  // hazard marker on the nose. A flat green triangle looked like a road sign,
  // not a place.
  const { centreX: wideCentreX, width: islandW, tipY: islandTipY, baseY: islandBaseY } = island;
  const curb = 5;

  ctx.save();
  // Concrete curb.
  ctx.fillStyle = '#555a5e';
  ctx.beginPath();
  ctx.moveTo(wideCentreX, islandTipY);
  ctx.lineTo(wideCentreX - islandW / 2, islandBaseY);
  ctx.lineTo(wideCentreX + islandW / 2, islandBaseY);
  ctx.closePath();
  ctx.fill();

  // Grass inset, set inside the curb rather than filling it edge to edge.
  ctx.fillStyle = '#2d5a3f';
  ctx.beginPath();
  ctx.moveTo(wideCentreX, islandTipY + curb + 5);
  ctx.lineTo(wideCentreX - islandW / 2 + curb, islandBaseY - curb);
  ctx.lineTo(wideCentreX + islandW / 2 - curb, islandBaseY - curb);
  ctx.closePath();
  ctx.fill();

  // Hazard marker on the nose, facing the traffic that meets it first.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(wideCentreX - 8, islandTipY - 3, 16, 8, 2);
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(wideCentreX - 8, islandTipY - 3, 8, 8);
  ctx.restore();

};

/** A row of cones closing off part of the carriageway. */
const drawConeTaper = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  topY: number,
  bottomY: number,
  side: 'left' | 'right'
) => {
  for (const cone of coneTaperPositions(roadAt, topY, bottomY, side)) {
    drawTrafficCone(ctx, cone.x, cone.y, 0.62);
  }
};

/**
 * One concrete barrier, not a repeated stack of them.
 *
 * A closure that only takes a single lane is one barrier's worth of road, and
 * a run of identical short segments marching off up the screen read as
 * several separate barriers rather than the one obstruction the marking
 * describes. It is kept short as well as single: a barrier long enough to
 * span most of the visible road stopped reading as an object sitting in a
 * lane and started reading as a wall the road was built around.
 */
const drawConcreteBarriers = (
  ctx: CanvasRenderingContext2D,
  roadAt: RoadAt,
  screenY: number,
  side: 'left' | 'right'
) => {
  const { x, y, width, height } = concreteBarrierGeometry(roadAt, screenY, side);

  ctx.save();
  ctx.fillStyle = '#9ca3af';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.fillRect(x, y + height * 0.3, width, 5);
  ctx.fillRect(x, y + height * 0.62, width, 5);
  ctx.restore();

};

export {
  drawYellowBoxMarking,
  drawLanePaint,
  drawParkingBay,
  drawPaintedCurb,
  drawIslandApproach,
  drawChevronIsland,
  drawConeTaper,
  drawConcreteBarriers,
};
