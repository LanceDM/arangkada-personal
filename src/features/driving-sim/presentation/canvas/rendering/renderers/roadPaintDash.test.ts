/**
 * Every dash, stud and separator on the road stands still on the road as the
 * car drives over it (2026-11-18).
 *
 * A dash pattern is laid from the start of the path it is stroked along, so a
 * dash stays on its own point of the road only if its phase is taken from the
 * point of the road where that path starts. The old phase came from the scroll
 * counter alone, which was right only for a line starting at the top of the
 * screen. A line starting partway down — an auxiliary lane opening, a centre
 * line turning from solid to broken — starts at a point that itself moves with
 * the road, so its dashes slid along it. Studs placed on screen rows, and the
 * separator built in screen-row slices, rode along with the car outright.
 *
 * Each test draws the road at two nearby distances and checks that every mark
 * falls on the same points of the road both times.
 */
import { describe, expect, it } from 'vitest';
import type { LongitudinalArt, RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { routeSceneNodes } from '@/features/driving-sim/domain/scene/routeSceneNodes';
import type { FrameView } from '@/features/driving-sim/domain/world/eventPlacement';
import { SCREEN_PX_PER_UNIT, screenYToDistance } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawRoad } from './roadRenderer';

interface DashedStroke {
  period: number;
  offset: number;
  x: number;
  y: number;
}

interface Stud {
  x: number;
  y: number;
}

/** A context that keeps the dashed strokes (with where each starts) and the studs. */
const recorder = () => {
  const strokes: DashedStroke[] = [];
  const studs: Stud[] = [];
  let state = { dash: [] as number[], offset: 0, fill: '' };
  let start: { x: number; y: number } | null = null;
  const saved: (typeof state)[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'setLineDash') return (dash: number[]) => (state = { ...state, dash: [...dash] });
        if (key === 'save') return () => saved.push({ ...state });
        if (key === 'restore') return () => (state = saved.pop() ?? state);
        if (key === 'beginPath') return () => (start = null);
        if (key === 'moveTo') return (x: number, y: number) => (start ??= { x, y });
        if (key === 'roundRect')
          return (x: number, y: number, w: number, h: number) => {
            // The stud's outer body, centred on its point of the road.
            if (state.fill === '#e2e8f0' && w === 8) studs.push({ x: x + 4, y: y + h / 2 });
          };
        if (key === 'stroke')
          return () => {
            const period = state.dash.reduce((sum, length) => sum + length, 0);
            if (period > 0 && start) strokes.push({ period, offset: state.offset, ...start });
          };
        if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
        if (key === 'createLinearGradient') return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set(_target, key: string, value: unknown) {
        if (key === 'lineDashOffset') state = { ...state, offset: value as number };
        if (key === 'fillStyle') state = { ...state, fill: String(value) };
        return true;
      },
    }
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, studs };
};

const mod = (value: number, by: number) => ((value % by) + by) % by;

/**
 * Where, on the road, the pattern of a dashed stroke begins, within one period
 * of road. A straight road, so path length is screen rows.
 */
const roadPhase = (stroke: DashedStroke, distance: number) => {
  const firstDash = mod(-stroke.offset, stroke.period);
  const road = screenYToDistance(stroke.y + firstDash, distance);
  return mod(road, stroke.period / SCREEN_PX_PER_UNIT);
};

/** The same phase seen from two distances, allowing for the wrap. */
const samePhase = (a: number, b: number, period: number) => {
  const gap = Math.abs(a - b);
  return Math.min(gap, period - gap);
};

const drawAt = (distance: number, art?: LongitudinalArt, spans: { from: number; to: number; art: LongitudinalArt }[] = [], route?: RouteLayout) => {
  const rec = recorder();
  const paint = art ? { oncomingLanes: 1, base: art, spans } : undefined;
  // The scroll counter as the drive keeps it.
  drawRoad(rec.ctx, distance * SCREEN_PX_PER_UNIT, distance, [], [], paint, route);
  return rec;
};

const A = 500;
const B = 507.3;

