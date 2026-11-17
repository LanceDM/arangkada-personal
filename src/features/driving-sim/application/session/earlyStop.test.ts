import { describe, expect, it } from 'vitest';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { stageContent } from '@/features/driving-sim/domain/scenario/stageContent';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { driveScenario, type Driver } from './thetaDrives';

/** Brakes to rest well before the line - from 0.6 of the zone back - and stands there. */
const stopShort: Driver = ({ diff, zone }) => (diff >= -0.6 * zone ? { brake: true } : {});

/** The scenario alone: on its level's road as authored, else at its own slot on its stage's road. */
const alone = (levelId: number, id: string): { level: LevelConfig; event: ScenarioEvent } => {
  const authored = LEVELS.find(level => level.id === levelId)!;
  const own = authored.events.find(e => e.id === id);
  if (own) {
    const level = { ...authored, events: [own] };
    return { level, event: own };
  }
  const content = stageContent(levelId)!;
  const slot = content.slots.findIndex(pool => pool.some(variant => variant.id === id));
  const variant = content.slots[slot].find(v => v.id === id)!;
  const event: ScenarioEvent = { ...variant, triggerAtDistance: content.distances[slot] };
  const level = content.assemble ? content.assemble([event]) : { ...content.base, events: [event] };
  return { level, event: level.events.find(e => e.id === id)! };
};

describe('a full stop made a little early (ported from the groupmate repository)', () => {
  for (const id of ['level4.traverse.stop-line']) {
    it(`is the stop on ${id}`, () => {
      const { level, event } = alone(Number(id.match(/^level(\d+)/)![1]), id);
      expect(driveScenario(level, event, 1, stopShort).outcome).toBe('stop');
    }, 60_000);
  }
});
