/**
 * The roadside of a route stands beside the road, not on it.
 *
 * A carriageway that changes width is the whole point of `RouteLayout`, and it
 * is also the thing that catches a renderer out. The crash barrier and the
 * lighting columns were placed against `roadX + ROAD_WIDTH` — correct for every
 * level whose road is one width from end to end, and wrong for the one level
 * whose road is not: on the stretch where the acceleration lane is open, the
 * barrier was drawn down the middle of the lane the driver is being told to
 * use, and the lamp masts stood in it.
 *
 * So the check is not "does the barrier look right" but "is anything solid
 * drawn inside the width `routeGeometry` says is drivable here". Both answers
 * come from the same declaration, which is what makes the question answerable.
 */
import { describe, expect, it } from 'vitest';
import { ROAD_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { auxiliaryAt } from '@/features/driving-sim/domain/world/routeGeometry';
import type { EnvObject } from '@/features/driving-sim/domain/world/roadsideScenery';
import type { RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { drawRoad } from './roadRenderer';

/** The greys `drawExpresswayFurniture` paints its barriers and masts in. */
const FURNITURE = new Set(['#6b7280', '#b9c2cc', '#3f4652', '#9aa3ae', '#d7dde5', '#8892a0']);

interface Painted {
  x0: number;
  x1: number;
  style: string;
}

/**
 * A context that records where each fill and stroke landed horizontally. Only
 * the span matters here — the question is whether any of it is over tarmac.
 */
const recordingContext = () => {
  const painted: Painted[] = [];
  const path: number[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineDashOffset: 0,
    font: '',
    textAlign: '',
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    beginPath: () => {
      path.length = 0;
    },
    moveTo: (x: number) => path.push(x),
    lineTo: (x: number) => path.push(x),
    quadraticCurveTo: (cx: number, _cy: number, x: number) => path.push(cx, x),
    closePath: () => {},
    arc: (x: number, _y: number, r: number) => path.push(x - r, x + r),
    ellipse: (x: number, _y: number, rx: number) => path.push(x - rx, x + rx),
    roundRect: (x: number, _y: number, w: number) => path.push(x, x + w),
    rect: (x: number, _y: number, w: number) => path.push(x, x + w),
    fillRect: (x: number, _y: number, w: number) =>
      painted.push({ x0: x, x1: x + w, style: String(ctx.fillStyle) }),
    fill: () =>
      path.length &&
      painted.push({ x0: Math.min(...path), x1: Math.max(...path), style: String(ctx.fillStyle) }),
    stroke: () =>
      path.length &&
      painted.push({ x0: Math.min(...path), x1: Math.max(...path), style: String(ctx.strokeStyle) }),
    measureText: (text: string) => ({ width: text.length * 4 }),
    fillText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    drawImage: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, painted };
};

/** An acceleration lane that is open for the whole of the visible road. */
const route: RouteLayout = {
  segments: [
    { from: 0, to: 4000, roadside: 'expressway', auxiliary: { role: 'acceleration', taperIn: 0, taperOut: 400 } },
    { from: 4000, to: 6000, roadside: 'expressway' },
  ],
};

const ROAD_X = (460 - ROAD_WIDTH) / 2;

const expresswayVerge = (distance: number): EnvObject[] => [
  { x: 0, y: distance, type: 'median-barrier', side: 'left' },
  { x: 0, y: distance, type: 'guardrail', side: 'right' },
  { x: 0, y: distance, type: 'lamp', side: 'right' },
];

describe('the roadside of a route with an auxiliary lane', () => {
  it('keeps every barrier and mast off the drivable width', () => {
    // 500 is deep inside the run where the acceleration lane is full width, so
    // the drivable road here is a whole lane wider than the through lanes.
    const { ctx, painted } = recordingContext();
    drawRoad(ctx, 0, 500, expresswayVerge(500), [], undefined, route);

    const aux = auxiliaryAt(500, route);
    expect(aux?.width).toBeGreaterThan(0);
    const drivableRight = ROAD_X + ROAD_WIDTH + (aux?.width ?? 0);

    const onTarmac = painted.filter(
      p => FURNITURE.has(p.style) && p.x1 > ROAD_X + 1 && p.x0 < drivableRight - 1
    );
    expect(onTarmac).toEqual([]);
  });

  it('brings the barrier back in where the lane has gone', () => {
    // Past the taper the drivable road is only the through lanes again, and the
    // barrier follows it in rather than staying out at the width of a lane that
    // is no longer there.
    const { ctx, painted } = recordingContext();
    drawRoad(ctx, 0, 4500, expresswayVerge(4500), [], undefined, route);

    expect(auxiliaryAt(4500, route)).toBeNull();
    const rail = painted.filter(p => p.style === '#b9c2cc');
    expect(rail.length).toBeGreaterThan(0);
    for (const piece of rail) {
      expect(piece.x0).toBeGreaterThanOrEqual(ROAD_X + ROAD_WIDTH);
      // Still against the road rather than out in the field.
      expect(piece.x0).toBeLessThan(ROAD_X + ROAD_WIDTH + 40);
    }
  });
});
