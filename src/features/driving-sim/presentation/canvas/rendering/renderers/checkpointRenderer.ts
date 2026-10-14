/**
 * The "pull over and deal with an official" scenes: an `event.inspection`
 * LTO checkpoint (boom barrier, officer, cones, sign), an enforcer flagging a
 * car down at the curb (`inspection.pullOver`), and the marked
 * `parking_bay`/`loading_bay`/`red_curb`/`yellow_curb`/`lay_by` pull-over bay
 * a `PullOverBay` describes.
 */
import {
  ROAD_WIDTH,
  BAY_WIDTH,
  BAY_RUN_ON,
  BAY_SPAN,
  SCREEN_PX_PER_UNIT,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawTrafficCone, drawRoadsideSign } from '@/features/driving-sim/presentation/canvas/rendering/renderPrimitives';
import { drawCheckpointOfficer, drawFlaggingEnforcer } from './pedestrianRenderer';
import type { PullOverBay } from '@/features/driving-sim/domain/scenario/scenarioScene';

/**
 * The full checkpoint scene, drawn for any event carrying `inspection` data:
 * stop line, boom barrier across the lane, officer, and a roadside sign.
 */
const drawCheckpointScene = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number
) => {
  ctx.save();

  // Stop line the player has to halt behind.
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(roadX + 4, screenY + 16, ROAD_WIDTH - 8, 6);

  // Boom barrier with hazard stripes.
  const barY = screenY - 12;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(roadX + 2, barY, ROAD_WIDTH - 4, 10);
  ctx.fillStyle = '#dc2626';
  for (let i = 0; i < ROAD_WIDTH - 4; i += 28) {
    ctx.fillRect(roadX + 2 + i, barY, 14, 10);
  }
  ctx.strokeStyle = 'rgba(15,23,42,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(roadX + 2, barY, ROAD_WIDTH - 4, 10);

  // Posts holding the barrier.
  ctx.fillStyle = '#475569';
  ctx.fillRect(roadX - 6, barY - 4, 8, 26);
  ctx.fillRect(roadX + ROAD_WIDTH - 2, barY - 4, 8, 26);

  ctx.restore();

  drawCheckpointOfficer(ctx, roadX - 34, screenY + 4, 0.95);
  drawTrafficCone(ctx, roadX + 16, screenY + 40, 0.5);
  drawTrafficCone(ctx, roadX + ROAD_WIDTH - 16, screenY + 40, 0.5);
  drawRoadsideSign(ctx, roadX + ROAD_WIDTH + 44, screenY - 26, 'LTO', 'CHECKPOINT', '#1d4ed8');
};

/**
 * A traffic stop: one enforcer on the right verge, level with the scenario's
 * point, holding a STOP paddle out over the curb lane. Nothing across the road
 * and no lettering on it - the car is flagged over to the curb, not stopped at
 * a line, and the enforcer is the whole of what the driver is shown.
 */
const drawTrafficStopScene = (ctx: CanvasRenderingContext2D, roadX: number, screenY: number) => {
  drawFlaggingEnforcer(ctx, roadX + ROAD_WIDTH + 20, screenY);
};

/**
 * A marked bay let into the curb, with the carriageway edge opening around it.
 * Painted green where stopping is permitted and red where it is not, so the
 * bay itself carries the answer as well as the sign beside it.
 */
const drawPullOverBay = (
  ctx: CanvasRenderingContext2D,
  roadX: number,
  screenY: number,
  bay: PullOverBay
) => {
  const onRight = bay.side === 'right';
  const curb = onRight ? roadX + ROAD_WIDTH : roadX;
  const outer = onRight ? curb + BAY_WIDTH : curb - BAY_WIDTH;
  // Drawn over the stretch the wheel can reach it on (`bayOpenAt`): the
  // approach half before the point, the shorter run-on after it, ahead.
  const top = screenY - BAY_RUN_ON * SCREEN_PX_PER_UNIT;
  const height = (BAY_SPAN + BAY_RUN_ON) * SCREEN_PX_PER_UNIT;
  const left = Math.min(curb, outer);
  const width = Math.abs(outer - curb);

  ctx.save();
  // Bay surface, tapered in and out so the curb line opens rather than steps.
  ctx.fillStyle = '#37374d';
  ctx.beginPath();
  ctx.moveTo(curb, top - 30);
  ctx.lineTo(outer, top + 8);
  ctx.lineTo(outer, top + height - 8);
  ctx.lineTo(curb, top + height + 30);
  ctx.closePath();
  ctx.fill();

  const permitted = bay.mayStop;
  const paint = permitted ? 'rgba(34,197,94,0.85)' : 'rgba(220,38,38,0.85)';

  // Bay markings.
  ctx.strokeStyle = paint;
  ctx.lineWidth = 3;
  ctx.strokeRect(left + 4, top + 6, width - 8, height - 12);

  if (!permitted) {
    // Hatched out, the way a no-stopping area is.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 4, top + 6, width - 8, height - 12);
    ctx.clip();
    ctx.lineWidth = 2;
    for (let i = -height; i < width + height; i += 14) {
      ctx.beginPath();
      ctx.moveTo(left + i, top + height);
      ctx.lineTo(left + i + height, top);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(34,197,94,0.12)';
    ctx.fillRect(left + 4, top + 6, width - 8, height - 12);
    ctx.fillStyle = paint;
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('P', left + width / 2, screenY + 4);
  }

  // The two cars that make this a space rather than a stretch of curb. Without
  // something ahead of and behind the gap, reversing in and driving straight in
  // land the car in the same place, and the technique question has no subject.
  if (bay.refCars) {
    const carX = left + width / 2;
    for (const carY of [top - 44, top + height + 44]) {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(carX - 15, carY - 24, 30, 48);
      ctx.fillStyle = '#374151';
      ctx.fillRect(carX - 11, carY - 17, 22, 13);
      ctx.fillRect(carX - 11, carY + 5, 22, 12);
    }
  }
  ctx.restore();
};

export { drawCheckpointScene, drawPullOverBay, drawTrafficStopScene };
