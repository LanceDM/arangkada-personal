/**
 * mulberry32 - small, fast, deterministic PRNG. No cryptographic requirement
 * here; the only goal is that the same seed always reproduces the same
 * sequence, so training/evaluation runs are reproducible.
 */
export const createRng = (seed: number): (() => number) => {
  let state = seed;

  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
