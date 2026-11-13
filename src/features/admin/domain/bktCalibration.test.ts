import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { CALIBRATION_MINIMUMS, calibrateBkt, calibrationProgress } from './bktCalibration';

/** A seeded generator, so the made-up answers below are the same on every run. These test the estimator only. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Players answering as a known BKT model says they would. */
const answersFrom = (players: number, start: (competency: string) => number, perStage = { diagnostic: 5, quiz: 6, drive: 6 }, seed = 7) => {
  const rng = seeded(seed);
  const truth = { diagnostic: { t: 0, s: 0.1, g: 0.25 }, quiz: { t: 0.05, s: 0.1, g: 0.25 }, drive: { t: 0.05, s: 0.2, g: 0.1 } };
  const rows: Record<string, unknown>[] = [];
  for (let player = 0; player < players; player++) {
    let userSeq = 0;
    for (const competency of COMPETENCIES) {
      let knows = rng() < start(competency);
      for (const source of ['diagnostic', 'quiz', 'drive'] as const) {
        const { t, s, g } = truth[source];
        for (let i = 0; i < perStage[source]; i++) {
          const correct = rng() < (knows ? 1 - s : g);
          rows.push({ uid: `u${player}`, competency, source, correct, predictedCorrect: 0.5, userSeq: ++userSeq });
          if (!knows && rng() < t) knows = true;
        }
      }
    }
  }
  return rows;
};

describe('the BKT calibration', () => {
  it('fits nothing, and says what is missing, on too little data', () => {
    const result = calibrateBkt(answersFrom(3, () => 0.3));
    expect(result.players).toBe(3);
    expect(result.ready).toBe(false);
    expect(result.slipChoice).toBeNull();
    expect(result.starts.every(s => s.estimate === null && s.value === DEFAULT_BKT_MODEL.pInit)).toBe(true);
    expect(result.missing[0]).toContain(`fewer than ${CALIBRATION_MINIMUMS.playersPerCompetency} players`);
    // The learn rate has enough quiz and drive answers even here; the starts do not.
    expect(result.model.pInitBy).toEqual({});
    expect(result.model.diagnostic).toEqual(DEFAULT_BKT_MODEL.diagnostic);
  });

  it('recovers a group start per competency, and fits no worse than the current values', () => {
    const high = COMPETENCIES[0];
    const result = calibrateBkt(answersFrom(120, c => (c === high ? 0.45 : 0.1)), uid => uid.toUpperCase());
    expect(result.ready).toBe(true);
    const starts = new Map(result.starts.map(s => [s.competency, s]));
    expect(starts.get(high)!.estimate!).toBeGreaterThan(0.3);
    expect(starts.get(COMPETENCIES[1])!.estimate!).toBeLessThan(0.25);
    expect(starts.get(high)!.players).toBe(120);
    expect(result.slipChoice!).toBeGreaterThanOrEqual(0.01);
    expect(result.slipChoice!).toBeLessThanOrEqual(0.3);
    expect(result.learn!).toBeLessThanOrEqual(0.1);
    // The drive answers were made with a higher slip and a lower guess than the 4-choice ones.
    expect(result.slipDrive!).toBeGreaterThan(result.guessDrive!);
    expect(result.model.pInitBy![high]).toBe(starts.get(high)!.estimate);
    expect(result.model.diagnostic.pGuess).toBe(0.25);
    expect(result.model.diagnostic.pTransit).toBe(0);
    expect(result.model.drive.pGuess + result.model.drive.pSlip).toBeLessThan(1);
    expect(result.calibrated.logLik!).toBeGreaterThanOrEqual(result.current.logLik!);
    expect(result.calibrated.n).toBe(result.answers);
    // A learn rate per player can only fit the same answers as well or better.
    expect(result.perPlayerLearn.fitted).toBe(120);
    expect(result.perPlayerLearn.fit.logLik!).toBeGreaterThanOrEqual(result.calibrated.logLik! - 1e-9);
    expect(result.perPlayerLearn.rates[0].label).toMatch(/^U\d+$/);
  }, 60_000);

  it('gives the same result for the same answers', () => {
    const rows = answersFrom(15, () => 0.3);
    expect(calibrateBkt(rows).model).toEqual(calibrateBkt(rows).model);
  }, 60_000);
});

describe('the calibration stage', () => {
  const player = (diagnostic: number) => ({ evidence: Object.fromEntries(COMPETENCIES.map(c => [c, { diagnostic }])) });
  it('moves from collecting to ready once every competency has enough pre-tests, and to calibrated only by the code', () => {
    const few = Array.from({ length: 3 }, () => player(5));
    expect(calibrationProgress(few, { stage: 'collecting', appliedOn: null })).toMatchObject({ step: 1, preTestPlayers: 3, competenciesReady: 0, competencies: 11 });
    const enough = [...Array.from({ length: CALIBRATION_MINIMUMS.playersPerCompetency }, () => player(5)), player(0)];
    expect(calibrationProgress(enough, { stage: 'collecting', appliedOn: null })).toMatchObject({ step: 2, preTestPlayers: 10, competenciesReady: 11 });
    expect(calibrationProgress(few, { stage: 'calibrated', appliedOn: '2026-12-01' })).toMatchObject({ step: 3, appliedOn: '2026-12-01' });
  });
});
