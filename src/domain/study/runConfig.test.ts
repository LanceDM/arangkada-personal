import { describe, expect, it } from 'vitest';
import { RUN_CONFIG_FINGERPRINT, RUN_CONFIG_VERSION, canonicalJSON } from './runConfig';

/** The version each fingerprint was released under. Add a line when RUN_CONFIG_VERSION is bumped. */
const RELEASED: Record<string, string> = {
  '2026-10-28a': '561fa9bb',
  '2026-10-28b': '45470d72',
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
