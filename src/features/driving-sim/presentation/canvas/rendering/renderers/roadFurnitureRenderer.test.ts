// Geometry check for the one world element whose arithmetic was rewritten
// rather than moved.
//
// `drawTrafficSignal` replaced two inline blocks in `drawEvents` — one per
// aspect — that shared a signal head but expressed it in different
// coordinates: the red one measured from the right curb, the amber one from
// the centre of the canvas, and neither named the box, the mast or the lamp
// spacing. Merging them meant re-deriving all of that relative to the lamp
// column, which is exactly the kind of change that silently moves a sign three
// pixels and is never noticed.
//
// So the two original blocks are transcribed here as literal expected output
// and the merged function is run against a recording context. If the geometry
// ever drifts, this fails with the op that moved.
import { describe, it, expect } from 'vitest';
import { drawTrafficSignal } from './roadFurnitureRenderer';

type Op = string;

/**
 * A stand-in for CanvasRenderingContext2D that records the drawing calls and
 * the style in force when each one was made. Only the handful of operations a
 * signal head uses are implemented; anything else would show up as a missing
 * method rather than a silently ignored call.
 */
const recordingContext = () => {
  const ops: Op[] = [];
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 0, shadowColor: '', shadowBlur: 0 };
  const round = (n: number) => Math.round(n * 100) / 100;

  const ctx = {
    ...state,
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    beginPath: () => {},
    fillRect: (x: number, y: number, w: number, h: number) =>
      ops.push(`fillRect(${round(x)},${round(y)},${w},${h}) fill=${ctx.fillStyle}`),
    roundRect: (x: number, y: number, w: number, h: number, r: number) =>
      ops.push(`roundRect(${round(x)},${round(y)},${w},${h},${r}) fill=${ctx.fillStyle}`),
    arc: (x: number, y: number, r: number) =>
      ops.push(`arc(${round(x)},${round(y)},${r}) fill=${ctx.fillStyle} glow=${ctx.shadowBlur}`),
    fill: () => {},
    stroke: () => ops.push(`stroke stroke=${ctx.strokeStyle} width=${ctx.lineWidth}`),
  } as unknown as CanvasRenderingContext2D & { ops: Op[] };

  return Object.assign(ctx, { ops });
};

// The road geometry the two original blocks were written against.
const ROAD_X = 130;
const ROAD_WIDTH = 200;
const CANVAS_WIDTH = 460;
const SCREEN_Y = 300;

describe('drawTrafficSignal matches the inline heads it replaced', () => {
  it('draws the junction-mounted red exactly where the red_light branch did', () => {
    const ctx = recordingContext();
    // Anchored on the lamp column and the top of the box, which is what the
    // original's roadX + ROAD_WIDTH - 23 / screenY - 59 worked out to.
    drawTrafficSignal(ctx, ROAD_X + ROAD_WIDTH - 23, SCREEN_Y - 59, 'red', { mast: true });

    expect(ctx.ops).toEqual([
      'save',
      // Mast: roadX + ROAD_WIDTH - 25, screenY - 64, 4 x 67
      'fillRect(305,236,4,67) fill=#444',
      // Housing: roadX + ROAD_WIDTH - 37, screenY - 59, 28 x 55, r6
      'roundRect(293,241,28,55,6) fill=#222',
      'stroke stroke=#444 width=1',
      // Lamps at roadX + ROAD_WIDTH - 23, screenY - 44 / -26 / -8
      'arc(307,256,8) fill=#ef4444 glow=12',
      'arc(307,274,8) fill=#4a3a00 glow=0',
      'arc(307,292,8) fill=#003a00 glow=0',
      'restore',
    ]);
  });

  it('draws the standalone amber exactly where the yellow_light branch did', () => {
    const ctx = recordingContext();
    drawTrafficSignal(ctx, CANVAS_WIDTH / 2, SCREEN_Y - 45, 'yellow');

    expect(ctx.ops).toEqual([
      'save',
      // No mast, and no housing outline: the amber head never drew either.
      'roundRect(216,255,28,55,6) fill=#222',
      // Lamps at CANVAS_WIDTH / 2, screenY - 30 / -12 / +6
      'arc(230,270,8) fill=#3a0000 glow=0',
      'arc(230,288,8) fill=#f59e0b glow=12',
      'arc(230,306,8) fill=#003a00 glow=0',
      'restore',
    ]);
  });
});
