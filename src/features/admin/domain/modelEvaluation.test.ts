import { describe, expect, it } from 'vitest';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import type { CourseLogRow } from './adminReport';
import {
  auc,
  calibration,
  clusterBootstrap,
  evaluateBkt,
  evaluateConvergence,
  evaluateCoursePolicy,
  predictionsFrom,
  predictiveMetrics,
  spread,
} from './modelEvaluation';

const entry = (uid: string, predictedCorrect: number, correct: boolean, over: Record<string, unknown> = {}) => ({
  uid, competency: 'driver_legality', source: 'quiz', predictedCorrect, correct, userSeq: 1, ...over,
});

describe('BKT predictive metrics', () => {
  it('reads AUC as the chance a right answer was ranked above a wrong one, ties counting half', () => {
    expect(auc([{ predicted: 0.9, correct: true }, { predicted: 0.2, correct: false }])).toBe(1);
    expect(auc([{ predicted: 0.2, correct: true }, { predicted: 0.9, correct: false }])).toBe(0);
    expect(auc([{ predicted: 0.5, correct: true }, { predicted: 0.5, correct: false }])).toBe(0.5);
    // Right at 0.8 and 0.4, wrong at 0.6 and 0.2: 3 of the 4 pairs are in order.
    expect(
      auc([
        { predicted: 0.8, correct: true }, { predicted: 0.4, correct: true },
        { predicted: 0.6, correct: false }, { predicted: 0.2, correct: false },
      ])
    ).toBe(0.75);
    expect(auc([{ predicted: 0.9, correct: true }])).toBeNull();
  });

  it('computes RMSE, accuracy and their baselines', () => {
    const m = predictiveMetrics([
      { predicted: 0.8, correct: true }, { predicted: 0.6, correct: true },
      { predicted: 0.6, correct: false }, { predicted: 0.2, correct: false },
    ])!;
    expect(m.n).toBe(4);
    expect(m.observedRate).toBe(0.5);
    expect(m.meanPredicted).toBeCloseTo(0.55);
    expect(m.accuracy).toBe(0.75);
    expect(m.baselineAccuracy).toBe(0.5);
    expect(m.rmse).toBeCloseTo(Math.sqrt((0.04 + 0.16 + 0.36 + 0.04) / 4));
    expect(m.baselineRmse).toBe(0.5);
    expect(predictiveMetrics([])).toBeNull();
  });

  it('leaves malformed log entries out and counts them', () => {
    const { predictions, skipped } = predictionsFrom([
      entry('u1', 0.7, true),
      entry('u1', 1.4, true),
      { uid: 'u1', competency: 'driver_legality', source: 'quiz', correct: true },
      entry('u1', 0.3, false, { source: 'homework' }),
    ]);
    expect(predictions).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('reports the pooled figure and the per-player average, which can differ', () => {
    // u1 has many answers and is predicted well; u2 has few and is predicted badly.
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => entry('u1', i < 4 ? 0.9 : 0.1, i < 4)),
      entry('u2', 0.2, true),
      entry('u2', 0.8, false),
    ];
    const result = evaluateBkt(rows, uid => uid.toUpperCase(), 200);
    expect(result.players.map(p => p.label)).toEqual(['U1', 'U2']);
    expect(result.players[0].auc).toBe(1);
    expect(result.players[1].auc).toBe(0);
    expect(result.perPlayer.auc).toEqual({ n: 2, mean: 0.5, sd: Math.SQRT1_2 });
    // Pooled, u1's eight answers dominate.
    expect(result.pooled!.auc!).toBeGreaterThan(0.5);
    expect(result.pooled!.n).toBe(10);
    const [low, high] = result.pooledInterval.auc!;
    expect(low).toBeLessThanOrEqual(result.pooled!.auc!);
    expect(high).toBeGreaterThanOrEqual(result.pooled!.auc!);
    expect(result.byCompetency.find(c => c.competency === 'driver_legality')!.players).toBe(2);
    expect(result.bySource.find(s => s.source === 'quiz')!.metrics!.n).toBe(10);
    expect(result.bySource.find(s => s.source === 'drive')!.metrics).toBeNull();
  });

  it('gives the same interval for the same data, and none for one player', () => {
    const rows = [entry('u1', 0.9, true), entry('u1', 0.3, false), entry('u2', 0.6, true), entry('u2', 0.7, false), entry('u3', 0.8, true)];
    expect(evaluateBkt(rows, undefined, 100).pooledInterval).toEqual(evaluateBkt(rows, undefined, 100).pooledInterval);
    expect(evaluateBkt([entry('u1', 0.9, true), entry('u1', 0.3, false)], undefined, 100).pooledInterval.rmse).toBeNull();
    expect(clusterBootstrap([[1], [1], [1]], xs => xs.reduce((a, b) => a + b, 0) / xs.length, 50)).toEqual([1, 1]);
  });

  it('bins predictions for calibration', () => {
    const { predictions } = predictionsFrom([entry('u1', 0.95, true), entry('u1', 0.91, false), entry('u1', 1, true), entry('u1', 0.05, false)]);
    const result = calibration(predictions);
    expect(result.bins).toHaveLength(10);
    expect(result.bins[9].n).toBe(3);
    expect(result.bins[9].observedRate).toBeCloseTo(2 / 3);
    expect(result.bins[0].observedRate).toBe(0);
    expect(result.bins[4].meanPredicted).toBeNull();
    expect(result.ece).toBeCloseTo(0.75 * Math.abs(2.86 / 3 - 2 / 3) + 0.25 * 0.05);
  });

  it('averages with a sample standard deviation', () => {
    expect(spread([1, 3, null])).toEqual({ n: 2, mean: 2, sd: Math.SQRT2 });
    expect(spread([0.4])).toEqual({ n: 1, mean: 0.4, sd: null });
    expect(spread([null])).toBeNull();
  });
});

