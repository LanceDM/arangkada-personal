/**
 * One scenario, alone, ready to drive (Admin > Scenarios > Play, 2026-11-16):
 * for checking a scenario through the real game screen without driving a
 * whole level to reach it.
 *
 * A stage's scenario stands where a course drive would put it
 * (`composeSingleScenario`). The tutorial's road events, and the points of a
 * level's own garage or crash scene, are played on the level as authored,
 * narrowed to that one point. The drive starts just before the scenario is
 * announced; a garage check starts at the garage, a crash-scene step near the
 * end of the road, where the crash scene is.
 */
import { WARNING_ZONE_ENTER } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { composeSingleScenario } from './composeDrive';
import { hotspotScenarioId } from './hotspotScenarioId';
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

const startBefore = (event: ScenarioEvent): number =>
  Math.max(0, event.triggerAtDistance - (event.warningDistance ?? WARNING_ZONE_ENTER) - RUN_IN);

export const singleScenarioDrive = (levelId: number, scenarioId: string): SingleScenarioDrive | null => {
  const composed = composeSingleScenario(levelId, scenarioId);
  if (composed) {
    const { level, placement } = composed;
    if (placement === 'garage') return { level, initialDistance: 0, where: 'garage' };
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
    const point = stage?.hotspots.find(h => hotspotScenarioId(h) === scenarioId);
    if (stage && point) {
      const level: LevelConfig = { ...authored, [scene]: { ...stage, hotspots: [point] } };
      return scene === 'garage'
        ? { level, initialDistance: 0, where: 'garage' }
        : { level, initialDistance: Math.max(0, level.roadLength - AFTERMATH_RUN_IN), where: 'aftermath' };
    }
  }
  return null;
};
