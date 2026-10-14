/**
 * Grading a scenario that forbids coming to rest.
 *
 * A car may not stand at a fire hydrant or beside a posted tow-away sign. The
 * scenario declares `avoid: ['stop']`, and only the stop may fail it: slowing
 * past the place, by brake or by coasting, is not standing in it. Before 3h a
 * stop read as `brake` wherever the answer was not `stop`, so a forbidden stop
 * compared against an action that could never occur, which is the defect
 * Level 4's `turn_left` and the horn each had.
 *
 * And only a stop where the rule reaches: within `noStandingWithin` meters of
 * the place, before it or past it, or alongside it where nothing says how far.
 * Until the first play-test the whole approach counted, which failed a stop eleven
 * meters short of a hydrant and passed a car standing level with it.
 */
import { describe, expect, it } from 'vitest';
import {
  createTelemetry,
  gradeEvent,
  isFailedEarly,
  noStandingStretch,
  recordFrame,
  type EventTelemetry,
} from './eventTelemetry';
import { evaluateWeightedRule } from './ruleEngine';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { CAR_LENGTH, UNITS_PER_METER } from '@/features/driving-sim/domain/world/routeGeometry';

/** An ordinary two-way city street. */
const level = {
  id: 6,
  speedLimit: 40,
  paint: { oncomingLanes: 2, base: 'broken_yellow', spans: [] },
} as unknown as LevelConfig;

const event = (extra: Partial<ScenarioEvent>): ScenarioEvent =>
  ({
    id: 'test.event',
    triggerAtDistance: 1000,
    type: 'scenario_trigger',
    description: '',
    correctAction: 'accelerate',
    points: 20,
    penaltyMessage: 'generic penalty',
    rewardMessage: 'generic reward',
    duration: 0,
    ...extra,
  }) as ScenarioEvent;

const noStanding = event({ avoid: ['stop'] });

/** One frame, where the car is: before the place or past it, and inside the stretch or not. */
const frame = (
  telemetry: EventTelemetry,
  speed: number,
  { past = false, within = false, braking = false } = {}
) => recordFrame(telemetry, speed, 3, past, false, false, braking, undefined, false, false, within);

/**
 * Drives a window: `approach` speeds frame by frame before the place, then on
 * past it at `after`. `within` says whether the approach frames were inside
 * the stretch the rule reaches.
 */
const drive = (approach: number[], { after = 30, braking = false, within = false } = {}) => {
  const telemetry = createTelemetry(approach[0] ?? after, 3);
  for (const speed of approach) frame(telemetry, speed, { within, braking });
  for (let at = 0; at < 10; at++) frame(telemetry, after, { past: true });
  return telemetry;
};

describe('where the rule reaches', () => {
  it('is the declared distance either side of the place, measured from the car', () => {
    const reach = 4 * UNITS_PER_METER;
    expect(noStandingStretch(event({ avoid: ['stop'], noStandingWithin: 4 }))).toEqual({
      from: -reach,
      to: CAR_LENGTH + reach,
    });
    // A car is 4.5 meters on the scale it is drawn at, so four meters is a
    // little short of one car length.
    expect(reach).toBeGreaterThan(CAR_LENGTH * 0.85);
    expect(reach).toBeLessThan(CAR_LENGTH);
  });

  it('is alongside the place where nothing says how far', () => {
    expect(noStandingStretch(noStanding)).toEqual({ from: 0, to: CAR_LENGTH });
  });

  it('is nowhere for a scenario that does not forbid the stop', () => {
    expect(noStandingStretch(event({}))).toBeNull();
    expect(noStandingStretch(event({ avoid: ['honk'], noStandingWithin: 4 }))).toBeNull();
  });
});

describe('a scenario that forbids coming to rest', () => {
  it('fails a car that came to rest where the rule reaches, and names it a stop', () => {
    const stopped = drive([30, 18, 6, 0, 0, 0, 8, 20], { braking: true, within: true });
    const { action } = gradeEvent(stopped, noStanding, level);
    expect(action).toBe('stop');
    expect(evaluateWeightedRule(noStanding, action, 0).isCorrect).toBe(false);
  });

  it('passes a car that came to rest further back, which the rule does not reach', () => {
    const stoppedShort = drive([30, 18, 6, 0, 0, 0, 8, 20], { braking: true, within: false });
    expect(stoppedShort.stoppedBeforeLine).toBe(true);
    const { action } = gradeEvent(stoppedShort, noStanding, level);
    expect(action).toBe('accelerate');
    expect(evaluateWeightedRule(noStanding, action, 0).isCorrect).toBe(true);
  });

  it('passes a car that drove past, at speed, braking hard, or coasting', () => {
    for (const telemetry of [
      drive([38, 38, 38, 38], { after: 38 }),
      drive([30, 20, 10, 4, 4, 8], { braking: true, after: 10 }),
      drive([30, 22, 14, 9, 9], { after: 9 }),
    ]) {
      const { action } = gradeEvent(telemetry, noStanding, level);
      expect(action).toBe('accelerate');
      expect(evaluateWeightedRule(noStanding, action, 0).isCorrect).toBe(true);
    }
  });

  it('settles the stop where it happened, and nothing else early', () => {
    const telemetry = createTelemetry(30, 3);
    for (const speed of [30, 15, 4]) {
      frame(telemetry, speed, { within: true, braking: true });
      expect(isFailedEarly(telemetry, noStanding)).toBe(false);
    }
    frame(telemetry, 0, { within: true, braking: true });
    expect(isFailedEarly(telemetry, noStanding)).toBe(true);

    // Further back, a stop is one the rule allows, and settles nothing.
    const short = createTelemetry(30, 3);
    for (const speed of [30, 15, 4, 0, 0]) frame(short, speed, { braking: true });
    expect(isFailedEarly(short, noStanding)).toBe(false);
  });

  it('reaches past the place: a car standing level with it, nose beyond, has stopped at it', () => {
    const levelWith = createTelemetry(30, 3);
    for (const speed of [30, 30]) frame(levelWith, speed);
    for (const speed of [30, 20, 10, 0, 0]) frame(levelWith, speed, { past: true, within: true, braking: true });
    expect(isFailedEarly(levelWith, noStanding)).toBe(true);
    expect(gradeEvent(levelWith, noStanding, level).action).toBe('stop');

    // Clear of it, a stop past the place fails nothing.
    const clear = createTelemetry(30, 3);
    for (const speed of [30, 30]) frame(clear, speed);
    for (const speed of [30, 20, 10, 0, 0]) frame(clear, speed, { past: true, braking: true });
    expect(isFailedEarly(clear, noStanding)).toBe(false);
    expect(gradeEvent(clear, noStanding, level).action).toBe('accelerate');
  });
});

describe('a scenario that does not forbid coming to rest', () => {
  it('reads a stop exactly as it did', () => {
    const stopped = drive([30, 10, 0, 0, 12], { braking: true });
    // A Give Way with nothing coming forbids the brake, and a stop is a brake.
    expect(gradeEvent(stopped, event({ avoid: ['brake'] }), level).action).toBe('brake');
    // A sign whose answer is the stop reads it as one.
    expect(gradeEvent(stopped, event({ correctAction: 'stop' }), level).action).toBe('stop');
    // Anything else: a full stop is a brake.
    expect(gradeEvent(stopped, event({ correctAction: 'brake' }), level).action).toBe('brake');
    expect(isFailedEarly(stopped, event({ avoid: ['brake'] }))).toBe(false);
  });
});