const decision = (over: Partial<DecisionRecord>): DecisionRecord => ({
  seq: 1, levelId: 1, phase: 'DRIVE(1)', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, masteryP: 0.6,
  legal: ['practice', 'review'], action: 'practice', source: 'explore_1', probability: 0.5, probabilities: { practice: 0.5, review: 0.5 },
  leader: null, selection: 'explore', draw: 0.2, snapshot: {} as DecisionRecord['snapshot'], timestamp: 1000, ...over,
});

const reward = (over: Partial<RewardRecord>): RewardRecord => ({
  decisionId: '1:driver_legality:1', competency: 'driver_legality', state: { mastery: 2, result: 'failed' }, action: 'practice',
  reward: 1.44, accuracy: 1, passed: true, addedDecisions: 3, next: { mastery: 3, result: 'passed' }, measuredBy: 'drive', timestamp: 2000, ...over,
});

const row = (over: Partial<CourseLogRow>): CourseLogRow => ({
  userId: 'u1', kind: 'drive', levelId: 1, phase: 'DRIVE(1)', attemptId: 'a1', verdicts: [], decisions: [], rewards: [], tableAfter: {}, timestamp: 1000, ...over,
});

describe('the Q-learning policy evaluation', () => {
  const logs: CourseLogRow[] = [
    // First failure: the rule says practice, and practice was explored.
    row({ decisions: [decision({})] }),
    // A repeat failure: the rule says review; the leader practice was exploited, so it disagrees.
    row({
      timestamp: 2000,
      decisions: [decision({ seq: 2, source: 'commit_1', selection: 'exploit', leader: 'practice', timestamp: 2000 })],
      rewards: [reward({ reward: 0.4, timestamp: 2000 })],
    }),
    // The cap ends it: forced, and not a choice.
    row({
      timestamp: 3000,
      decisions: [decision({ seq: 3, action: 'none', source: 'cap', selection: 'forced', legal: ['practice', 'review'], timestamp: 3000 })],
      rewards: [reward({ decisionId: '1:driver_legality:2', reward: 1.2, timestamp: 3000 })],
    }),
    row({ userId: 'u2', timestamp: 4000, decisions: [decision({ timestamp: 4000 })], rewards: [] }),
    row({ userId: 'u2', timestamp: 5000, rewards: [reward({ reward: 0.8, timestamp: 5000 })] }),
  ];

  it('counts choices, disagreement with the rule, and legality', () => {
    const result = evaluateCoursePolicy(logs, 100);
    expect(result.decisions).toBe(4);
    expect(result.selection).toEqual({ explore: 2, exploit: 1, forced: 1 });
    expect(result.choices).toBe(3);
    expect(result.disagreement).toEqual({ all: 1, exploit: 1, exploitChoices: 1 });
    expect(result.illegal).toBe(0);
    expect(result.coverage).toEqual({ pairs: 15, chosen: 1, rewarded: 1, explored: 1 });
  });

  it('flags an action the rules did not allow', () => {
    const bad = [row({ decisions: [decision({ state: { mastery: 1, result: 'passed' }, legal: ['practice'], action: 'none', source: 'only_legal', selection: 'forced' })] })];
    expect(evaluateCoursePolicy(bad, 10).illegal).toBe(1);
  });

  it('gives each state-action its mean reward with a player-resampled interval', () => {
    const result = evaluateCoursePolicy(logs, 200);
    const cell = result.outcomes.find(o => o.state === 'M2-failed' && o.action === 'practice')!;
    expect(cell.chosen).toBe(3);
    expect(cell.rewarded).toBe(3);
    expect(cell.players).toBe(2);
    expect(cell.meanReward).toBeCloseTo(0.8);
    expect(cell.interval![0]).toBeGreaterThanOrEqual(0.8 - 1e-9);
    expect(cell.interval![1]).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(result.outcomes.find(o => o.state === 'M2-failed' && o.action === 'review')!.meanReward).toBeNull();
    expect(result.rewards).toBe(3);
    expect(result.rewardQuarters.map(q => q.n)).toEqual([0, 1, 1, 1]);
  });
});

describe('the Q-table convergence', () => {
  it('tracks how far Q moves and how settled each leader is', () => {
    const learn = (globalSeq: number, qBefore: number, qAfter: number, leader: string | null) => ({
      globalSeq, kind: 'learn', learning: { qBefore, qAfter }, statesAfter: { 'M2-failed': { leader } },
    });
    const result = evaluateConvergence([
      learn(3, 1, 0.9, 'review'),
      learn(1, 0, 1, 'practice'),
      { globalSeq: 2, kind: 'visit', learning: null, statesAfter: { 'M2-failed': { leader: 'practice' } } },
      learn(4, 0.9, 0.88, 'review'),
      learn(5, 0.88, 0.87, 'review'),
    ]);
    expect(result.learnUpdates).toBe(4);
    expect(result.deltaQuarters[0].mean).toBeCloseTo(1);
    expect(result.deltaQuarters[3].mean).toBeCloseTo(0.01);
    expect(result.lastTen).toBeCloseTo((1 + 0.1 + 0.02 + 0.01) / 4);
    const state = result.stability.find(s => s.state === 'M2-failed')!;
    expect(state).toEqual({ state: 'M2-failed', leader: 'review', changes: 1, updatesSinceChange: 2 });
    expect(result.stability.find(s => s.state === 'M1-passed')!.updatesSinceChange).toBeNull();
    expect(evaluateConvergence([]).lastTen).toBeNull();
  });
});
