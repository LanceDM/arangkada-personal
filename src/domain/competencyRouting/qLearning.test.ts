import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WARM_UP,
  Q_STATES,
  chooseAction,
  emptyQTable,
  fallbackAction,
  legalActions,
  recordVisit,
  rewardOf,
  updateQ,
  warmUpFinished,
  type QState,
  type QTable,
} from './qLearning';
import { masteryLevel } from './mastery';

const passedHigh: QState = { mastery: 3, result: 'passed' };
const failedLow: QState = { mastery: 1, result: 'failed' };
const passedLow: QState = { mastery: 1, result: 'passed' };

/** A generator that walks 0, 0.1, ... so each draw is deterministic. */
const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('the 8-state table', () => {
  it('has the mastery level x scenario result states', () => {
    expect(Q_STATES).toHaveLength(8);
  });

  it('allows none only after a pass at mastery 0.50 or more, and review only after a fail', () => {
    expect(legalActions(passedHigh)).toEqual(['none', 'practice']);
    expect(legalActions(failedLow)).toEqual(['practice', 'review']);
    expect(legalActions(passedLow)).toEqual(['practice']);
  });

  it('reads the four mastery levels at 0.50 / 0.80 / 0.95', () => {
    expect([0.49, 0.5, 0.8, 0.95].map(p => masteryLevel(p))).toEqual([1, 2, 3, 4]);
  });

  it('caps a competency at Connecting until it has 3 graded drive answers', () => {
    expect(masteryLevel(0.97, 2)).toBe(3);
    expect(masteryLevel(0.97, 3)).toBe(4);
  });
});

describe('the warm-up (Double Explore-then-Commit, 2 / 6 / 2, floor 0.1)', () => {
  const fallback = { state: passedHigh, masteryP: 0.85, failedBefore: false };

  it('skips the policy when only one action is legal', () => {
    const decision = chooseAction(emptyQTable(), passedLow, { ...fallback, state: passedLow }, () => 0.5);
    expect(decision).toMatchObject({ action: 'practice', phase: 'only_legal', probability: 1 });
  });

  it('explores each legal action twice, at random, with its probability logged', () => {
    const decision = chooseAction(emptyQTable(), passedHigh, fallback, () => 0.7);
    expect(decision.phase).toBe('explore_1');
    expect(decision.probability).toBe(0.5);
  });

  it('then commits to the leader with probability 1 - (k - 1)p and keeps every other action at p', () => {
    let table: QTable = emptyQTable();
    for (const action of ['none', 'none', 'practice', 'practice'] as const) table = recordVisit(table, passedHigh, action);
    table = updateQ(table, passedHigh, 'practice', 1.2, null).table;
    const decision = chooseAction(table, passedHigh, fallback, () => 0.05);
    expect(decision.phase).toBe('commit_1');
    expect(decision.leader).toBe('practice');
    expect(decision.probabilities).toEqual({ none: 0.1, practice: 0.9 });
  });

  it('finishes a 2-action state after 10 visits', () => {
    let table: QTable = emptyQTable();
    const rng = sequence([0.05, 0.55, 0.95, 0.35]);
    let visits = 0;
    while (!warmUpFinished(table, passedHigh) && visits < 50) {
      const decision = chooseAction(table, passedHigh, fallback, rng);
      table = recordVisit(table, passedHigh, decision.action);
      visits += 1;
    }
    expect(visits).toBeGreaterThanOrEqual(10);
    expect(warmUpFinished(table, passedHigh, DEFAULT_WARM_UP)).toBe(true);
  });

  it('breaks ties with the fallback rule', () => {
    expect(fallbackAction({ state: passedHigh, masteryP: 0.7, failedBefore: false })).toBe('practice');
    expect(fallbackAction({ state: passedHigh, masteryP: 0.9, failedBefore: false })).toBe('none');
    expect(fallbackAction({ state: failedLow, masteryP: 0.3, failedBefore: false })).toBe('practice');
    expect(fallbackAction({ state: failedLow, masteryP: 0.3, failedBefore: true })).toBe('review');
  });
});

describe('learning', () => {
  it('averages targets with alpha = 1/n', () => {
    let table = emptyQTable();
    table = updateQ(table, failedLow, 'practice', 1, null).table;
    table = updateQ(table, failedLow, 'practice', 0, null).table;
    expect(table['M1-failed'].practice).toMatchObject({ q: 0.5, n: 2 });
  });

  it('bootstraps from the best legal action of the next state at gamma 0.9', () => {
    let table = emptyQTable();
    table = updateQ(table, passedHigh, 'none', 2, null).table;
    const { target } = updateQ(table, failedLow, 'practice', 1, passedHigh);
    expect(target).toBeCloseTo(1 + 0.9 * 2, 10);
  });

  it('rewards r = A_next + 0.5 Pass - 0.02 H', () => {
    expect(rewardOf({ accuracy: 2 / 3, passed: true }, 3)).toBeCloseTo(2 / 3 + 0.5 - 0.06, 10);
    expect(rewardOf({ accuracy: 1 / 3, passed: false }, 0)).toBeCloseTo(1 / 3, 10);
  });
});
