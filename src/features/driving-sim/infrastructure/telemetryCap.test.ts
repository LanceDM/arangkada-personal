import { describe, it, expect } from 'vitest';
import { capDecisionsForFirestore, capRoutingForFirestore, capTransitionsForFirestore } from './telemetryCap';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import type { RoutingLogRecord, RoutingTelemetryDoc } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import type { TransitionLogEntry } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { DecisionRecord, DecisionTelemetryDoc } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';

const entry = (i: number): TransitionLogEntry => ({
  from: 'DRIVING',
  to: 'DRIVING',
  trigger: 'brake',
  timestamp: 1_730_000_000_000 + i,
  snapshot: { competency: 'lane_discipline', gameplay: 'DRIVING' },
  params: { approachScale: 1, reactionScale: 1 },
});

const log = (n: number): TransitionLogEntry[] => Array.from({ length: n }, (_, i) => entry(i));

describe('capTransitionsForFirestore', () => {
  it('keeps everything and flags no truncation when under budget', () => {
    const transitions = log(50);
    const result = capTransitionsForFirestore(transitions, 1_000_000);
    expect(result.truncated).toBe(false);
    expect(result.transitions).toHaveLength(50);
    expect(result.totalCount).toBe(50);
  });

  it('drops the tail and flags truncation when over budget, preserving the true count', () => {
    const transitions = log(1000);
    // A tiny budget forces truncation regardless of exact per-entry bytes.
    const result = capTransitionsForFirestore(transitions, 2_000);
    expect(result.truncated).toBe(true);
    expect(result.transitions.length).toBeLessThan(1000);
    expect(result.transitions.length).toBeGreaterThan(0);
    expect(result.totalCount).toBe(1000); // true pre-cap length survives
  });

  it('keeps the chronological prefix (the drive from its start)', () => {
    const transitions = log(1000);
    const result = capTransitionsForFirestore(transitions, 2_000);
    // The kept entries are the first ones, in order.
    expect(result.transitions[0].timestamp).toBe(transitions[0].timestamp);
    result.transitions.forEach((e, i) => expect(e.timestamp).toBe(transitions[i].timestamp));
  });

  it('never exceeds the byte budget it was given', () => {
    const transitions = log(2000);
    const budget = 10_000;
    const result = capTransitionsForFirestore(transitions, budget);
    const bytes = new TextEncoder().encode(JSON.stringify(result.transitions)).length;
    expect(bytes).toBeLessThanOrEqual(budget);
  });

  it('handles an empty log', () => {
    const result = capTransitionsForFirestore([]);
    expect(result).toEqual({ transitions: [], truncated: false, totalCount: 0 });
  });
});

describe('capDecisionsForFirestore', () => {
  const record = (i: number): DecisionRecord => ({
    logIndex: i,
    timestamp: 1_730_000_000_000 + i,
    scenarioId: `level4.slot.${i}`,
    kind: 'road',
    settlement: 'response',
    competency: 'lane_discipline',
    result: 'correct',
    points: 10,
    remediation: false,
    support: 'cue',
    theta: { requested: 1.5, effective: 1.25, baselineLead: 400, lead: 500, room: 500, floor: null },
    reaction: { ms: 900 },
    bktBefore: 0.3,
    bktAfter: 0.69,
  });

  const doc = (n: number): DecisionTelemetryDoc => ({
    schemaVersion: 1,
    levelId: 4,
    attemptSeed: 42,
    route: ['level4.a', 'level4.b'],
    bkt: { pInit: 0.3, pTransit: 0.1, pSlip: 0.1, pGuess: 0.2 },
    policy: {} as DecisionTelemetryDoc['policy'],
    rerolls: [{ afterDecision: 0, competency: 'lane_discipline' }],
    decisions: Array.from({ length: n }, (_, i) => record(i)),
    truncated: false,
    totalCount: n,
  });

  it('keeps a record that fits whole', () => {
    expect(capDecisionsForFirestore(doc(30))).toEqual(doc(30));
  });

  it('keeps the header whole and the decisions from the start, within budget, and says so', () => {
    const whole = doc(1000);
    const capped = capDecisionsForFirestore(whole, 10_000);
    const { decisions, truncated, totalCount } = capped;
    expect({ ...capped, decisions: [], truncated: false }).toEqual({ ...whole, decisions: [] });
    expect(truncated).toBe(true);
    expect(totalCount).toBe(1000);
    expect(decisions.length).toBeGreaterThan(0);
    decisions.forEach((d, i) => expect(d).toEqual(whole.decisions[i]));
    expect(new TextEncoder().encode(JSON.stringify(decisions)).length).toBeLessThanOrEqual(10_000);
  });
});

describe('capRoutingForFirestore', () => {
  const logged = (seq: number): RoutingLogRecord => ({
    seq,
    from: { kind: 'DRIVE', level: 3 },
    to: { kind: 'DRIVE', level: 4 },
    transition: { kind: 'advance', practice: null },
    outcome: 'passed',
    legal: ['advance', 'advance+practice(road_signs)'],
    at: 1_000,
  });
  const doc: RoutingTelemetryDoc = {
    schemaVersion: 1,
    mode: 'new',
    assignedGroup: 'optimized',
    groupInEffect: 'optimized',
    override: false,
    options: GAME_OPTIONS,
    driving: { support: 'full', approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
    entry: null,
    log: [logged(0)],
    truncated: false,
    totalCount: 1,
  };

  it('leaves an attempt\'s one or two log entries whole', () => {
    expect(capRoutingForFirestore(doc)).toEqual(doc);
  });

  it('keeps the chronological prefix of a log that does not fit, the header whole and the true count kept', () => {
    const long = { ...doc, log: Array.from({ length: 40 }, (_, i) => logged(i)), totalCount: 40 };
    const capped = capRoutingForFirestore(long, 2_000);
    expect(capped.log.length).toBeGreaterThan(0);
    expect(capped.log.length).toBeLessThan(40);
    expect(capped.log).toEqual(long.log.slice(0, capped.log.length));
    expect(capped).toMatchObject({ truncated: true, totalCount: 40, groupInEffect: 'optimized', driving: doc.driving });
  });
});
