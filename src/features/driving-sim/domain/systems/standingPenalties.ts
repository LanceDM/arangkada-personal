/**
 * Penalties charged for something the driver keeps *doing*, rather than for a
 * decision at an event.
 *
 * Two of these exist — crawling on clear road, and travelling in the oncoming
 * lane — and they had the same eighteen lines written out twice inside the
 * frame loop, differing only in their timings and in whether they raise a
 * visible warning. The shape is the same in both cases and is the whole of
 * what this module is:
 *
 *   hold the offence for `graceMs`  → charge once
 *   hold it for `everyMs` longer    → charge again
 *   ...up to `maxCharges`, ever     → then stop, so a nervous learner is
 *                                     corrected rather than bled dry
 *
 * Pure and frame-driven: it takes the clock rather than reading it, mutates
 * only the state object handed to it, and returns what the caller should do.
 * Nothing here knows about React, the FSM or scoring.
 *
 * The offence is timed in the time the drive actually ran, not on the wall
 * clock. A frame is one step of the world, and a gap between two steps longer
 * than `MAX_STEP_MS` is a drive that was not running: a hidden tab, a frame
 * held behind a dialog. Read off the wall clock, a tab left in the background
 * while the car stood on clear road came back owing every charge at once, one
 * a frame, for driving that never happened.
 */

/** The longest gap between two frames that still counts as the drive running. */
export const MAX_STEP_MS = 100;

/** How long the offence has been running, and how much has been charged for it. */
export interface StandingPenaltyState {
  /** How long the current run of the offence has lasted, in driven time; 0 when not offending. */
  held: number;
  /** The clock at the last frame of the current run, or null when not offending. */
  last: number | null;
  /**
   * Charges made so far. Deliberately *not* reset when the offence stops: the
   * cap is for the whole drive, so stopping and restarting cannot be used to
   * earn a fresh allowance of free warnings.
   */
  charged: number;
}

export interface StandingPenaltyConfig {
  /** How long the offence may run before the first charge. */
  graceMs: number;
  /** Interval between charges after the first. */
  everyMs: number;
  maxCharges: number;
  /** When a visible warning appears, for the penalty that shows one. */
  warnAfterMs?: number;
}

export interface StandingPenaltyStep {
  /** Charge the penalty this frame. */
  charge: boolean;
  /** Whether the on-screen warning should be showing. */
  warning: boolean;
}

export const createStandingPenaltyState = (): StandingPenaltyState => ({ held: 0, last: null, charged: 0 });

/**
 * Advances one frame of a standing penalty.
 *
 * `violating` is the caller's judgment about this exact frame — is the car
 * crawling, is it on the wrong side — because what counts as the offence is
 * the one part that genuinely differs between the two and depends on the road.
 */
export const stepStandingPenalty = (
  state: StandingPenaltyState,
  config: StandingPenaltyConfig,
  { violating, now }: { violating: boolean; now: number }
): StandingPenaltyStep => {
  if (!violating) {
    state.held = 0;
    state.last = null;
    return { charge: false, warning: false };
  }

  if (state.last !== null) state.held += Math.min(Math.max(now - state.last, 0), MAX_STEP_MS);
  state.last = now;
  const { held } = state;

  const charge =
    held > config.graceMs + config.everyMs * state.charged && state.charged < config.maxCharges;
  if (charge) state.charged += 1;

  return {
    charge,
    warning: config.warnAfterMs !== undefined && held > config.warnAfterMs,
  };
};

/* ------------------------------------------------------------------------- *
 * The two the game actually charges
 * ------------------------------------------------------------------------- */

/** Below this share of the posted limit, on clear road, counts as crawling. */
export const CRAWL_SPEED_SHARE = 0.25;

/**
 * What stops crawling being a winning strategy. Braking is the right answer to
 * most events, so without a cost for holding it down the whole level, driving
 * at walking pace passes everything. Charged on clear road only, after a
 * warning, up to a cap.
 *
 * The warning comes half the grace ahead of the first charge. It used to come
 * at the grace itself, so the banner and the first deduction landed on the
 * same frame and the warning warned of nothing.
 */
export const CRAWL_PENALTY: StandingPenaltyConfig = {
  graceMs: 3000,
  everyMs: 5000,
  maxCharges: 4,
  warnAfterMs: 1500,
};

/**
 * Travelling in a lane reserved for opposing traffic.
 *
 * The grace is shorter than the crawl's because this is not a nervous habit —
 * it is being on the wrong side of the road. Only charged on clear road:
 * inside an event's window the lane the driver is in is already being judged
 * by that event, and a legal overtake is exactly the moment crossing the line
 * is the correct answer.
 *
 * Warns before the first charge, the same way the crawl penalty does, so the
 * always-on banner is the single on-screen cue: the deduction is silent (no
 * toast, no correction card), the banner is what tells the driver why.
 */
export const WRONG_SIDE_PENALTY: StandingPenaltyConfig = {
  graceMs: 1500,
  everyMs: 4000,
  maxCharges: 4,
  warnAfterMs: 700,
};
