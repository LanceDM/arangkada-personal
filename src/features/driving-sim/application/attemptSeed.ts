/**
 * A fresh seed for one attempt.
 *
 * Deliberately not `Math.random()`. It is read once per attempt, where the
 * attempt is identified (the story layout, for each roll of a level), and a
 * test that freezes the clock - as every drive test here already does - gets a
 * reproducible run for free. The counter is what keeps two attempts inside the
 * same millisecond apart. What the seed decides is `domain/scenario/attemptSeed`.
 */
let attempts = 0;
export const nextAttemptSeed = (): number =>
  // Never 0: that value is the "leave the authored order alone" sentinel the
  // gallery and the tests use, and an attempt that landed on it would silently
  // stop shuffling.
  ((Date.now() ^ Math.imul(++attempts, 0x9e3779b1)) >>> 0) || 0x9e3779b1;
