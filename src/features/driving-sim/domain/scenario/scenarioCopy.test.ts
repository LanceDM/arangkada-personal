import { describe, expect, it } from 'vitest';
import { scenarioInstruction } from './scenarioCopy';
import type { ScenarioEvent } from './scenarioDefinition';

const stop = (over: Partial<ScenarioEvent>): ScenarioEvent =>
  ({ id: 'x.y', type: 'scenario_trigger', correctAction: 'stop', ...over }) as ScenarioEvent;

describe('what to do, where a level has not said', () => {
  it('names the line only where there is one', () => {
    expect(scenarioInstruction(stop({ type: 'red_light' }))).toBe('Come to a full stop before the line.');
    expect(scenarioInstruction(stop({ type: 'scenario_trigger' }))).toBe('Come to a full stop.');
    expect(scenarioInstruction(stop({ type: 'pedestrian_crossing', scenePrefab: { kind: 'driveway_crossing' } } as Partial<ScenarioEvent>))).toBe(
      'Come to a full stop.'
    );
  });

  it('tells a traffic stop to pull over, and a checkpoint to stop at it', () => {
    const inspection = { officerLine: '', documentType: '', holder: '', fields: [], vehicle: '', tripPurpose: '' };
    expect(scenarioInstruction(stop({ inspection: { ...inspection, pullOver: { missedMessage: '' } } } as Partial<ScenarioEvent>))).toBe(
      'Pull over to the extreme right and stop.'
    );
    expect(scenarioInstruction(stop({ type: 'stop_sign', inspection } as Partial<ScenarioEvent>))).toBe('Stop at the checkpoint.');
  });

  it('keeps what the level authored', () => {
    expect(scenarioInstruction(stop({ recommendedMove: 'Stop before the crossing.' }))).toBe('Stop before the crossing.');
  });
});

describe('a rockfall says to go round the rock (2026-11-16)', () => {
  it('rather than only to slow down, which runs into it', () => {
    const event = { id: 'level3.bend-warning.falling-rocks', correctAction: 'brake', scene: 'rockfall' } as never;
    expect(scenarioInstruction(event)).toBe('Slow right down and steer round the fallen rock.');
  });
});
