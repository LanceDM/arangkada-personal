/**
 * One scenario, alone, ready to drive (Admin > Scenarios > Play, 2026-11-16):
 * for checking a scenario through the real game screen without driving a
 * whole level to reach it.
 *
 * A stage's scenario stands where a course drive would put it
 * (`composeSingleScenario`). The tutorial's road events, and the points of a
 * level's own garage or crash scene, are played on the level as authored,
 * narrowed to that one point. The drive starts just before the scenario is
 * announced; a garage check starts at the garage and ends just past it, a
 * crash-scene step starts near the end of the road, where the crash scene is.
 */
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { isCompetencyStage, STAGE_COMPETENCIES } from '@/domain/learner/stageCompetencies';
import { composeDrive, composeSingleScenario } from './composeDrive';
import { LEVELS } from './levelCatalog';
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';

export interface SingleScenarioDrive {
  level: LevelConfig;
  /** Road distance the car starts at. */
  initialDistance: number;
  where: 'road' | 'garage' | 'aftermath';
}

/** Road the car drives before the scenario's own announcement begins. */
const RUN_IN = 150;
/** How far before the road's end a crash-scene check starts. */
const AFTERMATH_RUN_IN = 300;
/**
 * The road after a garage check: a short pull out of the garage, then the end
 * (2026-11-16). The check is the garage point; the level's road after it, with
 * none of its scenarios on it, only made the admin drive an empty road to see
 * the result.
 */
const GARAGE_RUN_OUT = 400;

const garageOnly = (level: LevelConfig): SingleScenarioDrive => ({
  level: { ...level, events: [], roadLength: GARAGE_RUN_OUT },
  initialDistance: 0,
  where: 'garage',
});

const startBefore = (event: ScenarioEvent): number =>
  Math.max(0, event.triggerAtDistance - (event.warningDistance ?? WARNING_ZONE_ENTER) - RUN_IN);

export const singleScenarioDrive = (levelId: number, scenarioId: string): SingleScenarioDrive | null => {
  const composed = composeSingleScenario(levelId, scenarioId);
  if (composed) {
    const { level, placement } = composed;
    if (placement === 'garage') return garageOnly(level);
    if (placement === 'aftermath') return { level, initialDistance: Math.max(0, level.roadLength - AFTERMATH_RUN_IN), where: 'aftermath' };
    const event = level.events.find(e => e.id === scenarioId);
    return event ? { level, initialDistance: startBefore(event), where: 'road' } : null;
  }

  // The tutorial, and a level's own garage or crash-scene points, as authored.
  const authored = LEVELS.find(level => level.id === levelId);
  if (!authored) return null;
  const event = authored.events.find(e => e.id === scenarioId);
  if (event) return { level: authored, initialDistance: startBefore(event), where: 'road' };
  for (const scene of ['garage', 'aftermath'] as const) {
    const stage = authored[scene];
    const point = stage?.hotspots.find(h => (h.scenarioId ?? h.id) === scenarioId);
    if (stage && point) {
      const level: LevelConfig = { ...authored, [scene]: { ...stage, hotspots: [point] } };
      return scene === 'garage'
        ? garageOnly(level)
        : { level, initialDistance: Math.max(0, level.roadLength - AFTERMATH_RUN_IN), where: 'aftermath' };
    }
  }
  return null;
};

/** A small seeded generator, so one seed always composes the same drive. */
const seeded = (seed: number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * A whole course drive of a level, for checking how its scenarios follow one
 * another (Admin > Scenarios > Levels, 2026-11-16): composed the way a
 * learner's first drive of the stage is, every competency of the stage, drawn
 * from `seed`. The tutorial and the final mission are played as authored.
 */
export const wholeDriveForCheck = (levelId: number, seed: number): LevelConfig | null => {
  if (isCompetencyStage(levelId)) {
    return composeDrive({ levelId, competencies: STAGE_COMPETENCIES[levelId], rng: seeded(seed) }).level;
  }
  return LEVELS.find(level => level.id === levelId) ?? null;
};
