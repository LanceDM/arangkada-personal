/**
 * Every dashed line on the road moves on smoothly as the road scrolls.
 *
 * A dash is moved only by `lineDashOffset`, and the offset wraps. Wrapped at
 * a length its pattern does not divide, the pattern jumps back part of a
 * period each time: the 28 and 32 px centre lines were wrapped at 70, the
 * divider's length. And a line given no offset never moves at all, which is
 * what the acceleration lane's continuity line did.
 */
import { describe, expect, it } from 'vitest';
import type { LongitudinalArt, RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { drawRoad } from './roadRenderer';

interface DashedStroke {
  period: number;
  offset: number;
}

/** A context that keeps only the dashed strokes, with the offset each was drawn at. */
const dashRecorder = () => {
  const strokes: DashedStroke[] = [];
  let state = { dash: [] as number[], offset: 0 };
  const saved: (typeof state)[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === 'setLineDash') return (dash: number[]) => (state = { ...state, dash: [...dash] });
        if (key === 'save') return () => saved.push({ ...state });
        if (key === 'restore') return () => (state = saved.pop() ?? state);
        if (key === 'stroke')
          return () => {
            const period = state.dash.reduce((sum, length) => sum + length, 0);
            if (period > 0) strokes.push({ period, offset: state.offset });
          };
        if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
        if (key === 'createLinearGradient') return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set(_target, key: string, value: unknown) {
        if (key === 'lineDashOffset') state = { ...state, offset: value as number };
        return true;
      },
    }
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes };
};

/** The dashed strokes painted at one road offset. */
const dashesAt = (roadOffset: number, art?: LongitudinalArt, route?: RouteLayout) => {
  const { ctx, strokes } = dashRecorder();
  const paint = art ? { oncomingLanes: 1, base: art, spans: [] } : undefined;
  drawRoad(ctx, roadOffset, 500, [], [], paint, route);
  return strokes;
};

/** How far a pattern moved along its line, within one period. */
const moved = (before: DashedStroke, after: DashedStroke) =>
  (((before.offset - after.offset) % after.period) + after.period) % after.period;

/** Either side of 70, where the old shared wrap fell. */
const BEFORE = 69;
const STEP = 2;

const accelerationLane: RouteLayout = {
  segments: [{ from: 0, to: 4000, roadside: 'expressway', auxiliary: { role: 'acceleration', taperIn: 0, taperOut: 400 } }],
};

describe('dashed road paint', () => {
  it.each<LongitudinalArt | undefined>([
    undefined,
    'lane_line',
    'solid_yellow_broken_white',
    'broken_white_solid_yellow',
    'broken_yellow',
    'broken_and_solid_yellow',
  ])('moves every dash by the scroll, across the wrap (%s)', art => {
    const before = dashesAt(BEFORE, art);
    const after = dashesAt(BEFORE + STEP, art);
    expect(before.length).toBeGreaterThan(0);
    expect(after).toHaveLength(before.length);
    after.forEach((stroke, i) => expect(moved(before[i], stroke)).toBeCloseTo(STEP, 9));
  });

  it("scrolls the acceleration lane's continuity line with the rest", () => {
    const before = dashesAt(BEFORE, undefined, accelerationLane);
    const after = dashesAt(BEFORE + STEP, undefined, accelerationLane);
    const continuity = (strokes: DashedStroke[]) => strokes.filter(stroke => stroke.period === 32);
    expect(continuity(before)).toHaveLength(1);
    expect(moved(continuity(before)[0], continuity(after)[0])).toBeCloseTo(STEP, 9);
  });
});
