// Dev-only. Flattens every real content variant already in the game into
// browsable lists, built entirely from existing exports (LEVELS,
// getPooledSlots, the level2 garage pools, getLevelModule) so nothing
// here is hand-duplicated from the scenario/curriculum data files. Feeds
// /dev/gallery and /dev/scenarios. Never imported by any production path.
import { LEVELS, getPooledSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { type GarageHotspot, type GarageStage, type LevelConfig, type ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { HOTSPOTS } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

/** Raw {shell, pool} per garage hotspot (level 2 only) - lets a caller swap one hotspot's exact variant while leaving the rest of the stage as normal. */
export const garageHotspotSlots = HOTSPOTS;

/** Level 2's own garage stage, one (first) variant per hotspot - a sane default to preview against. */
export const defaultGarage: GarageStage = LEVELS.find(level => level.id === 2)!.garage!;

/**
 * Levels whose road events are rolled from a pool instead of fixed in LEVELS -
 * derived from which levels actually expose pool slots (getPooledSlots)
 * rather than a hand-maintained list, so a level that becomes pooled later
 * (level 5 did, after this file was first written) is picked up automatically
 * instead of silently falling back to its single static roll in the dev tools.
 */
export const POOLED_LEVEL_IDS: number[] = LEVELS.map(level => level.id).filter(
  id => getPooledSlots(id) !== null
);

/**
 * Every road-event variant the game can ever show: every pool entry of the
 * pooled levels, plus the fixed events on every static level. A pool entry has
 * no triggerAtDistance of its own (it's assigned one only once placed in a
 * slot), so a placeholder is filled in - nothing here reads it, since the
 * gallery renders components directly rather than driving them.
 *
 * Once per id, as it was written: Level 12 borrows whole pools from earlier
 * levels and re-points them to its own scale, so only the variants a level
 * authored are taken from its pools, and a static roll's borrowed event is
 * dropped for the copy already listed.
 */
export const allScenarioEvents: ScenarioEvent[] = [
  ...POOLED_LEVEL_IDS.flatMap(levelId =>
    (getPooledSlots(levelId)?.slots.flat() ?? []).filter(variant => variant.id.startsWith(`level${levelId}.`))
  ).map((variant): ScenarioEvent => ({ ...variant, triggerAtDistance: 0 })),
  ...LEVELS.flatMap(level => level.events),
].filter((event, index, events) => events.findIndex(other => other.id === event.id) === index);

export const signEvents = allScenarioEvents.filter(event => event.sign);
export const markingEvents = allScenarioEvents.filter(event => event.marking);
export const inspectionEvents = allScenarioEvents.filter(event => event.inspection);
export const cutsceneEvents = allScenarioEvents.filter(event => event.cutscene || event.parkingCutscene);

/**
 * The frozen prompts that are a failure of the driver's own vehicle, which
 * `EmergencyDecision` draws rather than `RoadDecision`. A separate list
 * because the two prompts are siblings with different subjects: put a brake
 * failure through the right-of-way panel and the player is shown a give-way
 * line while their car runs away down a hill.
 */
export const emergencyEvents = allScenarioEvents.filter(event => event.emergency);

/** Every stage in the game, pre-drive or on foot, named by where it comes from. */
export const stages: Array<{ name: string; stage: GarageStage }> = LEVELS.flatMap(level => [
  ...(level.garage ? [{ name: `L${level.id} — pre-drive garage`, stage: level.garage }] : []),
  ...(level.aftermath ? [{ name: `L${level.id} — crash scene`, stage: level.aftermath }] : []),
]);
/** Every garage hotspot variant (level 2 only), one entry per pool option per hotspot. */
export const garageHotspots: GarageHotspot[] = HOTSPOTS.flatMap(({ shell, pool }) =>
  pool.map(content => ({ ...shell, ...content }))
);

/**
 * "level5.yellow-box.exit-clear" -> "Exit Clear": the variant slug (the last
 * dot-segment of the id) turned into a human phrase, used to tell apart two
 * variants that share a plate name.
 */
const humanizeVariant = (id: string): string => {
  const slug = id.split('.').pop() ?? id;
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * A short label for a dropdown/list entry - whichever field actually names this
 * variant.
 *
 * A plate name alone is not always unique: every yellow-box variant is a
 * "Yellow Box Junction" and every green-signal variant a "Traffic Signal,
 * Green", so a list keyed on the plate name showed several identical entries
 * for materially different situations. Where the name comes from a plate and
 * does not already spell out the variant, the humanized variant slug is
 * appended ("Yellow Box Junction — Exit Clear") so each entry is distinct and
 * says what it actually is. A description-named event is already unique, so it
 * is left alone.
 */
export const labelForEvent = (event: ScenarioEvent): string => {
  const plateName = event.sign?.name ?? event.marking?.name ?? event.inspection?.documentType;
  if (plateName) {
    const variant = humanizeVariant(event.id);
    // Skip the suffix when the plate name already leads with it (e.g. a "Stop
    // Sign (Octagon)" whose slug is "stop-sign"), so it never reads doubled.
    const redundant = plateName.toLowerCase().startsWith(variant.toLowerCase());
    return redundant ? `${event.id} — ${plateName}` : `${event.id} — ${plateName} — ${variant}`;
  }
  return `${event.id} — ${event.description}`;
};

export const levelConfigs: LevelConfig[] = LEVELS;

export const levelModules: LevelModule[] = LEVELS.map(level => getLevelModule(level.id));

/** One walk-around stage - a level's pre-drive `garage`, or its post-drive `aftermath`. */
export interface GarageStageInfo {
  key: string;
  label: string;
  stage: GarageStage;
}

/**
 * Every walk-around stage in the game, from every level that has one -
 * level 2's pre-drive garage, level 8/9/10's, and level 9's post-drive
 * aftermath scene alike. Built generically off LevelConfig.garage/.aftermath
 * rather than assuming only level 2 has one, so a level added later with its
 * own stage shows up here without this file needing to change.
 */
export const garageStages: GarageStageInfo[] = LEVELS.flatMap(level => {
  const entries: GarageStageInfo[] = [];
  if (level.garage) {
    entries.push({ key: `${level.id}-garage`, label: `Level ${level.id} — ${level.name} (Garage)`, stage: level.garage });
  }
  if (level.aftermath) {
    entries.push({ key: `${level.id}-aftermath`, label: `Level ${level.id} — ${level.name} (Aftermath)`, stage: level.aftermath });
  }
  return entries;
});
