import { describe, expect, it } from 'vitest';
import { buildLevelConfig, getPooledSlots, getRerollableSlots } from './levelCatalog';
import { inPlay } from './pooling';
import { composeDrive } from './composeDrive';
import { STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { createRng } from '@/shared/lib/rng';

// Every path a player reaches Story Mode by (Legacy's plan, New routing for a
// guest or a signed-in non-study account, a free replay from the map) builds
// its level with `buildLevelConfig` and the attempt's roll stream. The study
// course composes its own drive (`composeDrive`).
const rolledEvents = (levelId: number, seed: number) => buildLevelConfig(levelId, undefined, null, createRng(seed))!.events;
const rolled = (levelId: number, seed: number) => rolledEvents(levelId, seed).map(event => event.id).join('|');
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('a level rolled for an attempt', () => {
  it.each([6, 8, 9, 10, 11])('Level %i rolls only in-play versions, the same drive per seed, reaching every one', levelId => {
    const playable = new Set(getPooledSlots(levelId)!.slots.flatMap(pool => inPlay(pool).map(variant => variant.id)));
    const reached = new Set(SEEDS.flatMap(seed => rolledEvents(levelId, seed).map(event => event.id)));
    expect([...reached].filter(id => !playable.has(id))).toEqual([]);
    expect([...playable].filter(id => !reached.has(id))).toEqual([]);
    expect(rolled(levelId, 7)).toBe(rolled(levelId, 7));
  });

  it('keeps Level 7 as authored: its slots are the expressway itself', () => {
    expect(new Set(SEEDS.slice(0, 20).map(seed => rolled(7, seed))).size).toBe(1);
  });

  it('re-rolls live only on Levels 1-5', () => {
    expect([6, 7, 8, 9, 10, 11, 12].filter(levelId => getRerollableSlots(levelId) !== null)).toEqual([]);
  });
});

describe('a scenario the road does not draw (offRoad)', () => {
  it('is never rolled, composed, borrowed or appended on any level', () => {
    for (const levelId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (const seed of SEEDS.slice(0, 40)) {
        const roll = buildLevelConfig(levelId, undefined, null, createRng(seed))!;
        const drive = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId as 1], rng: createRng(seed) });
        expect([...roll.events, ...drive.level.events].filter(event => event.offRoad).map(event => event.id)).toEqual([]);
      }
    }
  });
});

describe('a scenario placed on a road that is not its own', () => {
  // A scenario that needs a road feature (a junction, a crossing, a bridge, a
  // signal) brings it: the scene is composed from the scenario's own
  // declaration wherever it stands. The one feature that is the level's road
  // itself, a route (an acceleration lane, a toll plaza), is never placed
  // anywhere but its own slot. Nothing is read from the prose.
  const FEATURE_SCENES = new Set(['intersection', 'side_road', 'crosswalk', 'signal', 'bridge', 'junction_t', 'railway', 'roundabout']);
  const ownsItsScene = (event: { sign?: unknown; marking?: unknown; inspection?: unknown; scenePrefab?: unknown }) =>
    !!(event.sign || event.marking || event.inspection || event.scenePrefab);

  it('brings the feature it needs, and a route is never placed off its own level', async () => {
    const { resolveScene } = await import('@/features/driving-sim/domain/scene/ResolvedScene');
    for (const levelId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      for (const seed of SEEDS.slice(0, 30)) {
        const drive = composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId as 1], rng: createRng(seed) });
        const appended = new Set(drive.items.filter(item => item.placement === 'appended').map(item => item.scenarioId));
        for (const event of drive.level.events.filter(entry => appended.has(entry.id))) {
          expect(event.scene, event.id).not.toBe('route');
          if (event.scene && FEATURE_SCENES.has(event.scene) && !ownsItsScene(event)) {
            expect(resolveScene(event, { isTutorialLevel: false }).kind, event.id).not.toBe('nothing');
          }
        }
      }
    }
  }, 60_000);
});
