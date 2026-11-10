/**
 * Everything in the game that carries a translation: each scenario a
 * roll can reach, pooled variants included, each stage's hotspots, each lesson,
 * and each level's and module's heading, by the key its Filipino is filed under.
 * Practice items and Level 12's borrowed scenarios keep their ids, so each
 * appears here under the level that owns it.
 */
import { LEVEL_MODULE_DATA } from './content/lessons/lessonCatalog';
import type { LevelModule } from './lessonModule';
import { getPooledSlots, getRerollableSlots, LEVELS } from './levelCatalog';
import type { ScenarioEvent } from './scenarioDefinition';
import {
  HOTSPOT_TEXT_PATHS,
  hotspotKey,
  LESSON_TEXT_PATHS,
  LEVEL_TEXT_PATHS,
  levelKey,
  MODULE_TEXT_PATHS,
  SCENARIO_TEXT_PATHS,
  scenarioOwner,
} from './scenarioTexts';

export interface RosterEntry {
  key: string;
  levelId: number;
  owner: object;
  paths: readonly string[];
}

export const scenarioRoster = (): RosterEntry[] => {
  const rows: RosterEntry[] = [];
  for (const level of LEVELS) {
    // The heading alone: a level's events and a module's lessons are rows of their own.
    rows.push({
      key: levelKey(level.id),
      levelId: level.id,
      owner: { name: level.name, description: level.description },
      paths: LEVEL_TEXT_PATHS,
    });
    const add = (event: { id: string }) =>
      rows.push({ key: event.id, levelId: level.id, owner: scenarioOwner(event), paths: SCENARIO_TEXT_PATHS });
    (level.events as ScenarioEvent[]).forEach(add);
    for (const pools of [getRerollableSlots(level.id), getPooledSlots(level.id)]) {
      pools?.slots.forEach(slot => slot.forEach(add));
    }
    for (const stage of ['garage', 'aftermath'] as const) {
      level[stage]?.hotspots.forEach(hotspot =>
        rows.push({ key: hotspotKey(level.id, stage, hotspot), levelId: level.id, owner: hotspot, paths: HOTSPOT_TEXT_PATHS })
      );
    }
  }
  for (const module of LEVEL_MODULE_DATA as LevelModule[]) {
    const levelId = module.sourceLevel ?? -1;
    rows.push({ key: module.id, levelId, owner: { title: module.title, desc: module.desc }, paths: MODULE_TEXT_PATHS });
    for (const lesson of module.lessons) rows.push({ key: lesson.id, levelId, owner: lesson, paths: LESSON_TEXT_PATHS });
  }
  return rows;
};
