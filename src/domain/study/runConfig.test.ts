import { describe, expect, it } from 'vitest';
import { RUN_CONFIG_FINGERPRINT, RUN_CONFIG_VERSION, canonicalJSON } from './runConfig';

/** The version each fingerprint was released under. Add a line when RUN_CONFIG_VERSION is bumped. */
const RELEASED: Record<string, string> = {
  '2026-11-10a': '655544da',
  // Level 2 lists only its garage's three topics.
  '2026-11-12a': 'df1746f5',
  // The BKT prior is 0.5.
  '2026-11-15a': '7d24d953',
  // Q-learning Option 2: gamma 1, the pass weight dropped, warm-up 2 / 0 / 0.
  '2026-11-15b': '2a41df51',
  // An ended drive measures only what it asked; a topic with fewer than 3 is practice only.
  '2026-11-17a': 'c2e88fac',
  // The practice-only rule withdrawn: an ended drive measures only what it asked.
  '2026-11-17b': 'fc8049ce',
  // No setting changed: course drives record their seed and composition, course quizzes what they showed.
  '2026-11-17c': '05844bec',
};

describe('the run config version', () => {
  it('is bumped whenever a setting changes', () => {
    // If this fails: a setting changed. Bump RUN_CONFIG_VERSION and add the new
    // version with this fingerprint to RELEASED, so logged records stay traceable.
    expect(RELEASED[RUN_CONFIG_VERSION]).toBe(RUN_CONFIG_FINGERPRINT());
  });

  it('writes keys in a stable order', () => {
    expect(canonicalJSON({ b: 1, a: { d: [1, { f: 2, e: 3 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"e":3,"f":2}]},"b":1}');
  });
});
