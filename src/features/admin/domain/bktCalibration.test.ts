import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { CALIBRATION_MINIMUMS, HELD_OUT_TEST, calibrateBkt, calibrationProgress, calibrationRecord, canApply, sensitivityCheck } from './bktCalibration';
import { NO_CALIBRATION } from '@/domain/learner/mastery/bktValueSets';

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
    expect(result.startRule).toBe('kept');
    expect(result.sharedStart).toBeNull();
    expect(result.missing[0]).toContain(`the starting value needs ${CALIBRATION_MINIMUMS.playersPerCompetency}`);
    // The learn rate has enough quiz and drive answers even here; the starts do not.
    expect(result.model.pInitBy).toBeUndefined();
    expect(result.model.pInit).toBe(DEFAULT_BKT_MODEL.pInit);
    expect(result.model.diagnostic).toEqual(DEFAULT_BKT_MODEL.diagnostic);
  });

  it('recovers a group start per competency, and fits no worse than the current values', () => {
    const high = COMPETENCIES[0];
    const result = calibrateBkt(answersFrom(120, c => (c === high ? 0.45 : 0.1)), uid => uid.toUpperCase());
    expect(result.ready).toBe(true);
    expect(result.startRule).toBe('per_competency');
    expect(result.sharedStart!).toBeGreaterThan(0.05);
    expect(result.sharedStart!).toBeLessThan(0.3);
    const starts = new Map(result.starts.map(s => [s.competency, s]));
    expect(starts.get(high)!.estimate!).toBeGreaterThan(0.3);
    expect(starts.get(COMPETENCIES[1])!.estimate!).toBeLessThan(0.25);
    expect(starts.get(high)!.players).toBe(120);
    expect(result.slipChoice!).toBeGreaterThanOrEqual(0.01);
    expect(result.slipChoice!).toBeLessThanOrEqual(0.3);
    expect(result.learn!).toBeLessThanOrEqual(0.1);
    // The guesses are not fitted: they stay as in force.
    expect(result.slipDrive!).toBeGreaterThanOrEqual(0.01);
    expect(result.model.drive.pGuess).toBe(DEFAULT_BKT_MODEL.drive.pGuess);
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
    // The held-out test: everyone learns at the same rate here, so a rate per player must not pass.
    const held = result.perPlayerLearn.heldOut;
    expect(held.players).toBe(120);
    expect(held.answers).toBeGreaterThan(0);
    expect(held.answers).toBeLessThan(result.bySource.quiz + result.bySource.drive);
    expect(held.interval![0]).toBeLessThanOrEqual(held.improvement!);
    expect(held.improvement!).toBeLessThan(HELD_OUT_TEST.rmseMargin);
    expect(held.adopt).toBe(false);
  }, 60_000);

  it('falls back to one shared start when some competencies have too few pre-tests', () => {
    const rows = answersFrom(9, () => 0.3).filter(
      row => !(row.competency === COMPETENCIES[0] && row.source === 'diagnostic' && Number(String(row.uid).slice(1)) >= 4)
    );
    const result = calibrateBkt(rows);
    expect(result.startRule).toBe('shared');
    expect(result.sharedStart).not.toBeNull();
    expect(result.model.pInit).toBe(result.sharedStart);
    expect(result.model.pInitBy).toEqual({});
    expect(result.starts.every(s => s.value === result.sharedStart)).toBe(true);
    expect(result.starts[0].estimate).toBeNull();
    expect(result.starts[1].estimate).not.toBeNull();
    expect(result.missing.join(' ')).toContain('one shared start is used');
  }, 60_000);

  it('fits on the players marked pilot only, whatever set they ran on, and leaves the post-test out', () => {
    const rows = answersFrom(9, () => 0.3);
    const pilots = new Set(rows.map(row => String(row.uid)));
    const withOthers = [
      ...rows.map(row => ({ ...row, modelSet: 'cal-1' })),
      // Test playthroughs, not marked.
      ...rows.map(row => ({ ...row, uid: `t${row.uid}` })),
      ...rows.filter(row => row.source === 'diagnostic').map(row => ({ ...row, source: 'post_exam', userSeq: Number(row.userSeq) + 10_000 })),
    ];
    const plain = calibrateBkt(rows);
    const result = calibrateBkt(withOthers, undefined, undefined, pilots);
    expect(result.players).toBe(9);
    expect(result.answers).toBe(plain.answers);
    expect(result.bySource.post_exam).toBe(0);
    expect(result.excluded).toEqual({ postTest: 9 * 11 * 5, notPilot: rows.length });
    expect(result.model).toEqual(plain.model);
    expect(canApply(result)).toBe(true);
    expect(canApply(calibrateBkt(withOthers, undefined, undefined, new Set(['u0'])))).toBe(false);
  }, 60_000);

  it('saves the values with the log of how they were reached', () => {
    const rows = answersFrom(9, () => 0.3);
    const result = calibrateBkt(rows);
    const record = calibrationRecord({
      result,
      sensitivity: sensitivityCheck(rows).rows,
      pilots: [{ uid: 'u0', label: 'P-0001' }],
      state: NO_CALIBRATION,
      note: '  first calibration  ',
      settingsVersion: 'v',
    });
    expect(record.basedOn).toBe('default');
    expect(record.model).toEqual(result.model);
    expect(record.fixed).toEqual({ guessChoice: 0.25, guessDrive: DEFAULT_BKT_MODEL.drive.pGuess, learnTests: 0 });
    expect(record.fit.before).toEqual(result.current);
    expect(record.sensitivity).toHaveLength(5);
    expect(record.note).toBe('first calibration');
    expect(JSON.parse(JSON.stringify(record)).starts).toHaveLength(11);
  }, 60_000);

  it('gives the same result for the same answers', () => {
    const rows = answersFrom(15, () => 0.3);
    expect(calibrateBkt(rows).model).toEqual(calibrateBkt(rows).model);
  }, 60_000);
});

