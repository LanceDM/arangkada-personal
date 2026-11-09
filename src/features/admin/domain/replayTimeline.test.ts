import { describe, expect, it } from 'vitest';
import type { FSMState, FsmTelemetryDoc, TransitionLogEntry } from '@/features/driving-sim';
import { edgeCountsThrough, fsmReplay, visibleSteps } from './replayTimeline';

const entry = (from: FSMState, to: FSMState, trigger: string, timestamp: number, approachScale = 1): TransitionLogEntry => ({
  from,
  to,
  trigger,
  timestamp,
  snapshot: { gameplay: to, competency: 'pedestrians' },
  params: { approachScale, reactionScale: 1 },
});

/** A short drive: start, brake held, a scenario read and answered, brake held, come to rest. */
const LOG: TransitionLogEntry[] = [
  entry('IDLE', 'DRIVING', 'start', 1000),
  entry('DRIVING', 'DRIVING', 'brake', 1016),
  entry('DRIVING', 'DRIVING', 'brake', 1032),
  entry('DRIVING', 'DRIVING', 'brake', 1048),
  entry('DRIVING', 'APPROACHING_EVENT', 'scenario_trigger', 2000),
  entry('APPROACHING_EVENT', 'APPROACHING_EVENT', 'briefing_dismissed', 4000),
  entry('APPROACHING_EVENT', 'APPROACHING_EVENT', 'brake', 4016),
  entry('APPROACHING_EVENT', 'APPROACHING_EVENT', 'brake', 4032),
  entry('APPROACHING_EVENT', 'REACTION_WINDOW', 'scenario_trigger', 4500),
  entry('REACTION_WINDOW', 'HAZARD', 'obstacle_ahead', 4500),
  entry('HAZARD', 'HAZARD', 'answer_correct', 4600),
  entry('HAZARD', 'DRIVING', 'road_clear', 5000),
  entry('DRIVING', 'DRIVING', 'brake', 5016),
  entry('DRIVING', 'DRIVING', 'brake', 5032),
  entry('DRIVING', 'IDLE', 'vehicle_stopped', 5100),
];

const doc = (transitions: TransitionLogEntry[], over: Partial<FsmTelemetryDoc> = {}): FsmTelemetryDoc => ({
  transitions,
  truncated: false,
  totalCount: transitions.length,
  ...over,
});

describe('fsmReplay', () => {
  const replay = fsmReplay(doc(LOG));

  it('folds a run of one self-loop into a step with its count and its first and last time', () => {
    expect(replay.steps.map(step => [step.from, step.to, step.trigger, step.count])).toEqual([
      ['IDLE', 'DRIVING', 'start', 1],
      ['DRIVING', 'DRIVING', 'brake', 3],
      ['DRIVING', 'APPROACHING_EVENT', 'scenario_trigger', 1],
      ['APPROACHING_EVENT', 'APPROACHING_EVENT', 'briefing_dismissed', 1],
      ['APPROACHING_EVENT', 'APPROACHING_EVENT', 'brake', 2],
      ['APPROACHING_EVENT', 'REACTION_WINDOW', 'scenario_trigger', 1],
      ['REACTION_WINDOW', 'HAZARD', 'obstacle_ahead', 1],
      ['HAZARD', 'HAZARD', 'answer_correct', 1],
      ['HAZARD', 'DRIVING', 'road_clear', 1],
      ['DRIVING', 'DRIVING', 'brake', 2],
      ['DRIVING', 'IDLE', 'vehicle_stopped', 1],
    ]);
    expect(replay.steps[1]).toMatchObject({ index: 1, firstAt: 1016, lastAt: 1048, offsetMs: 16, dwellMs: 2000 - 1016 });
    expect(replay.steps.at(-1)).toMatchObject({ index: 14, offsetMs: 4100, dwellMs: null });
  });

  it('keeps a single self-loop that carries meaning as a step of its own, and marks only player input', () => {
    const inputs = replay.steps.filter(step => step.input).map(step => [step.from, step.trigger]);
    expect(inputs).toEqual([
      ['DRIVING', 'brake'],
      ['APPROACHING_EVENT', 'brake'],
      ['DRIVING', 'brake'],
    ]);
    expect(replay.steps.find(step => step.trigger === 'answer_correct')).toMatchObject({ selfLoop: true, input: false });
    expect(replay.steps.find(step => step.trigger === 'briefing_dismissed')).toMatchObject({ selfLoop: true, input: false });
  });

  it('counts every transition on its edge, and the states the machine changed into', () => {
    expect(replay.edgeCounts).toMatchObject({ 'DRIVING>DRIVING': 5, 'APPROACHING_EVENT>APPROACHING_EVENT': 3, 'IDLE>DRIVING': 1 });
    expect(Object.values(replay.edgeCounts).reduce((sum, count) => sum + count, 0)).toBe(LOG.length);
    expect(replay.visits).toEqual({ DRIVING: 2, APPROACHING_EVENT: 1, REACTION_WINDOW: 1, HAZARD: 1, IDLE: 1 });
    expect(replay.initial).toBe('IDLE');
    expect(replay).toMatchObject({ transitions: 15, totalCount: 15, truncated: false });
  });

  it('carries the competency and the θ of each step', () => {
    const scaled = fsmReplay(doc([entry('IDLE', 'DRIVING', 'start', 0, 1.5)]));
    expect(scaled.steps[0]).toMatchObject({ competency: 'pedestrians', approachScale: 1.5 });
  });

  it('says where a log was cut, and reads an empty one', () => {
    expect(fsmReplay(doc(LOG.slice(0, 4), { truncated: true, totalCount: 900 }))).toMatchObject({
      transitions: 4,
      totalCount: 900,
      truncated: true,
    });
    expect(fsmReplay(doc([]))).toMatchObject({ steps: [], initial: null, edgeCounts: {} });
  });
});

describe('visibleSteps and edgeCountsThrough', () => {
  const { steps } = fsmReplay(doc(LOG));

  it('hides the folded runs of player input, and nothing else', () => {
    const shown = visibleSteps(steps, true);
    expect(shown).toHaveLength(8);
    expect(shown.some(step => step.input)).toBe(false);
    expect(visibleSteps(steps, false)).toEqual(steps);
  });

  it('counts the path up to and including the selected step', () => {
    expect(edgeCountsThrough(steps, steps[4])).toEqual({
      'IDLE>DRIVING': 1,
      'DRIVING>DRIVING': 3,
      'DRIVING>APPROACHING_EVENT': 1,
      'APPROACHING_EVENT>APPROACHING_EVENT': 3,
    });
    expect(edgeCountsThrough(steps, null)).toEqual({});
  });
});
