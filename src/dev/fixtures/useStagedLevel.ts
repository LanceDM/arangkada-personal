// Dev-only. Shared "force this level's content" state: pick a level, then for
// whichever levels currently roll from a pool, either seed a reproducible
// roll or force an exact variant per slot (and per garage hotspot, for level
// 2). Extracted out of ScenarioLab so RendererLab's Scrub tab can stage a
// level the same way without duplicating the picking logic.
import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { buildEvents } from '@/features/driving-sim/domain/scenario/pooling';
import { buildLevelConfig, getPooledSlots, levelWithEvents, LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { type GarageHotspot, type LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { createRng } from '@/shared/lib/rng';
import { composeDrive } from '@/features/driving-sim/domain/scenario/composeDrive';
import { isCompetencyStage, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { garageHotspotSlots } from './scenarioCatalog';

export type StagedMode = 'seeded' | 'course' | 'exact' | 'single';
export interface SinglePick { slotIndex: number; variantIndex: number }

export interface StagedLevel {
  levelId: number;
  setLevelId: (id: number) => void;
  mode: StagedMode;
  setMode: (mode: StagedMode) => void;
  seed: number;
  setSeed: (seed: number) => void;
  exactIndices: number[];
  setExactIndices: Dispatch<SetStateAction<number[]>>;
  exactHotspotIndices: number[];
  setExactHotspotIndices: Dispatch<SetStateAction<number[]>>;
  singlePick: SinglePick;
  setSinglePick: (pick: SinglePick) => void;
  isPooled: boolean;
  pooled: ReturnType<typeof getPooledSlots>;
  staticLevel: LevelConfig;
  stagedLevel: LevelConfig;
}

export const useStagedLevel = (initialLevelId = 1): StagedLevel => {
  const [levelId, setLevelId] = useState(initialLevelId);
  const [mode, setMode] = useState<StagedMode>('seeded');
  const [seed, setSeed] = useState(1);
  const [exactIndices, setExactIndices] = useState<number[]>([]);
  const [exactHotspotIndices, setExactHotspotIndices] = useState<number[]>([]);
  const [singlePick, setSinglePick] = useState<SinglePick>({ slotIndex: 0, variantIndex: 0 });

  const staticLevel = LEVELS.find(l => l.id === levelId) ?? LEVELS[0];
  const pooled = getPooledSlots(levelId);
  // Whether this level rolls from a pool at all - reads directly off
  // getPooledSlots rather than a separately-maintained id list, so a
  // level that becomes pooled later doesn't need this file touched too.
  const isPooled = pooled !== null;

  // Reset all picks whenever the level changes so stale indices never leak.
  // Adjusted while rendering rather than in an Effect: the indices belong to
  // the level being shown, and resetting them a render late would index this
  // level's slots with the last one's picks.
  const [picksFor, setPicksFor] = useState(levelId);
  if (picksFor !== levelId) {
    setPicksFor(levelId);
    setExactIndices(pooled ? pooled.slots.map(() => 0) : []);
    setExactHotspotIndices(levelId === 2 ? garageHotspotSlots.map(() => 0) : []);
    setSinglePick({ slotIndex: 0, variantIndex: 0 });
  }

  const stagedLevel: LevelConfig = useMemo(() => {
    // The drive the competency course composes for this seed: three scenarios
    // per competency, unseen first, borrowed ones included (composeDrive). What a
    // first attempt at this stage plays.
    if (mode === 'course' && isCompetencyStage(levelId)) {
      return composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: createRng(seed) }).level;
    }

    if (!isPooled || !pooled) return staticLevel;

    if (mode === 'seeded') {
      const roll = buildLevelConfig(levelId, undefined, null, createRng(seed)) ?? staticLevel;
      if (roll !== staticLevel) return roll;
      // A level with no roll of its own (6, 8-11): one variant per slot, by seed.
      const rng = createRng(seed);
      const events = buildEvents(pooled.slots, pooled.distances, pool => pool[Math.floor(rng() * pool.length)]);
      return levelWithEvents(levelId, events) ?? staticLevel;
    }

    if (mode === 'single') {
      // Force exactly the picked event's slot; fill the rest with a seeded roll
      // so the level still plays out normally around the one scenario under test.
      const rng = createRng(seed);
      const events = buildEvents(pooled.slots, pooled.distances, (pool, i) =>
        i === singlePick.slotIndex
          ? (pool[singlePick.variantIndex] ?? pool[0])
          : pool[Math.floor(rng() * pool.length)]
      );
      // Assembled as a roll of these events would be, so a level whose road is
      // painted from its roll (4, 12) shows the staged lines, not the static's.
      return levelWithEvents(levelId, events) ?? staticLevel;
    }

    const events = buildEvents(pooled.slots, pooled.distances, (pool, i) => pool[exactIndices[i] ?? 0]);
    const exact = levelWithEvents(levelId, events) ?? staticLevel;
    const garage =
      levelId === 2 && staticLevel.garage
        ? {
            ...staticLevel.garage,
            hotspots: garageHotspotSlots.map(({ shell, pool }, i): GarageHotspot => ({
              ...shell,
              ...pool[exactHotspotIndices[i] ?? 0],
            })),
          }
        : staticLevel.garage;

    return { ...exact, garage };
  }, [isPooled, pooled, mode, seed, singlePick, exactIndices, exactHotspotIndices, levelId, staticLevel]);

  return {
    levelId,
    setLevelId,
    mode,
    setMode,
    seed,
    setSeed,
    exactIndices,
    setExactIndices,
    exactHotspotIndices,
    setExactHotspotIndices,
    singlePick,
    setSinglePick,
    isPooled,
    pooled,
    staticLevel,
    stagedLevel,
  };
};