describe('the calibration stage', () => {
  const player = (uid: string, diagnostic: number) => ({ uid, evidence: Object.fromEntries(COMPETENCIES.map(c => [c, { diagnostic }])) });
  it('counts only marked players, and is ready once enough of them have pre-tests', () => {
    const players = Array.from({ length: 9 }, (_, i) => player(`u${i}`, i === 8 ? 0 : 5));
    const few = new Set(['u0', 'u1', 'u2']);
    expect(calibrationProgress(players, few, NO_CALIBRATION)).toMatchObject({ step: 1, marked: 3, markedWithPreTest: 3, competenciesReady: 0, inForce: 'Default values', number: 0 });
    const enough = new Set(players.map(p => p.uid));
    expect(calibrationProgress(players, enough, NO_CALIBRATION)).toMatchObject({ step: 2, marked: 9, markedWithPreTest: CALIBRATION_MINIMUMS.playersPerCompetency + 1, competenciesReady: 11 });
    expect(calibrationProgress(players, few, { activeSetId: 'cal-2', number: 2, appliedAt: 5, appliedBy: 'a' })).toMatchObject({ inForce: 'Calibration 2', number: 2, appliedAt: 5 });
  });
});

describe('the sensitivity check', () => {
  it('replays the answers with nearby values and counts the mastery levels that move', () => {
    const rows = answersFrom(20, () => 0.3);
    const result = sensitivityCheck(rows);
    expect(result.pairs).toBe(20 * 11);
    expect(result.rows.map(r => r.label)).toEqual(['Values in force', 'Start 0.10', 'Start 0.50', 'Slip − 0.05', 'Slip + 0.05']);
    expect(result.rows[0].levelsChanged).toBe(0);
    expect(result.rows[0].fit.n).toBe(rows.length);
    for (const row of result.rows.slice(1)) {
      expect(row.levelsChanged!).toBeGreaterThanOrEqual(0);
      expect(row.levelsChanged!).toBeLessThanOrEqual(1);
    }
    // The ceiling caps the raised slip: at 0.1 it cannot go above the value in force.
    const capped = sensitivityCheck(rows, DEFAULT_BKT_MODEL, 0.1);
    expect(capped.rows[4].levelsChanged).toBe(0);
    expect(sensitivityCheck([]).rows[0].levelsChanged).toBeNull();
  });
});
