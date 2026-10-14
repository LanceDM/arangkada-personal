/**
 * The standing penalties' clock, and the hidden tab.
 *
 * The crawl's banner and its first −5 came on the same frame, so the
 * warning warned of nothing. It now comes half the grace ahead, and the
 * charges stay where they were: 3, 8, 13 and 18 seconds.
 *
 * And a frame is the drive running. The offence used to be timed on the wall
 * clock, so a tab left in the background with the car standing on clear road
 * came back owing every charge at once, one a frame.
 */
import { describe, expect, it } from 'vitest';
import {
  CRAWL_PENALTY,
  MAX_STEP_MS,
  WRONG_SIDE_PENALTY,
  createStandingPenaltyState,
  stepStandingPenalty,
  type StandingPenaltyConfig,
  type StandingPenaltyState,
} from './standingPenalties';

const FRAME = 1000 / 60;

/** Steps `frames` frames of the offence from `start`, recording each charge and warning by its time. */
const run = (
  state: StandingPenaltyState,
  config: StandingPenaltyConfig,
  frames: number,
  start = 1_000,
  violating = true
) => {
  const charges: number[] = [];
  let firstWarning: number | null = null;
  for (let frame = 0; frame < frames; frame++) {
    const now = start + frame * FRAME;
    const step = stepStandingPenalty(state, config, { violating, now });
    if (step.charge) charges.push(now - start);
    if (step.warning && firstWarning === null) firstWarning = now - start;
  }
  return { charges, firstWarning, end: start + frames * FRAME };
};

describe('the crawl penalty', () => {
  it('warns well before its first charge', () => {
    const { charges, firstWarning } = run(createStandingPenaltyState(), CRAWL_PENALTY, 60 * 4);
    expect(firstWarning).not.toBeNull();
    expect(charges).toHaveLength(1);
    expect(charges[0] - firstWarning!).toBeGreaterThanOrEqual(1400);
  });

  it('still charges at 3, 8, 13 and 18 seconds of crawling, and no more', () => {
    const { charges } = run(createStandingPenaltyState(), CRAWL_PENALTY, 60 * 30);
    expect(charges.map(at => Math.round(at / 1000))).toEqual([3, 8, 13, 18]);
  });
});

describe('the wrong-side penalty', () => {
  it('keeps its own timings: a warning at 0.7 s, charges from 1.5 s every 4 s', () => {
    const { charges, firstWarning } = run(createStandingPenaltyState(), WRONG_SIDE_PENALTY, 60 * 16);
    expect(Math.round(firstWarning! / 100)).toBe(7);
    expect(charges.map(at => Math.round(at / 100) / 10)).toEqual([1.5, 5.5, 9.5, 13.5]);
  });
});

describe('a drive that was not running', () => {
  it.each([
    ['crawl', CRAWL_PENALTY],
    ['wrong side', WRONG_SIDE_PENALTY],
  ] as const)('charges the %s for none of it', (_name, config) => {
    const state = createStandingPenaltyState();
    // A second of the offence, then the tab is hidden for a minute.
    const before = run(state, config, 60);
    expect(before.charges).toEqual([]);
    const after = run(state, config, 10, before.end + 60_000);
    expect(after.charges).toEqual([]);
    // What is left of the grace is still owed, and then the charge comes: the
    // hidden minute counted as one long frame and no more.
    const driven = 59 * FRAME + MAX_STEP_MS + 9 * FRAME;
    const rest = run(state, config, 60 * 3, after.end);
    expect(rest.charges.length).toBeGreaterThan(0);
    expect(Math.abs(rest.charges[0] - (config.graceMs - driven))).toBeLessThanOrEqual(2 * FRAME);
  });

  it('counts an ordinary slow frame in full', () => {
    const state = createStandingPenaltyState();
    // 40 frames 75 ms apart: three seconds, at a frame rate a slow machine gives.
    let charged = 0;
    for (let frame = 0; frame <= 41; frame++) {
      if (stepStandingPenalty(state, CRAWL_PENALTY, { violating: true, now: 1_000 + frame * 75 }).charge) charged++;
    }
    expect(charged).toBe(1);
  });

  it('starts again from nothing once the offence stops', () => {
    const state = createStandingPenaltyState();
    run(state, CRAWL_PENALTY, 60 * 2);
    stepStandingPenalty(state, CRAWL_PENALTY, { violating: false, now: 5_000 });
    expect(run(state, CRAWL_PENALTY, 60 * 2, 6_000).charges).toEqual([]);
  });
});
