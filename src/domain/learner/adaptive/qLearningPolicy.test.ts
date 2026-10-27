// Tests for the Q-learning policy and, in particular, the half of its action
// that reaches the FSM: the transition-guard window.
//
// The thesis claim S1 rests on is that the policy chooses a parameter *of the
// transition relation*, not only content. These pin that path end to end:
// trained table -> QAction.window -> WINDOW_SCALE -> TransitionParams.approachScale
// -> the guard inside DrivingFSM.
import { describe, it, expect } from 'vitest';
import { chooseAction, actionKey, parseActionKey, masteryBucket, performanceBucket, tableEntry, DEFAULT_ACTION, WINDOW_SCALE, MASTERY_BUCKETS, PERFORMANCE_BUCKETS, LATENCY_BUCKETS, TARGETS, SUPPORT_LEVELS, WINDOWS, type QAction, type QState, } from './qLearningPolicy';
import policyTable from './policyTable.json';

/**
 * Every row of the table. The three tests below once ran over a subset, because
 * at a mastery threshold of 50 `selectPractice` could never compute an `ok:`
 * state and those rows were inert. At the current threshold of 85 they are
 * live, so the subset is the whole table - and this module cannot read the
 * threshold to say so, because the shared learner domain imports no feature.
 * Asserting over all 18 is the property that holds whatever tau is.
 */
const allStates = (): QState[] =>
  MASTERY_BUCKETS.flatMap(m =>
    PERFORMANCE_BUCKETS.flatMap(p => LATENCY_BUCKETS.map(l => `${m}:${p}:${l}` as QState))
  );

describe('action encoding carries the FSM window and the support level', () => {
  it('round-trips every action in the space', () => {
    for (const target of TARGETS) {
      for (const support of SUPPORT_LEVELS) {
        for (const window of WINDOWS) {
          const action = { target, support, window };
          expect(parseActionKey(actionKey(action))).toEqual(action);
        }
      }
    }
  });

  it('keeps the space at 27 actions', () => {
    expect(TARGETS.length * SUPPORT_LEVELS.length * WINDOWS.length).toBe(27);
  });
});

describe('the trained table', () => {
  it('has an entry for every state', () => {
    for (const state of allStates()) {
      expect(policyTable, `missing ${state}`).toHaveProperty(state);
    }
  });

  it('resolves every entry to a valid action with a legal window', () => {
    for (const state of allStates()) {
      const action = chooseAction(state);
      expect(TARGETS).toContain(action.target);
      expect(SUPPORT_LEVELS).toContain(action.support);
      expect(WINDOWS).toContain(action.window);
      expect(WINDOW_SCALE[action.window]).toBeGreaterThan(0);
    }
  });

  /*
   * Which target the table picks is not asserted. A test here once required
   * more than one, as a guard on the reward: a target-scoped reward was biased
   * toward `weakest` by construction, so `related` and `review` could never
   * win. That guard now lives with the reward itself, in
   * practiceLearnerModel.test.ts, which holds the pathways those targets exist
   * to use. Which targets a table picks is a result of the experiment, and it
   * has changed with each one - an earlier table picked `weakest` everywhere,
   * the current one uses all three - so a test requiring either
   * would be dictating the policy rather than checking it.
   */

  it('varies the FSM window it asks for, rather than pinning one timing', () => {
    const windows = new Set(allStates().map(s => chooseAction(s).window));
    expect(windows.size).toBeGreaterThan(1);
  });

  it('selects several distinct actions overall', () => {
    expect(new Set(allStates().map(s => actionKey(chooseAction(s)))).size).toBeGreaterThan(2);
  });

  it('varies the support level it asks for across the table', () => {
    expect(new Set(allStates().map(s => chooseAction(s).support)).size).toBeGreaterThan(1);
  });
});

describe('state bucketing', () => {
  it('splits mastery at 40 and 70', () => {
    expect(masteryBucket(0)).toBe('critical');
    expect(masteryBucket(39)).toBe('critical');
    expect(masteryBucket(40)).toBe('weak');
    expect(masteryBucket(69)).toBe('weak');
    expect(masteryBucket(70)).toBe('ok');
  });

  it('reads recent form, defaulting to mixed with no evidence', () => {
    expect(performanceBucket([])).toBe('mixed');
    expect(performanceBucket([false, false, false])).toBe('struggling');
    expect(performanceBucket([false, false, true])).toBe('struggling');
    expect(performanceBucket([false, true, true])).toBe('improving');
    expect(performanceBucket([true, true, true])).toBe('improving');
  });
});

describe('a table entry for a state training left untrained', () => {
  /** The 27 actions in the trainers' order: target, then support, then window. */
  const actions: QAction[] = TARGETS.flatMap(target =>
    SUPPORT_LEVELS.flatMap(support => WINDOWS.map(window => ({ target, support, window })))
  );
  const zeros = () => new Array<number>(actions.length).fill(0);

  it('records the first action for a row never visited under first-action, as the earlier studies trained', () => {
    expect(tableEntry(zeros(), zeros(), actions, 'first-action')).toBe('weakest:full:-1');
  });

  it('records the documented default for a row never visited under documented-default', () => {
    expect(tableEntry(zeros(), zeros(), actions, 'documented-default')).toBe(actionKey(DEFAULT_ACTION));
    expect(actionKey(DEFAULT_ACTION)).toBe('weakest:full:0');
  });

  it('never records an action the row never tried under documented-default', () => {
    // Tried twice, both worth less than the untried actions' initial zero.
    const q = zeros();
    const tried = zeros();
    q[4] = -3;
    tried[4] = 1;
    q[9] = -1;
    tried[9] = 1;
    expect(tableEntry(q, tried, actions, 'first-action')).toBe(actionKey(actions[0]));
    expect(tableEntry(q, tried, actions, 'documented-default')).toBe(actionKey(actions[9]));
  });

  it('agrees under both rules wherever the best action was tried', () => {
    const q = zeros().map((_, i) => (i === 13 ? 5 : i % 3));
    const tried = zeros().map(() => 1);
    expect(tableEntry(q, tried, actions, 'first-action')).toBe(actionKey(actions[13]));
    expect(tableEntry(q, tried, actions, 'documented-default')).toBe(actionKey(actions[13]));
  });
});
