/**
 * Records exactly what the event pass paints, per sample, as an order-sensitive
 * digest, and writes the golden the render parity test asserts against.
 *
 * Run it only when a visual change is intended, and say so in the commit: the
 * point of the golden is that an unintended change to the picture fails a test.
 *
 * Run: `npx tsx scripts/captureRenderGolden.ts`
 */
import { writeFileSync } from 'fs';
import { curvesForLevel } from '../src/features/driving-sim/domain/world/roadCurves';
import { renderScene } from '../src/features/driving-sim/presentation/canvas/rendering/renderScene';
import { roadAtFor } from '../src/features/driving-sim/domain/world/eventPlacement';
import { composeWorldFrame } from '../src/features/driving-sim/domain/world/composeWorldFrame';
import { recordingCanvasContext } from '../src/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import {
  collisionSamples,
  FROZEN_NOW,
} from '../src/features/driving-sim/domain/world/collisionSamples';

const realNow = Date.now;
Date.now = () => FROZEN_NOW;

const golden = collisionSamples().map(sample => {
  const { ctx, recording } = recordingCanvasContext();
  const view = {
    level: sample.level,
    distance: sample.distance,
    handled: new Set(sample.handled),
    curves: curvesForLevel(sample.level),
  };
  renderScene(
    ctx,
    composeWorldFrame(view, { playerLane: sample.playerLane }).nodes,
    roadAtFor(sample.distance, view.curves)
  );
  const { ops, digest } = recording();
  return { levelId: sample.levelId, distance: sample.distance, ops: ops.length, digest };
});

Date.now = realNow;

const target = 'src/features/driving-sim/presentation/canvas/render.golden.json';
writeFileSync(target, `${JSON.stringify(golden, null, 1)}\n`);
console.log(
  `wrote ${golden.length} samples, ${golden.reduce((n, s) => n + s.ops, 0)} ops -> ${target}`
);
