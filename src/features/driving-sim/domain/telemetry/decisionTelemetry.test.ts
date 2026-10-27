/**
 * An attempt's decisions can be reconstructed from storage alone.
 *
 * The level entry and a run
 * are recorded exactly as the game records them, the document is put through
 * JSON - what Firestore and any export will hold - and everything is then read
 * back from it without the history it was made over: the Q-state and the
 * action, the table the action came from, h and theta as asked and as each
 * scenario got it, and the BKT estimate either side of every decision.
 */
import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { buildBKTProfile, updateMastery } from '@/domain/learner/mastery/buildBKTProfile';
import { POLICY_TABLE_ID, WINDOW_SCALE, lookupPolicy } from '@/domain/learner/adaptive/qLearningPolicy';
import { approachLead, approachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import {
  decidePractice,
  levelSupport,
  practiceFor,
  type PracticeChoice,
} from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { attemptStream } from '@/features/driving-sim/domain/scenario/attemptSeed';
import { buildLevelConfig, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import {
  DECISION_TELEMETRY_SCHEMA_VERSION,
  buildDecisionTelemetry,
  readDecisionTelemetry,
  recordPolicyDecision,
  type DecisionTelemetryDoc,
  type DecisionTrace,
} from './decisionTelemetry';

const SEED = 0x5eed1e;

const graded = (
  competency: DrivingCompetency,
  result: 'correct' | 'violation',
  timestamp: number,
  extra: Partial<ActionLog> = {}
): ActionLog => ({
  timestamp,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency,
  ...extra,
});

/** Sound everywhere but road signs, which have been failed twice. */
const history: ActionLog[] = [
  ...COMPETENCIES.filter(c => c !== 'road_signs').flatMap((c, i) => [
    graded(c, 'correct', 1_000 + i * 2),
    graded(c, 'correct', 1_001 + i * 2),
  ]),
  graded('road_signs', 'violation', 5_000),
  graded('road_signs', 'violation', 5_001, { reactionCensored: true }),
];

const LEVEL_ID = 8;

/**
 * The level entry, decided the way `buildAdaptivePlan` decides it: the route
 * is rolled first, and the practice item is picked against what it rolled.
 */
const enter = () => {
  const decision = decidePractice(history);
  const rolled = buildLevelConfig(LEVEL_ID, undefined, decision?.weakest ?? null, attemptStream(SEED, 'roll'))!;
  const practice = practiceFor(
    decision,
    LEVEL_ID,
    attemptStream(SEED, 'practice'),
    new Set(rolled.events.map(e => e.id))
  );
  const support = levelSupport(LEVEL_ID, practice);
  const policy = recordPolicyDecision({ history, decision, practice, adapts: true, support });
  const level = withRemediation(rolled, practice!.variant);
  return { decision, practice: practice as PracticeChoice, support, policy, level, rolled };
};

/** A run: a garage answer, road decisions at the chosen theta, a standing penalty. */
const run = (practice: PracticeChoice) => {
  const theta = practice.transitionParams.approachScale;
  const widenedIntoRoom = approachTrace({ warningDistance: 400, approachRoom: 470, approachFloor: 180 }, { approachScale: theta });
  const neverNarrowed = approachTrace(
    { warningDistance: 300, approachRoom: Number.POSITIVE_INFINITY, approachFloor: Number.POSITIVE_INFINITY },
    { approachScale: theta }
  );
  const logs: ActionLog[] = [
    graded('driver_legality', 'correct', 9_000),
    graded('road_signs', 'correct', 9_100, { support: practice.support, reactionTime: 1_250 }),
    graded('road_signs', 'violation', 9_200, { support: practice.support, reactionCensored: true, remediation: true, sourceLevelId: practice.sourceLevelId }),
    graded('speed_control', 'violation', 9_300),
    graded('lane_discipline', 'correct', 9_400, { support: practice.support }),
  ];
  const traces: DecisionTrace[] = [
    { scenarioId: 'level8.garage.brakes', kind: 'garage', settlement: null, approach: null },
    { scenarioId: 'level8.stop-sign', kind: 'road', settlement: 'response', approach: widenedIntoRoom },
    { scenarioId: practice.variant.id, kind: 'road', settlement: 'expired', approach: neverNarrowed },
    { scenarioId: 'engine.crawl-penalty', kind: 'penalty', settlement: null, approach: null },
    { scenarioId: 'level8.lane-hold', kind: 'road', settlement: 'response', approach: widenedIntoRoom },
  ];
  return { logs, traces };
};

/** What a store hands back: JSON in, JSON out. */
const stored = (doc: DecisionTelemetryDoc): unknown => JSON.parse(JSON.stringify(doc));

/** Every leaf a store could refuse or change: undefined, a non-finite number. */
const unsafeLeaves = (value: unknown, path = '$'): string[] => {
  if (value === undefined) return [path];
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [path];
  if (Array.isArray(value)) return value.flatMap((item, i) => unsafeLeaves(item, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => unsafeLeaves(item, `${path}.${key}`));
  }
  return [];
};

describe('an attempt, recorded and read back', () => {
  const { decision, practice, support, policy, level, rolled } = enter();
  const { logs, traces } = run(practice);
  const rerolls = [{ afterDecision: 1, competency: 'road_signs' as const }];
  const doc = buildDecisionTelemetry({
    entry: { levelId: LEVEL_ID, attemptSeed: SEED, route: level.events.map(e => e.id), policy },
    logs,
    traces,
    rerolls,
  });
  const read = readDecisionTelemetry(stored(doc))!;

  it('survives storage unchanged: nothing undefined and nothing infinite', () => {
    expect(unsafeLeaves(doc)).toEqual([]);
    expect(read).toEqual(doc);
    expect(read.schemaVersion).toBe(DECISION_TELEMETRY_SCHEMA_VERSION);
  });

  it('carries the level entry the policy actually decided', () => {
    expect(decision).not.toBeNull();
    expect(read.policy.source).toBe('policy');
    expect(read.policy.qState).toBe(decision!.state);
    expect(read.policy.weakest).toBe('road_signs');
    expect(read.policy.entryMastery).toEqual(buildBKTProfile(history));
    expect(read.policy.practiceScenarioId).toBe(practice.variant.id);
    // The named scenario was really added, and added once: the route ends with
    // it and is one scenario longer than the roll it was appended to. A record
    // that merely *contains* the id cannot tell an injected item from one the
    // level was already asking.
    expect(read.route.at(-1)).toBe(practice.variant.id);
    expect(read.route.filter(id => id === practice.variant.id)).toHaveLength(1);
    expect(read.route).toHaveLength(rolled.events.length + 1);
  });

  it('repeats the lookup from the stored state, in the table it names', () => {
    expect(read.policy.policyTableId).toBe(POLICY_TABLE_ID);
    const again = lookupPolicy(read.policy.qState!);
    expect(again.action).toEqual(read.policy.action);
    expect(again.tableKey).toBe(read.policy.tableKey);
  });

  it('says what h and theta were asked for, and what the level was played at', () => {
    const action = read.policy.action!;
    expect(read.policy.requested).toEqual({ support: action.support, approachScale: WINDOW_SCALE[action.window] });
    expect(read.policy.applied).toEqual({ support, approachScale: practice.transitionParams.approachScale });
    for (const [i, record] of read.decisions.entries()) {
      expect(record.support, `decision ${i}`).toBe(logs[i].support ?? null);
    }
  });

  it('gives each scenario the theta it got, and recomputes it from what was stored', () => {
    for (const record of read.decisions) {
      if (!record.theta) continue;
      const { requested, effective, baselineLead, lead, room, floor } = record.theta;
      // Null is a limit that did not bind: an unbounded room, a floor never narrowed.
      const recomputed = approachLead(
        {
          warningDistance: baselineLead,
          approachRoom: room ?? Number.POSITIVE_INFINITY,
          approachFloor: floor ?? Number.POSITIVE_INFINITY,
        },
        { approachScale: requested }
      );
      expect(lead).toBe(recomputed);
      expect(effective).toBeCloseTo(lead / baselineLead, 12);
    }
    expect(read.decisions.filter(record => record.theta).length).toBe(3);
    expect(read.decisions[0].theta).toBeNull();
    expect(read.decisions[3].theta).toBeNull();
  });

  it('replays BKT from the level entry to what the next entry will read', () => {
    const mastery = { ...read.policy.entryMastery };
    for (const record of read.decisions) {
      if (!record.competency) continue;
      expect(record.bktBefore).toBe(mastery[record.competency]);
      mastery[record.competency] = updateMastery(mastery[record.competency], record.result === 'correct', read.bkt);
      expect(record.bktAfter).toBe(mastery[record.competency]);
    }
    expect(mastery).toEqual(buildBKTProfile([...history, ...logs]));
  });

  it('joins each record to its log entry, and keeps what the entry does not carry', () => {
    expect(read.totalCount).toBe(logs.length);
    for (const [i, record] of read.decisions.entries()) {
      expect(record.logIndex).toBe(i);
      expect(record.timestamp).toBe(logs[i].timestamp);
      expect(record.result).toBe(logs[i].result);
      expect(record.scenarioId).toBe(traces[i].scenarioId);
      expect(record.kind).toBe(traces[i].kind);
      expect(record.settlement).toBe(traces[i].settlement);
    }
    expect(read.decisions[1].reaction).toEqual({ ms: 1_250 });
    expect(read.decisions[2].reaction).toEqual({ censored: true });
    expect(read.decisions[2].remediation).toBe(true);
    expect(read.rerolls).toEqual(rerolls);
  });

  it('reproduces what was decided before the drive from the stored seed', () => {
    const again = enter();
    expect(again.policy.practiceScenarioId).toBe(read.policy.practiceScenarioId);
    const reRolled = buildLevelConfig(
      read.levelId,
      undefined,
      read.policy.weakest,
      attemptStream(read.attemptSeed, 'roll'),
      again.practice.variant
    )!;
    expect(reRolled.events.map(e => e.id)).toEqual(read.route);
  });
});

describe('a pooled level rolled from the attempt seed', () => {
  it('rolls the same route for the same seed, and not always for another', () => {
    const roll = (seed: number) =>
      buildLevelConfig(1, undefined, null, attemptStream(seed, 'roll'))!.events.map(e => e.id).join(',');
    expect(roll(SEED)).toBe(roll(SEED));
    const rolls = new Set(Array.from({ length: 20 }, (_, i) => roll(SEED + i)));
    expect(rolls.size).toBeGreaterThan(1);
  });
});

describe('why a level was not adapted', () => {
  const base = { practice: null, support: 'full' as const };

  it('names each case', () => {
    expect(recordPolicyDecision({ ...base, history: [], decision: null, adapts: true }).source).toBe('no-history');
    const mastered = COMPETENCIES.flatMap(c => [1, 2, 3, 4].map(n => graded(c, 'correct', n)));
    expect(decidePractice(mastered)).toBeNull();
    expect(recordPolicyDecision({ ...base, history: mastered, decision: null, adapts: true }).source).toBe('mastered');
    expect(
      recordPolicyDecision({ ...base, history, decision: decidePractice(history), adapts: true }).source
    ).toBe('no-portable-content');
    expect(recordPolicyDecision({ history, decision: null, practice: null, adapts: false, support: 'none' }).source).toBe(
      'final-exam'
    );
  });

  it('still records the decision the policy made when nothing portable was found', () => {
    const decision = decidePractice(history)!;
    const record = recordPolicyDecision({ ...base, history, decision, adapts: true });
    expect(record.qState).toBe(decision.state);
    expect(record.action).toEqual(decision.lookup.action);
    // What was played is the baseline machine, whatever was asked for.
    expect(record.applied).toEqual({ support: 'full', approachScale: 1 });
  });
});

describe('reading a stored document', () => {
  it('reads nothing for an attempt saved before the record existed, or a schema this code does not know', () => {
    expect(readDecisionTelemetry(undefined)).toBeNull();
    expect(readDecisionTelemetry(null)).toBeNull();
    expect(readDecisionTelemetry({ transitions: [] })).toBeNull();
    expect(readDecisionTelemetry({ schemaVersion: 2 })).toBeNull();
  });
});
