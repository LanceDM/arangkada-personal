/**
 * The speed a scenario is graded on: the 20 km/h "slow down" of
 * RA 4136 §35(b) row 4 on a §35 road, 60% on the expressway, a posted minimum
 * at its figure, the number the prompt names, and the correction that quotes it.
 */
import { describe, expect, it } from 'vitest';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import {
  deriveAction,
  gradeEvent,
  createTelemetry,
  limitInForce,
  slowTarget,
  speedTarget,
} from './eventTelemetry';

const street = { id: 5, roadClass: 'city_street', speedLimit: 30 } as LevelConfig;
const expressway = { id: 7, roadClass: 'expressway', speedLimit: 100 } as LevelConfig;

const hazard: ScenarioEvent = {
  id: 'test.hazard',
  type: 'obstacle_ahead',
  triggerAtDistance: 900,
  description: 'Children by the road.',
  correctAction: 'brake',
  points: 20,
  penaltyMessage: 'You reached them at speed.',
  rewardMessage: 'Correct.',
  duration: 200,
  competency: 'hazard_awareness',
  severity: 'major',
};

const posted = (rule: 'maximum' | 'minimum', speed: number): ScenarioEvent => ({
  ...hazard,
  id: `test.${rule}-${speed}`,
  type: 'speed_limit',
  speedRule: rule,
  postedSpeed: speed,
  correctAction: rule === 'minimum' ? 'accelerate' : 'brake',
});

const passedAt = (speed: number) => ({ ...createTelemetry(speed, 2), speedAtSign: speed });

describe('slowTarget', () => {
  it('is 20 km/h on a §35 road, or a lower posting', () => {
    expect(slowTarget(hazard, street)).toBe(20);
    expect(slowTarget({ ...hazard, postedSpeed: 15 }, street)).toBe(15);
  });

  it('is 60% of the speed that applies on the expressway', () => {
    expect(slowTarget(hazard, expressway)).toBe(60);
    expect(slowTarget({ ...hazard, postedSpeed: 40 }, expressway)).toBe(24);
  });

  it('decides slowing at the sign', () => {
    expect(deriveAction(passedAt(20), hazard, street)).toBe('slow');
    expect(deriveAction(passedAt(25), hazard, street)).toBe('accelerate');
  });
});

describe('a posted minimum', () => {
  it('is met at its figure, not a share of it', () => {
    const minimum = posted('minimum', 40);
    expect(deriveAction(passedAt(40), minimum, street)).toBe('accelerate');
    expect(deriveAction(passedAt(35), minimum, street)).toBe('brake');
  });
});

describe('speedTarget and the prompt', () => {
  it('names what each kind is graded on', () => {
    expect(speedTarget(hazard, street)).toEqual({ at: 'most', speed: 20 });
    expect(speedTarget(posted('maximum', 20), street)).toEqual({ at: 'most', speed: 20 });
    expect(speedTarget(posted('minimum', 40), street)).toEqual({ at: 'least', speed: 40 });
    expect(speedTarget({ ...hazard, correctAction: 'stop' }, street)).toBeNull();
    expect(speedTarget({ ...hazard, correctAction: 'turn_left', maneuver: { direction: 'left', lane: 'inner' } } as ScenarioEvent, street)).toBeNull();
  });

  it('is named on the instruction at full support only', () => {
    expect(scenarioSupport(hazard, 'full', street).instruction).toMatch(/Target: 20 km\/h or less\.$/);
    expect(scenarioSupport(hazard, 'cue', street).instruction).toBeNull();
    expect(scenarioSupport(hazard, 'full').instruction).not.toMatch(/Target/);
  });
});

describe('the correction after a speed mistake', () => {
  it('quotes the speed reached against the target', () => {
    const grade = gradeEvent(passedAt(28), hazard, street);
    expect(grade.penaltyMessage).toBe('You reached them at speed. You passed at 28 km/h; the target was 20 km/h or less.');
  });

  it('says nothing extra when the speed was right', () => {
    expect(gradeEvent(passedAt(20), hazard, street).penaltyMessage).toBeUndefined();
  });

  it('quotes a minimum the other way round', () => {
    const grade = gradeEvent(passedAt(30), posted('minimum', 40), street);
    expect(grade.penaltyMessage).toMatch(/You passed at 30 km\/h; the target was 40 km\/h or more\.$/);
  });
});

describe('limitInForce', () => {
  it('is a posted maximum in its zone, else the road’s', () => {
    expect(limitInForce(null, street)).toBe(30);
    expect(limitInForce(posted('maximum', 20), street)).toBe(20);
    expect(limitInForce(posted('minimum', 40), street)).toBe(30);
    expect(limitInForce(hazard, street)).toBe(30);
  });
});
