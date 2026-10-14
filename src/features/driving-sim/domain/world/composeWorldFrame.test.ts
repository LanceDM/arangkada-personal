/**
 * Collision parity.
 *
 * `collision.golden.json` was captured from the drawing pass that used to
 * produce hitboxes as a side effect of painting, across every level, every
 * event and every distance at which it is on screen — 1328 samples. This
 * asserts that composing the world produces exactly the same solids, so moving
 * collision out of the renderer is provably a move and not a rewrite.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeWorldFrame } from './composeWorldFrame';
import { collisionSamples, FROZEN_NOW } from './collisionSamples';
import { curvesForLevel } from './roadCurves';
import golden from './collision.golden.json';

const round = (n: number) => Math.round(n * 1000) / 1000;

describe('composeWorldFrame', () => {
  // Two scenes move on their own clock (a pedestrian walking a signalised
  // crossing, traffic waving across a main road), and the scripted roundabout
  // car reads the clock inside `npcTransform`. The golden was captured with the
  // clock frozen here, so the replay freezes it the same way.
  const realNow = Date.now;
  beforeAll(() => {
    Date.now = () => FROZEN_NOW;
  });
  afterAll(() => {
    Date.now = realNow;
  });

  it('produces exactly the solids the drawing pass used to record', () => {
    const samples = collisionSamples();
    expect(samples).toHaveLength(golden.length);

    const mismatches: string[] = [];

    samples.forEach((sample, i) => {
      const expected = golden[i];
      const { colliders } = composeWorldFrame(
        {
          level: sample.level,
          distance: sample.distance,
          handled: new Set(sample.handled),
          curves: curvesForLevel(sample.level),
        },
        { playerLane: sample.playerLane, now: () => FROZEN_NOW }
      );

      const actual = colliders.map(b => ({
        x: round(b.x),
        y: round(b.y),
        width: b.width,
        height: b.height,
        kind: b.kind,
        label: b.label,
      }));

      if (JSON.stringify(actual) !== JSON.stringify(expected.bodies)) {
        mismatches.push(
          `level ${expected.levelId} @ ${expected.distance} (handled=${expected.handled.length})\n` +
            `  expected: ${JSON.stringify(expected.bodies)}\n` +
            `  actual:   ${JSON.stringify(actual)}`
        );
      }
    });

    expect(mismatches.slice(0, 5).join('\n')).toBe('');
    expect(mismatches).toHaveLength(0);
  });

  it('needs no canvas: the world is composed from geometry alone', () => {
    // The point of the move. If this ever needs a stub context again, collision
    // has drifted back into the drawing pass.
    const sample = collisionSamples()[0];
    expect(() =>
      composeWorldFrame({
        level: sample.level,
        distance: sample.distance,
        handled: new Set(),
        curves: curvesForLevel(sample.level),
      })
    ).not.toThrow();
  });
});
