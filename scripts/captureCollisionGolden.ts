/**
 * Records the solids every sample point composes, and writes the golden the
 * collision parity test asserts against.
 *
 * The companion to `captureRenderGolden.ts`, over the same sample points: that
 * one pins the picture, this one pins what is solid in it. Written because the
 * two have to be regenerated together — a scene whose geometry moves changes
 * both — and until now only half of that pair could be regenerated at all.
 *
 * Run it only when a change to a scene's geometry is intended, and say so in
 * the commit: the point of the golden is that an unintended change to where the
 * solids are fails a test.
 *
 * Run: `npx tsx scripts/captureCollisionGolden.ts`
 */
import { writeFileSync } from 'fs';
import { curvesForLevel } from '../src/features/driving-sim/domain/world/roadCurves';
import { composeWorldFrame } from '../src/features/driving-sim/domain/world/composeWorldFrame';
import {
  collisionSamples,
  FROZEN_NOW,
} from '../src/features/driving-sim/domain/world/collisionSamples';

const round = (n: number) => Math.round(n * 1000) / 1000;

const golden = collisionSamples().map(sample => {
  const { colliders } = composeWorldFrame(
    {
      level: sample.level,
      distance: sample.distance,
      handled: new Set(sample.handled),
      curves: curvesForLevel(sample.level),
    },
    { playerLane: sample.playerLane, now: () => FROZEN_NOW }
  );
  return {
    levelId: sample.levelId,
    distance: sample.distance,
    handled: sample.handled,
    playerLane: sample.playerLane,
    bodies: colliders.map(body => ({
      x: round(body.x),
      y: round(body.y),
      width: body.width,
      height: body.height,
      kind: body.kind,
      label: body.label,
    })),
  };
});

const target = 'src/features/driving-sim/domain/world/collision.golden.json';
writeFileSync(target, `${JSON.stringify(golden, null, 1)}\n`);
console.log(
  `wrote ${golden.length} samples, ${golden.reduce((n, s) => n + s.bodies.length, 0)} bodies -> ${target}`
);
