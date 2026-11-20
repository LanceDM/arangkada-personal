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

  it('caps a competency at Nearly mastered until it has 3 graded drive answers', () => {
    expect(masteryLevel(0.97, 2)).toBe(3);
    expect(masteryLevel(0.97, 3)).toBe(4);
  });
});

describe('the warm-up (2 / 0 / 0, floor 0.1, 2026-11-20)', () => {
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

  it('after two tries each, takes the leader at 1 - (k - 1)p and keeps every other action at p', () => {
    let table: QTable = emptyQTable();
    for (const action of ['none', 'none', 'practice', 'practice'] as const) table = recordVisit(table, passedHigh, action);
    table = updateQ(table, passedHigh, 'practice', 1.2, null).table;
    const decision = chooseAction(table, passedHigh, fallback, () => 0.05);
    expect(decision.phase).toBe('final_commit');
    expect(decision.leader).toBe('practice');
    expect(decision.probabilities).toEqual({ none: 0.1, practice: 0.9 });
  });

  it('finishes a 2-action state after its 4 tries, with no forced second round', () => {
    let table: QTable = emptyQTable();
    const rng = sequence([0.05, 0.55, 0.95, 0.35]);
    let visits = 0;
    while (!warmUpFinished(table, passedHigh) && visits < 50) {
      const decision = chooseAction(table, passedHigh, fallback, rng);
      table = recordVisit(table, passedHigh, decision.action);
      visits += 1;
    }
    expect(visits).toBe(4);
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

  it('bootstraps from the best legal action of the next state, undiscounted (gamma 1)', () => {
    let table = emptyQTable();
    table = updateQ(table, passedHigh, 'none', 2, null).table;
    const { target } = updateQ(table, failedLow, 'practice', -0.06, passedHigh);
    expect(target).toBeCloseTo(-0.06 + 2, 10);
  });

  it('pays accuracy once, at the end of the episode, with no pass bonus; a mid-episode step pays only its cost', () => {
    expect(rewardOf({ accuracy: 2 / 3, passed: true }, 0)).toBeCloseTo(2 / 3, 10);
    expect(rewardOf({ accuracy: 2 / 3, passed: true }, 3)).toBeCloseTo(2 / 3 - 0.06, 10);
    expect(rewardOf({ accuracy: 1, passed: true }, 3, undefined, false)).toBeCloseTo(-0.06, 10);
  });

  it("moves on the perfect player: practice loses by exactly its cost (Ana, 3 of 3 at M3)", () => {
    // Move on: the episode ends, r = A_next = 1.
    let table = updateQ(emptyQTable(), passedHigh, 'none', rewardOf({ accuracy: 1, passed: true }, 0), null).table;
    // Practise once, then move on: r = -0.06, plus Q(M3-passed, none) = 1.
    const practice = updateQ(table, passedHigh, 'practice', rewardOf({ accuracy: 1, passed: true }, 3, undefined, false), passedHigh);
    table = practice.table;
    expect(table['M3-passed']?.none?.q).toBeCloseTo(1, 10);
    expect(table['M3-passed']?.practice?.q).toBeCloseTo(0.94, 10);
  });
});
