import { describe, expect, it } from 'vitest';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';
import { composeDrive } from './composeDrive';
import { buildLevelConfig } from './levelCatalog';
import { buildPlayLevel, COMPOSED_IN_PLAY } from './playLevel';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

describe('the level normal play drives', () => {
  it.each(COMPOSED_IN_PLAY)('Level %i is the course draw for the seed, everything unseen', levelId => {
    for (const seed of SEEDS) {
      const played = buildPlayLevel(levelId, undefined, null, createRng(seed));
      const course = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: createRng(seed) }).level;
      expect(played).toEqual(course);
      expect(played!.events.filter(event => event.offRoad)).toEqual([]);
    }
  });

  it.each(COMPOSED_IN_PLAY)('Level %i rebuilds the same drive from the same seed, and varies across seeds', levelId => {
    const ids = (seed: number) => buildPlayLevel(levelId, undefined, null, createRng(seed))!.events.map(event => event.id).join('|');
    expect(ids(9)).toBe(ids(9));
    expect(new Set(SEEDS.map(ids)).size).toBeGreaterThan(30);
  });

  it.each([0, 1, 2, 3, 4, 5, 7, 12])('Level %i is the roll it always was', levelId => {
    for (const seed of SEEDS.slice(0, 10)) {
      expect(buildPlayLevel(levelId, undefined, null, createRng(seed))).toEqual(
        buildLevelConfig(levelId, undefined, null, createRng(seed))
      );
    }
  });
});
