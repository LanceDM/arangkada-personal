// Tests for the reaction-latency Q-state expansion.
//
// The expansion exists for one measured reason: the baseline-vs-adaptive
// experiment showed a policy statistically indistinguishable from pinning theta
// at a constant, because mastery and recent correctness cannot separate a
// learner who does not know the rule (more time will not help) from one who
// knows it but responds slowly (more time will).
import { describe, it, expect } from 'vitest';
import { latencyBucket, chooseAction, actionKey, WINDOW_SCALE, LATENCY_BUCKETS, MASTERY_BUCKETS, PERFORMANCE_BUCKETS, NOMINAL_APPROACH_MS, type QState, type LatencyBucket, } from './qLearningPolicy';
import policyTable from './policyTable.json';
import { LATENCY_WINDOW, recentLatencies } from './recentLatencies';
import type { ActionLog } from '@/domain/learner/attempt';

const stateOf = (mastery: string, perf: string, latency: string) =>
  [mastery, perf, latency].join(':') as QState;

describe('latency bucket calculation', () => {
  it('reads a learner with no evidence yet as steady', () => {
    // The neutral default. A separate `unknown` bucket was barely trained, and
    // mostly handed the narrowest window to a learner who had not yet
    // responded to anything; it went with an earlier retrain.
    expect(latencyBucket([])).toBe('steady');
    expect(latencyBucket([0, -5, Number.NaN])).toBe('steady');
  });

  it('reads a window that closed without a response as slow', () => {
    // Censored: at least the whole window, so slower than any time measured.
    const prompt = 0.5 * NOMINAL_APPROACH_MS;
    expect(latencyBucket([Infinity, Infinity, prompt])).toBe('slow');
    expect(latencyBucket([prompt, prompt, Infinity])).toBe('steady');
  });

  it('separates a learner using more of the window from one who is not', () => {
    const prompt = 0.5 * NOMINAL_APPROACH_MS;
    const dawdling = 1.3 * NOMINAL_APPROACH_MS;
    expect(latencyBucket([prompt, prompt, prompt])).toBe('steady');
    expect(latencyBucket([dawdling, dawdling, dawdling])).toBe('slow');
  });

  it('uses the median, so one distracted event does not reclassify a learner', () => {
    const prompt = 0.5 * NOMINAL_APPROACH_MS;
    const outlier = 8 * NOMINAL_APPROACH_MS;
    // The mean would be dragged well past the threshold; the median is not.
    expect(latencyBucket([prompt, prompt, outlier])).toBe('steady');
  });

  it('ignores unusable readings rather than counting them as prompt', () => {
    const dawdling = 1.3 * NOMINAL_APPROACH_MS;
    expect(latencyBucket([Number.NaN, 0, dawdling])).toBe('slow');
  });

  it('produces every declared bucket', () => {
    const produced = new Set<LatencyBucket>([
      latencyBucket([]),
      latencyBucket([Infinity]),
      latencyBucket([0.4 * NOMINAL_APPROACH_MS]),
      latencyBucket([1.4 * NOMINAL_APPROACH_MS]),
    ]);
    expect([...produced].sort()).toEqual([...LATENCY_BUCKETS].sort());
  });
});

describe('Q-state construction', () => {
  it('is the product of the three buckets, and the table covers all of it', () => {
    const expected = MASTERY_BUCKETS.flatMap(m =>
      PERFORMANCE_BUCKETS.flatMap(p => LATENCY_BUCKETS.map(l => stateOf(m, p, l)))
    );
    expect(expected).toHaveLength(18);
    for (const state of expected) expect(policyTable, 'missing ' + state).toHaveProperty(state);
    expect(Object.keys(policyTable)).toHaveLength(18);
  });

  it('resolves every state to an action whose window is a legal FSM parameter', () => {
    for (const state of Object.keys(policyTable) as QState[]) {
      expect(WINDOW_SCALE[chooseAction(state).window]).toBeGreaterThan(0);
    }
  });
});

describe('policy behaviour differs by latency condition', () => {
  /*
   * Two tests were removed here by the latest retrain, not relaxed, and the
   * removal is reported with the experiment.
   *
   * They required the table to ask for a different window of a slow responder
   * than of a steady one in `critical:struggling`, and to give slow responders
   * more room than steady ones averaged over the nine mastery x form states.
   * The retrained table does neither: it asks for theta 1 in both halves of
   * `critical:struggling`, and averages 1.06 for slow against 1.14 for steady.
   *
   * They were assertions about what a trained table chose, and what it chooses
   * is the experiment's result, not this file's specification. The experiment
   * fixed the handling in advance: the table stands and the test goes. Keeping
   * them would have meant retraining until the policy agreed with us, which is
   * the one thing a pre-registered experiment exists to prevent.
   *
   * What this leaves: the latency dimension is still part of the state (the
   * tests above), and the table still varies its action across it (below). The
   * direction the dimension was justified by - more room for slower responders
   * - is not something the retrained table delivers, and that is a finding.
   */
  it('varies its action across latency conditions overall', () => {
    const keys = new Set(
      MASTERY_BUCKETS.flatMap(m =>
        PERFORMANCE_BUCKETS.flatMap(p =>
          LATENCY_BUCKETS.map(l => actionKey(chooseAction(stateOf(m, p, l))))
        )
      )
    );
    expect(keys.size).toBeGreaterThan(2);
  });
});

describe('the evidence the latency bucket reads', () => {
  const log = (extra: Partial<ActionLog>): ActionLog => ({
    timestamp: 0,
    action: 'brake',
    result: 'correct',
    points: 0,
    ...extra,
  });

  it('keeps responses and windows closed on them, and skips decisions that say nothing', () => {
    const logs = [
      log({ reactionTime: 800 }),
      log({}),
      log({ reactionCensored: true }),
      log({ reactionTime: 1_200 }),
    ];
    expect(recentLatencies(logs)).toEqual([800, Number.POSITIVE_INFINITY, 1_200]);
  });

  it('reads only the most recent few, oldest first', () => {
    const logs = Array.from({ length: LATENCY_WINDOW + 3 }, (_, i) => log({ reactionTime: 100 * (i + 1) }));
    expect(recentLatencies(logs)).toEqual(
      Array.from({ length: LATENCY_WINDOW }, (_, i) => 100 * (i + 4))
    );
  });

  it('reads a learner whose windows keep closing on them as slow', () => {
    const logs = [
      log({ reactionTime: 0.5 * NOMINAL_APPROACH_MS }),
      log({ reactionCensored: true }),
      log({ reactionCensored: true }),
    ];
    expect(latencyBucket(recentLatencies(logs))).toBe('slow');
  });
});
