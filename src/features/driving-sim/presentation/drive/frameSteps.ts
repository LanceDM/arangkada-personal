/**
 * How many simulation steps each animation frame runs.
 *
 * The world advances by a fixed amount per step - road per km/h, wheel travel,
 * acceleration - while a reaction is timed in milliseconds. Tied one step to
 * one animation frame, the drive ran at whatever rate the display delivered: a
 * phone that fell to 30 fps gave the driver twice the seconds to answer a
 * scenario, and a 120 Hz screen half. So the host runs `STEPS_PER_SECOND`
 * steps per second of real time, whatever the display does:
 *
 * - a display within `SNAP` of 60 Hz gets exactly one step per frame, which is
 *   what every frame was before, so a 60 Hz screen plays as it always has;
 * - a faster display steps on some frames and not others;
 * - a slower one, or a frame that came late, runs the missed steps together,
 *   up to `MAX_STEPS_PER_FRAME`; past that the device has fallen behind, the
 *   world slows, and the time it lost is counted;
 * - a gap longer than `PAUSE_MS` - a hidden tab, an app switch - is a pause:
 *   one step, never a fast-forward through time nobody watched.
 *
 * The session itself is untouched: it is still advanced one step at a time,
 * with the same input it would have been given.
 */

export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;
/** How far from 60 Hz a frame interval may be and still count as exactly one step. */
export const SNAP = 0.15;
export const MAX_STEPS_PER_FRAME = 4;
export const PAUSE_MS = 250;
/** The slowest display the world still keeps real time on: below it a device falls behind. */
export const KEEPS_UP_AT_FPS = STEPS_PER_SECOND / MAX_STEPS_PER_FRAME;
/** Absorbs timestamp jitter, so two half-steps at 120 Hz make a whole one. */
const JITTER_MS = 1;
const BUCKETS_PER_MS = 10;

/** What the frames of one drive looked like, for the attempt's record. */
export interface FrameStats {
  frames: number;
  steps: number;
  /** Frames that had to run more than one step: the device was behind 60 Hz there. */
  slowFrames: number;
  /** Real time the world did not advance because the device could not catch up. */
  lostMs: number;
  /** Gaps over `PAUSE_MS`, held rather than run. */
  pauses: number;
  /** Frame intervals up to `PAUSE_MS`, counted by tenth of a millisecond. */
  intervals: number[];
}

export const emptyFrameStats = (): FrameStats => ({
  frames: 0,
  steps: 0,
  slowFrames: 0,
  lostMs: 0,
  pauses: 0,
  intervals: new Array(PAUSE_MS * BUCKETS_PER_MS + 1).fill(0),
});

/** The display's frame rate over the drive: the median interval, as frames per second. */
export const medianFrameRate = (stats: FrameStats): number | null => {
  const total = stats.intervals.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;
  let seen = 0;
  for (let bucket = 0; bucket < stats.intervals.length; bucket++) {
    seen += stats.intervals[bucket];
    if (seen * 2 >= total) return bucket === 0 ? null : Math.round((1000 * BUCKETS_PER_MS * 10) / bucket) / 10;
  }
  return null;
};

export interface FrameStepper {
  /** The steps the frame painted at `now` (an animation frame's timestamp) should run. */
  stepsFor(now: number): number;
}

/**
 * One stepper per run of the frame loop. A loop that stops and starts again -
 * the drive held while the device is upright - takes a fresh one, so the time
 * it was stopped is never run.
 */
export const createFrameStepper = (
  stats: FrameStats = emptyFrameStats(),
  /**
   * Told the real time a pause took beyond the one step it runs, so the
   * session can spend it (`DrivingSession.spendAway`): the world is held, but
   * the time was the player's.
   */
  onPause?: (ms: number) => void
): FrameStepper => {
  let last: number | null = null;
  let carry = 0;

  return {
    stepsFor(now) {
      let steps: number;
      if (last === null) {
        steps = 1;
      } else {
        const interval = now - last;
        if (interval > PAUSE_MS) {
          stats.pauses += 1;
          carry = 0;
          steps = 1;
          onPause?.(interval - STEP_MS);
        } else {
          stats.intervals[Math.max(0, Math.round(interval * BUCKETS_PER_MS))] += 1;
          if (Math.abs(interval - STEP_MS) <= STEP_MS * SNAP) {
            carry = 0;
            steps = 1;
          } else {
            carry += interval;
            steps = Math.floor((carry + JITTER_MS) / STEP_MS);
            carry -= steps * STEP_MS;
            if (steps > MAX_STEPS_PER_FRAME) {
              stats.lostMs += (steps - MAX_STEPS_PER_FRAME) * STEP_MS;
              steps = MAX_STEPS_PER_FRAME;
            }
          }
        }
      }
      last = now;
      stats.frames += 1;
      stats.steps += steps;
      if (steps > 1) stats.slowFrames += 1;
      return steps;
    },
  };
};

/** Whether the page was opened with `?perf`, which shows the frame meter over the drive. */
export const frameMeterRequested = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');
