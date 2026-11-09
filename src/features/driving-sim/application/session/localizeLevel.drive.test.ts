/**
 * Grading and the road never depend on language.
 *
 * Every text in the game is rewritten here and the drive's golden must still
 * hold, frame for frame, every reported decision included. Text is laid over a
 * level for the screens to read, so anything that decides or grades from it
 * fails here. `localizeLevel.render.test.ts` holds the canvas and the solids.
 */
import { describe, expect, it } from 'vitest';
import { rewrittenCatalogue } from '@/features/driving-sim/domain/scenario/scenarioTexts.fixture';
import { localizeLevel } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import driveGolden from './drive.golden.json';
import { driveSamples, runDrive } from './driveSamples';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';

const catalogue = rewrittenCatalogue();
const rewritten = (level: LevelConfig) => localizeLevel(level, 'fil', catalogue, { showDrafts: false });

describe('every text in the game rewritten', () => {
  it('rewrites what it says it does', () => {
    const level = rewritten(LEVELS[1]);
    expect(level.events.every(event => event.description.startsWith('XXXX '))).toBe(true);
  });

  it('is the same drive, frame for frame, with the same decisions', () => {
    const moved = driveSamples().flatMap((sample, index) => {
      const { digest, lines } = runDrive(sample, 'full', rewritten);
      const expected = driveGolden[index];
      return digest === expected.digest && lines.length === expected.lines ? [] : [`level ${expected.levelId} seed ${expected.seed}`];
    });
    expect(moved).toEqual([]);
  }, 120_000);
});
