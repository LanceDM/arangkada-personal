import { describe, expect, it } from 'vitest';
import {
  createFrameStepper,
  emptyFrameStats,
  MAX_STEPS_PER_FRAME,
  medianFrameRate,
  STEP_MS,
} from './frameSteps';

/** Runs `frames` animation frames `interval` ms apart and returns each frame's steps. */
const play = (interval: number, frames: number, stats = emptyFrameStats()) => {
  const stepper = createFrameStepper(stats);
  const steps: number[] = [];
  for (let frame = 0; frame < frames; frame++) steps.push(stepper.stepsFor(1000 + frame * interval));
  return { steps, stats, total: steps.reduce((sum, n) => sum + n, 0) };
};

describe('the fixed step', () => {
  it('runs exactly one step per frame on a 60 Hz display, as every frame always did', () => {
    expect(play(1000 / 60, 600).steps.every(steps => steps === 1)).toBe(true);
    // The test harness's own frame clock, and a display slightly off 60 Hz.
    expect(play(16, 600).steps.every(steps => steps === 1)).toBe(true);
    expect(play(1000 / 59.94, 6000).steps.every(steps => steps === 1)).toBe(true);
  });

  it('keeps one step per frame through jitter around 60 Hz', () => {
    const stepper = createFrameStepper();
    const intervals = [16.2, 17.1, 16.6, 15.9, 18.4, 16.7, 14.9];
    let now = 0;
    expect(stepper.stepsFor(now)).toBe(1);
    for (const interval of intervals) {
      now += interval;
      expect(stepper.stepsFor(now)).toBe(1);
    }
  });

  it('runs 60 steps per second on a 120 Hz display, one every other frame', () => {
    const { steps, total } = play(1000 / 120, 1201);
    expect(total).toBeGreaterThanOrEqual(600);
    expect(total).toBeLessThanOrEqual(602);
    expect(Math.max(...steps)).toBe(1);
  });

  it('runs 60 steps per second on 144 Hz and 90 Hz displays', () => {
    expect(play(1000 / 144, 1441).total).toBeGreaterThanOrEqual(599);
    expect(play(1000 / 144, 1441).total).toBeLessThanOrEqual(602);
    expect(play(1000 / 90, 901).total).toBeGreaterThanOrEqual(599);
    expect(play(1000 / 90, 901).total).toBeLessThanOrEqual(602);
  });

  it('runs the missed steps together on a device that falls to 30 fps', () => {
    const { steps, stats, total } = play(1000 / 30, 301);
    expect(steps.slice(1).every(n => n === 2)).toBe(true);
    expect(total).toBe(601);
    expect(stats.slowFrames).toBe(300);
    expect(stats.lostMs).toBe(0);
  });

  it('catches up a single late frame on a 60 Hz display', () => {
    const stepper = createFrameStepper();
    stepper.stepsFor(0);
    expect(stepper.stepsFor(STEP_MS)).toBe(1);
    expect(stepper.stepsFor(STEP_MS * 3)).toBe(2);
    expect(stepper.stepsFor(STEP_MS * 4)).toBe(1);
  });

  it('caps the catch-up, and counts the time the world lost', () => {
    const stats = emptyFrameStats();
    const stepper = createFrameStepper(stats);
    stepper.stepsFor(0);
    expect(stepper.stepsFor(STEP_MS * 7)).toBe(MAX_STEPS_PER_FRAME);
    expect(stats.lostMs).toBeCloseTo(STEP_MS * 3);
  });

  it('holds through a pause rather than fast-forwarding it', () => {
    const stats = emptyFrameStats();
    const stepper = createFrameStepper(stats);
    stepper.stepsFor(0);
    expect(stepper.stepsFor(5000)).toBe(1);
    expect(stats.pauses).toBe(1);
    expect(stats.lostMs).toBe(0);
    expect(stepper.stepsFor(5000 + STEP_MS)).toBe(1);
  });

  it('reports the time a pause took beyond its one step, so the session can spend it', () => {
    const away: number[] = [];
    const stepper = createFrameStepper(emptyFrameStats(), ms => away.push(ms));
    stepper.stepsFor(0);
    stepper.stepsFor(STEP_MS);
    stepper.stepsFor(STEP_MS + 5000);
    expect(away).toEqual([5000 - STEP_MS]);
  });

  it('starts every run of the loop with one step', () => {
    expect(createFrameStepper().stepsFor(123456)).toBe(1);
  });

  it("reports the display's frame rate", () => {
    expect(medianFrameRate(play(1000 / 60, 120).stats)).toBeCloseTo(60, 0);
    expect(Math.abs(medianFrameRate(play(1000 / 120, 240).stats)! - 120)).toBeLessThan(1);
    expect(medianFrameRate(emptyFrameStats())).toBeNull();
  });
});