/** Checks every dashed stroke at B is the same pattern on the road as at A. */
const expectDashesStill = (a: DashedStroke[], b: DashedStroke[]) => {
  expect(a.length).toBeGreaterThan(0);
  expect(b).toHaveLength(a.length);
  b.forEach((stroke, i) => {
    expect(stroke.period).toBe(a[i].period);
    const span = stroke.period / SCREEN_PX_PER_UNIT;
    expect(samePhase(roadPhase(a[i], A), roadPhase(stroke, B), span)).toBeLessThan(1e-6);
  });
};

const accelerationLane: RouteLayout = {
  // Runs up to road distance 800, so at these distances it starts partway
  // down the screen (the far end of the screen is past it).
  segments: [
    { from: 0, to: 800, roadside: 'expressway', auxiliary: { role: 'acceleration', taperIn: 0, taperOut: 0 } },
    { from: 800, to: 4000, roadside: 'expressway' },
  ],
};

describe('road marks stand still on the road (2026-11-18)', () => {
  it.each<LongitudinalArt | undefined>([
    undefined,
    'lane_line',
    'solid_yellow_broken_white',
    'broken_white_solid_yellow',
    'broken_yellow',
    'broken_and_solid_yellow',
  ])('keeps every dash on its point of the road (%s)', art => {
    expectDashesStill(drawAt(A, art).strokes, drawAt(B, art).strokes);
  });

  it('keeps a broken line that starts partway down the screen on the road', () => {
    // Solid, then broken from road distance 1000: the broken run starts mid-screen.
    const spans = [{ from: 1000, to: 3000, art: 'broken_yellow' as LongitudinalArt }];
    const a = drawAt(A, 'single_solid_yellow', spans).strokes;
    const b = drawAt(B, 'single_solid_yellow', spans).strokes;
    expect(a.some(stroke => stroke.y > 0)).toBe(true);
    expectDashesStill(a, b);
  });

  it("keeps the acceleration lane's continuity line on the road where the lane opens", () => {
    const continuity = (strokes: DashedStroke[]) => strokes.filter(stroke => stroke.period === 32);
    const a = continuity(drawAt(A, undefined, [], accelerationLane).strokes);
    const b = continuity(drawAt(B, undefined, [], accelerationLane).strokes);
    expect(a).toHaveLength(1);
    expect(a[0].y).toBeGreaterThan(0);
    expectDashesStill(a, b);
    // And the lane opens on the same point of the road, not on a screen row
    // that jumps 6px at a time.
    expect(screenYToDistance(b[0].y, B)).toBeCloseTo(screenYToDistance(a[0].y, A), 6);
  });

  it('puts each stud on a fixed point of the road, not on a screen row', () => {
    const spacing = 18 / SCREEN_PX_PER_UNIT;
    for (const distance of [A, B]) {
      const { studs } = drawAt(distance, 'cats_eye');
      expect(studs.length).toBeGreaterThan(0);
      for (const stud of studs) expect(samePhase(mod(screenYToDistance(stud.y, distance), spacing), 0, spacing)).toBeLessThan(1e-6);
    }
  });

  it('builds the lane separator on fixed points of the road', () => {
    const route: RouteLayout = {
      segments: [
        {
          from: 0,
          to: 4000,
          roadside: 'expressway',
          auxiliary: { role: 'deceleration', taperIn: 0, taperOut: 0, separator: { kind: 'gore', from: 0, to: 4000 } },
        },
      ],
    };
    const rowsAt = (distance: number) => {
      const view = { level: { route }, distance, handled: new Set<number>(), curves: [] } as unknown as FrameView;
      return routeSceneNodes(view)
        .filter(node => node.kind === 'lane-separator')
        .flatMap(node => {
          const { screenY, height } = node as { screenY: number; height: number };
          // Both ends of each length, as points of the road.
          return [screenYToDistance(screenY + height / 2, distance), screenYToDistance(screenY - height / 2, distance)];
        });
    };
    const step = 28 / SCREEN_PX_PER_UNIT;
    for (const distance of [A, B]) {
      const rows = rowsAt(distance);
      expect(rows.length).toBeGreaterThan(0);
      for (const road of rows) expect(samePhase(mod(road, step), 0, step)).toBeLessThan(1e-6);
    }
  });
});
