// Every stage's content as one shape, for the drive composer.
//
// A stage is its road (the static level: speed, paint, route layout, garage
// and aftermath scenes), the slots along it (each slot one position on the
// road, holding one of its variants per drive), and its inspection points (a
// garage or a crash scene, each point holding one of its variants). The
// composer picks what stands in each slot and point, drops the rest, and
// appends portable scenarios after the last slot when a competency needs more
// positions than the stage's road has.
import type { GarageHotspot, LevelConfig, ScenarioEvent } from './scenarioDefinition';
import type { SlotVariant } from './pooling';
import { LEVELS } from './levelCatalog';
import { SLOTS as level1Slots, SLOT_DISTANCES as level1Distances } from './content/levels/level1';
import { HOTSPOTS as level2Hotspots, SLOTS as level2Slots, SLOT_DISTANCES as level2Distances } from './content/levels/level2';
import { SLOT_DISTANCES as level3Distances } from './content/levels/level3/level3';
import { SLOTS as level3Slots } from './content/levels/level3/pools';
import { assembleLevel4, SLOT_DISTANCES as level4Distances } from './content/levels/level4/level4';
import { SLOTS as level4Slots } from './content/levels/level4/pools';
import { SLOTS as level5Slots, SLOT_DISTANCES as level5Distances } from './content/levels/level5';
import { SLOTS as level6Slots, SLOT_DISTANCES as level6Distances } from './content/levels/level6';
import { SLOTS as level7Slots, SLOT_DISTANCES as level7Distances } from './content/levels/level7';
import { SLOTS as level8Slots, SLOT_DISTANCES as level8Distances } from './content/levels/level8';
import { SLOTS as level9Slots, SLOT_DISTANCES as level9Distances } from './content/levels/level9';
import { SLOTS as level10Slots, SLOT_DISTANCES as level10Distances } from './content/levels/level10';
import { SLOTS as level11Slots, SLOT_DISTANCES as level11Distances } from './content/levels/level11';

/** One inspection point and the content that can stand at it. */
export interface StagePoint {
  /** The point as the scene draws it; its content fields are replaced by a variant's. */
  shell: GarageHotspot;
  variants: GarageHotspot[];
}

export interface StageContent {
  levelId: number;
  slots: SlotVariant[][];
  distances: number[];
  /** The road as authored: everything about the level but its events and points. */
  base: LevelConfig;
  /** Paints the road from the events placed on it, for a level whose paint depends on them. */
  assemble?: (events: ScenarioEvent[]) => LevelConfig;
  /** The pre-drive garage's points (Levels 2 and 10). */
  garage: StagePoint[];
  /** The crash scene's points (Level 9). */
  aftermath: StagePoint[];
}

const SLOTS: Record<number, { slots: SlotVariant[][]; distances: number[] }> = {
  1: { slots: level1Slots, distances: level1Distances },
  2: { slots: level2Slots, distances: level2Distances },
  3: { slots: level3Slots, distances: level3Distances },
  4: { slots: level4Slots, distances: level4Distances },
  5: { slots: level5Slots, distances: level5Distances },
  6: { slots: level6Slots, distances: level6Distances },
  7: { slots: level7Slots, distances: level7Distances },
  8: { slots: level8Slots, distances: level8Distances },
  9: { slots: level9Slots, distances: level9Distances },
  10: { slots: level10Slots, distances: level10Distances },
  11: { slots: level11Slots, distances: level11Distances },
};

/** A point holding exactly the one variant it was authored with: its own id is its scenario id. */
const fixedPoints = (levelId: number, kind: 'garage' | 'aftermath', hotspots: GarageHotspot[] = []): StagePoint[] =>
  hotspots.map(hotspot => ({
    shell: hotspot,
    variants: [{ ...hotspot, scenarioId: `level${levelId}.${kind}.${hotspot.id}` }],
  }));

/** Level 2's eight points, each with its pool of findings, named as the catalogue names them. */
const level2Points = (): StagePoint[] =>
  level2Hotspots.map(({ shell, pool }) => {
    const base = { ...shell, ...pool[0] } as GarageHotspot;
    return {
      shell: base,
      variants: pool.map((content, index) => ({
        ...shell,
        ...content,
        scenarioId: `level2.garage.${shell.id}.${index + 1}`,
      })),
    };
  });

export const stageContent = (levelId: number): StageContent | null => {
  const slots = SLOTS[levelId];
  const base = LEVELS.find(level => level.id === levelId);
  if (!slots || !base) return null;
  return {
    levelId,
    slots: slots.slots,
    distances: slots.distances,
    base,
    ...(levelId === 4 ? { assemble: assembleLevel4 } : {}),
    garage: levelId === 2 ? level2Points() : fixedPoints(levelId, 'garage', base.garage?.hotspots),
    aftermath: fixedPoints(levelId, 'aftermath', base.aftermath?.hotspots),
  };
};
