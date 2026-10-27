/**
 * What a gantry says has to be readable, and has to be true of the lane it
 * hangs over.
 *
 * Both boards on this road are read while driving at it, which leaves no room
 * for either failure mode a sign panel has. A use line set at a fixed size ran
 * off a 59px panel and printed itself across the panel beside it, so four lane
 * assignments became one smear. And a toll indicator is only a rule if the
 * barrier behind it agrees: a green arrow over a gate whose arm is down, or a
 * red X over the one gate that is open, teaches the opposite of the sign it is
 * imitating.
 */
import { describe, expect, it } from 'vitest';
import { LANE_COUNT, laneEdges, ROAD_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { tollGateBarriers } from '@/features/driving-sim/domain/world/sceneGeometry';
import type { GantryPanel } from '@/features/driving-sim/domain/scene/SceneNode';
import { drawOverheadGantry, drawTollPlaza } from './junctionRenderer';

interface TextOp {
  text: string;
  x: number;
  size: number;
}
interface RectOp {
  x0: number;
  x1: number;
  style: string;
}

/**
 * Records text with the font size in force, and the horizontal span of every
 * fill and stroke. `measureText` charges 0.62em per character, which is close
 * enough to a condensed sans to make a fit check mean something.
 */
const recordingContext = () => {
  const texts: TextOp[] = [];
  const rects: RectOp[] = [];
  const path: number[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '9px Inter',
    textAlign: 'center',
    save: () => {},
    restore: () => {},
    beginPath: () => {
      path.length = 0;
    },
    moveTo: (x: number) => path.push(x),
    lineTo: (x: number) => path.push(x),
    closePath: () => {},
    roundRect: (x: number, _y: number, w: number) => path.push(x, x + w),
    fillRect: (x: number, _y: number, w: number) =>
      rects.push({ x0: x, x1: x + w, style: String(ctx.fillStyle) }),
    fill: () =>
      path.length &&
      rects.push({ x0: Math.min(...path), x1: Math.max(...path), style: String(ctx.fillStyle) }),
    stroke: () =>
      path.length &&
      rects.push({ x0: Math.min(...path), x1: Math.max(...path), style: String(ctx.strokeStyle) }),
    measureText: (text: string) => ({
      width: text.length * 0.62 * parseFloat(String(ctx.font)),
    }),
    fillText: (text: string, x: number) =>
      texts.push({ text, x, size: parseFloat(String(ctx.font)) }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, rects };
};

const ROAD_X = 100;

const lanePanels: GantryPanel[] = [
  { lane: 0, top: 'LANE 1', bottom: 'OVERTAKING / ONLY', tone: 'restricted', badge: 'ONLY' },
  { lane: 1, top: 'LANE 2', bottom: 'CARS / LIGHT VEHICLES', tone: 'target', badge: 'YOUR LANE' },
  { lane: 2, top: 'LANE 3', bottom: 'LARGE BUSES / HEAVY FREIGHT', tone: 'lane' },
  { lane: 3, top: 'LANE 4', bottom: 'SPECIAL / CONSTRUCTION', tone: 'lane' },
];

describe('a lane-assignment gantry', () => {
  it('keeps every line of every panel inside the lane it hangs over', () => {
    const { ctx, texts } = recordingContext();
    drawOverheadGantry(ctx, ROAD_X, 300, lanePanels);

    const edges = laneEdges(ROAD_X);
    const overflowing = texts.filter(op => {
      const half = (op.text.length * 0.62 * op.size) / 2;
      const lane = lanePanels.find(
        panel => op.x > edges[panel.lane] && op.x < edges[panel.lane + 1]
      );
      if (!lane) return true;
      const room = edges[lane.lane + 1] - edges[lane.lane] - 6;
      return half * 2 > room;
    });
    expect(overflowing.map(op => op.text)).toEqual([]);
  });

  it('says what each panel means in a word as well as in a colour', () => {
    const { ctx, texts } = recordingContext();
    drawOverheadGantry(ctx, ROAD_X, 300, lanePanels);
    const printed = texts.map(op => op.text);
    // A colour-blind reader, and a washed-out screen, get the same two facts a
    // colour does: which lane is this car's, and which one is conditional.
    expect(printed).toContain('YOUR LANE');
    expect(printed).toContain('ONLY');
  });

  it('prints each half of the use line, so nothing is lost to fitting it', () => {
    const { ctx, texts } = recordingContext();
    drawOverheadGantry(ctx, ROAD_X, 300, lanePanels);

    const printed = texts.map(op => op.text);
    expect(printed).toContain('LARGE BUSES');
    expect(printed).toContain('HEAVY FREIGHT');
    // And the lane it belongs to is still named.
    expect(printed).toContain('LANE 3');
  });
});

describe('a toll plaza', () => {
  it('puts its one open indicator over the one gate without an arm across it', () => {
    for (let openLane = 0; openLane < LANE_COUNT; openLane++) {
      const { ctx, rects } = recordingContext();
      drawTollPlaza(ctx, ROAD_X, 300, openLane as 0 | 1 | 2 | 3);

      const edges = laneEdges(ROAD_X);
      const open = { from: edges[openLane], to: edges[openLane + 1] };

      // The green arrow is the only thing drawn in the open tone, and it is
      // drawn over the open gate.
      const green = rects.filter(r => r.style === '#22c55e');
      expect(green.length).toBeGreaterThan(0);
      for (const mark of green) {
        expect(mark.x0).toBeGreaterThanOrEqual(open.from);
        expect(mark.x1).toBeLessThanOrEqual(open.to);
      }

      // And no barrier arm crosses it. The arms are the scene node's own
      // solids, so this is the drawn gate and the collidable gate agreeing.
      for (const gate of tollGateBarriers(ROAD_X, openLane)) {
        expect(gate.lane).not.toBe(openLane);
        const clear = gate.x + gate.width <= open.from || gate.x >= open.to;
        expect(clear, `gate ${gate.lane} crosses the open gate`).toBe(true);
      }
      const closed = tollGateBarriers(ROAD_X, openLane);
      expect(closed).toHaveLength(LANE_COUNT - 1);
    }
  });

  it('leaves the open gate wide enough to drive a car through', () => {
    const openLane = LANE_COUNT - 1;
    const edges = laneEdges(ROAD_X);
    const arms = tollGateBarriers(ROAD_X, openLane);
    const nearest = Math.max(...arms.map(gate => gate.x + gate.width));
    expect(edges[openLane + 1] - nearest).toBeGreaterThan(50);
    expect(edges[LANE_COUNT]).toBe(ROAD_X + ROAD_WIDTH);
  });
});
