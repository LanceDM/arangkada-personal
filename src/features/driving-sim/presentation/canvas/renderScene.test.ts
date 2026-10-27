/**
 * Render parity.
 *
 * `render.golden.json` is an order-sensitive digest of every canvas call the
 * event pass made, captured before scene composition moved into the world —
 * 1328 samples, ~200k operations. This replays the same samples through the
 * live path — `composeWorldFrame` → `buildSceneNodes` → `renderScene` — and
 * asserts the stream is identical, so every step of the move is provably a
 * move and not a redraw.
 *
 * A failure here means the picture changed. Regenerate deliberately with
 * `npx tsx scripts/captureRenderGolden.ts` only when a visual change is
 * intended, and say so in the commit.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import {
  collisionSamples,
  FROZEN_NOW,
} from '@/features/driving-sim/domain/world/collisionSamples';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { roadAtFor } from '@/features/driving-sim/domain/world/eventPlacement';
import { recordingCanvasContext } from './rendering/recordingCanvas';
import { renderScene } from './rendering/renderScene';
import golden from './render.golden.json';

describe('the scene, painted', () => {
  const realNow = Date.now;
  beforeAll(() => {
    Date.now = () => FROZEN_NOW;
  });
  afterAll(() => {
    Date.now = realNow;
  });

  it('paints exactly what the pre-split drawing pass painted', () => {
    const samples = collisionSamples();
    expect(samples).toHaveLength(golden.length);

    const mismatches: string[] = [];

    samples.forEach((sample, i) => {
      const expected = golden[i];
      const { ctx, recording } = recordingCanvasContext();
      const view = {
        level: sample.level,
        distance: sample.distance,
        handled: new Set(sample.handled),
        curves: curvesForLevel(sample.level),
      };
      const world = composeWorldFrame(view, { playerLane: sample.playerLane });
      renderScene(ctx, world.nodes, roadAtFor(sample.distance, view.curves));
      const { ops, digest } = recording();
      if (digest !== expected.digest || ops.length !== expected.ops) {
        mismatches.push(
          `level ${expected.levelId} @ ${expected.distance}: ` +
            `${ops.length} ops / ${digest} vs expected ${expected.ops} ops / ${expected.digest}`
        );
      }
    });

    expect(mismatches.slice(0, 10).join('\n')).toBe('');
  });
});
