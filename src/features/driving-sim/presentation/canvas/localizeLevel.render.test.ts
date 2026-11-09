/**
 * The road never depends on language: with every text in the game
 * rewritten, the canvas paints call for call and the solids stand body for body.
 * Text on the road (a sign, a gantry) is drawn from fields that are not
 * translated, so anything that starts drawing from a translated one fails here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rewrittenCatalogue } from '@/features/driving-sim/domain/scenario/scenarioTexts.fixture';
import { localizeLevel } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { collisionSamples, FROZEN_NOW } from '@/features/driving-sim/domain/world/collisionSamples';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { roadAtFor } from '@/features/driving-sim/domain/world/eventPlacement';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { recordingCanvasContext } from './rendering/recordingCanvas';
import { renderScene } from './rendering/renderScene';
import renderGolden from './render.golden.json';

const catalogue = rewrittenCatalogue();
const rewritten = (level: LevelConfig) => localizeLevel(level, 'fil', catalogue, { showDrafts: false });

describe('the scene with every text rewritten', () => {
  const realNow = Date.now;
  beforeAll(() => {
    Date.now = () => FROZEN_NOW;
  });
  afterAll(() => {
    Date.now = realNow;
  });

  it('paints the same canvas and stands the same solids', () => {
    const moved: string[] = [];
    collisionSamples().forEach((sample, i) => {
      const compose = (level: LevelConfig) => {
        const view = { level, distance: sample.distance, handled: new Set(sample.handled), curves: curvesForLevel(level) };
        return { view, world: composeWorldFrame(view, { playerLane: sample.playerLane }) };
      };
      const { view, world } = compose(rewritten(sample.level));
      const { ctx, recording } = recordingCanvasContext();
      renderScene(ctx, world.nodes, roadAtFor(sample.distance, view.curves));
      if (recording().digest !== renderGolden[i].digest) moved.push(`paint: level ${sample.levelId} @ ${sample.distance}`);
      // A body's `label` is the name a crash message reads, which is text.
      const bodies = (frame: typeof world) => JSON.stringify(frame.colliders, (key, value) => (key === 'label' ? undefined : value));
      if (bodies(world) !== bodies(compose(sample.level).world)) moved.push(`solids: level ${sample.levelId} @ ${sample.distance}`);
    });
    expect(moved.slice(0, 20)).toEqual([]);
  }, 120_000);
});
