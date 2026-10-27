/**
 * Grading a scenario that forbids the brake.
 *
 * Six Level 5 variants declare `avoid: ['brake']`: a Give Way or a green with
 * nothing coming, an emergency vehicle behind you at a junction, a yellow box
 * with its exit clear or already entered, a van waiting at a driveway. Each
 * says, in its text and its comment, that the failure is coming to rest:
 * "Only actually coming to rest fails." Five of them are borrowed by the final
 * exam's right-of-way slot.
 *
 * `deriveAction` names a braked slow-down to 60% of the limit `brake`, which
 * the prohibition then failed with text about stopping dead. On Level 12 that
 * is any braked arrival at 36 km/h or less on its 60 km/h road. A driver who
 * eases off to look is doing what these signs ask, so only the stop fails.
 */
import { describe, expect, it } from 'vitest';
import { createTelemetry, gradeEvent, recordFrame } from './eventTelemetry';
import { evaluateWeightedRule } from './ruleEngine';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { level5, SLOTS as LEVEL5_SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import { level12, SLOTS as LEVEL12_SLOTS } from '@/features/driving-sim/domain/scenario/content/levels/level12';

const forbidsBrake = (event: { avoid?: readonly string[] }) => event.avoid?.includes('brake') ?? false;

const LEVEL5_ITEMS = LEVEL5_SLOTS.flat().filter(forbidsBrake) as unknown as ScenarioEvent[];
const LEVEL12_ITEMS = LEVEL12_SLOTS.flat().filter(forbidsBrake) as unknown as ScenarioEvent[];

/**
 * Drives a window frame by frame: the approach at `approach` speeds, then on
 * past the point at `after`. `braking` holds the brake through the approach.
 */
const drive = (approach: number[], { after = approach.at(-1) ?? 0, braking = false } = {}) => {
  const telemetry = createTelemetry(approach[0] ?? after, 2);
  for (const speed of approach) recordFrame(telemetry, speed, 2, false, false, false, braking);
  for (let frame = 0; frame < 10; frame++) recordFrame(telemetry, after, 2, true, false, false, false);
  return telemetry;
};

const verdict = (telemetry: ReturnType<typeof drive>, event: ScenarioEvent, level: LevelConfig) => {
  const { action } = gradeEvent(telemetry, event, level);
  return { action, correct: evaluateWeightedRule(event, action, 0).isCorrect };
};

describe('the content this holds', () => {
  // The yellow-box variants moved to lane_discipline (catalogue review
  // 2026-10-28), so the final exam's right-of-way slot borrows three of them.
  it('is the six Level 5 variants, three of them borrowed by the final exam', () => {
    expect(LEVEL5_ITEMS).toHaveLength(6);
    expect(LEVEL12_ITEMS).toHaveLength(3);
    for (const event of [...LEVEL5_ITEMS, ...LEVEL12_ITEMS]) expect(event.correctAction).toBe('accelerate');
  });
});

describe.each([
  { name: 'Level 5', level: level5, items: LEVEL5_ITEMS },
  { name: 'Level 12', level: level12, items: LEVEL12_ITEMS },
])('a brake prohibition on $name', ({ level, items }) => {
  const slowed = Math.floor(level.speedLimit * 0.6) - 3;

  it.each(items.map(event => [event.id, event] as const))('%s passes a braked slow-down', (_id, event) => {
    const braked = drive([level.speedLimit, slowed + 10, slowed], { braking: true });
    expect(verdict(braked, event, level).correct).toBe(true);
  });

  it.each(items.map(event => [event.id, event] as const))('%s passes a coast', (_id, event) => {
    const coasted = drive([level.speedLimit, slowed + 10, slowed]);
    expect(verdict(coasted, event, level).correct).toBe(true);
  });

  it.each(items.map(event => [event.id, event] as const))('%s fails coming to rest before the point', (_id, event) => {
    const stopped = drive([level.speedLimit, 10, 0, 0], { after: 12, braking: true });
    expect(verdict(stopped, event, level)).toEqual({ action: 'brake', correct: false });
  });

  it.each(items.map(event => [event.id, event] as const))('%s passes holding the road speed', (_id, event) => {
    const held = drive([level.speedLimit, level.speedLimit]);
    expect(verdict(held, event, level).correct).toBe(true);
  });
});
