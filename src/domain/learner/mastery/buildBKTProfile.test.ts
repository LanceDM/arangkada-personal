import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  DEFAULT_BKT_MODEL,
  buildBKTEvidence,
  buildBKTProfile,
  bktTrajectory,
  updateMastery,
} from './buildBKTProfile';

const log = (competency: DrivingCompetency, correct: boolean, extra: Partial<ActionLog> = {}): ActionLog => ({
  timestamp: 0,
  action: 'x',
  result: correct ? 'correct' : 'violation',
  points: 0,
  competency,
  ...extra,
});

describe('BKT with separate guess and slip per item class', () => {
  it('starts every competency at the prior', () => {
    const mastery = buildBKTProfile([]);
    expect(mastery.parking).toBe(DEFAULT_BKT_MODEL.pInit);
  });

  it('updates a quiz answer with the quiz guess rate, not the driving one', () => {
    const quiz = buildBKTProfile([log('parking', true, { source: 'quiz' })]).parking;
    const drive = buildBKTProfile([log('parking', true)]).parking;
    expect(quiz).toBeCloseTo(updateMastery(0.3, true, DEFAULT_BKT_MODEL.quiz), 10);
    expect(drive).toBeCloseTo(updateMastery(0.3, true, DEFAULT_BKT_MODEL.drive), 10);
    // A right answer to a 4-choice question is weaker evidence than a right
    // decision on the road at G = 0.20.
    expect(quiz).toBeLessThan(drive);
  });

  it('applies no learning step during the diagnostic', () => {
    const after = buildBKTProfile([log('road_signs', true, { source: 'diagnostic' })]).road_signs;
    const posterior = (0.3 * 0.9) / (0.3 * 0.9 + 0.7 * 0.25);
    expect(after).toBeCloseTo(posterior, 10);
  });

  it('matches the worked diagnostic figures: 3 of 5 about 0.26, 4 of 5 about 0.91', () => {
    const run = (pattern: boolean[]) =>
      buildBKTProfile(pattern.map(correct => log('pedestrians', correct, { source: 'diagnostic' }))).pedestrians;
    expect(run([true, true, true, false, false])).toBeCloseTo(0.26, 2);
    expect(run([true, true, true, true, false])).toBeCloseTo(0.91, 2);
  });

  it('reads post-exam answers with no learning step', () => {
    const after = buildBKTProfile([log('parking', true, { source: 'post_exam' })]).parking;
    expect(after).toBeCloseTo(updateMastery(0.3, true, DEFAULT_BKT_MODEL.post_exam), 10);
    expect(DEFAULT_BKT_MODEL.post_exam.pTransit).toBe(0);
  });

  it('keeps every item class non-degenerate: G and S below 0.5, G + S below 1', () => {
    for (const cls of [DEFAULT_BKT_MODEL.drive, DEFAULT_BKT_MODEL.quiz, DEFAULT_BKT_MODEL.diagnostic, DEFAULT_BKT_MODEL.post_exam]) {
      expect(cls.pGuess).toBeLessThan(0.5);
      expect(cls.pSlip).toBeLessThan(0.5);
      expect(cls.pGuess + cls.pSlip).toBeLessThan(1);
      // A right answer raises mastery and a wrong one lowers it, at any prior.
      for (const p of [0.05, 0.3, 0.6, 0.9]) {
        expect(updateMastery(p, true, { ...cls, pTransit: 0 })).toBeGreaterThan(p);
        expect(updateMastery(p, false, { ...cls, pTransit: 0 })).toBeLessThan(p);
      }
    }
  });

  it('never reads a question whose time ran out', () => {
    const mastery = buildBKTProfile([log('right_of_way', false, { questionTimedOut: true })]);
    expect(mastery.right_of_way).toBe(DEFAULT_BKT_MODEL.pInit);
  });

  it('never reads neutral logs or untagged logs', () => {
    const mastery = buildBKTProfile([
      { ...log('parking', true), result: 'neutral' },
      { ...log('parking', true), competency: undefined },
    ]);
    expect(mastery.parking).toBe(DEFAULT_BKT_MODEL.pInit);
  });

  it('counts evidence per source', () => {
    const evidence = buildBKTEvidence([
      log('parking', true, { source: 'diagnostic' }),
      log('parking', false, { source: 'quiz' }),
      log('parking', true),
      log('parking', true, { source: 'post_exam' }),
    ]);
    expect(evidence.parking).toEqual({ total: 4, drive: 1, quiz: 1, diagnostic: 1, post_exam: 1 });
  });

  it('replays step by step to the same final mastery, with each prediction made before the answer', () => {
    const logs = [
      log('parking', true, { source: 'diagnostic' }),
      log('parking', false),
      log('road_signs', true, { source: 'quiz', itemId: 'q1' }),
      log('parking', true, { source: 'post_exam' }),
    ];
    const steps = bktTrajectory(logs);
    expect(steps).toHaveLength(4);
    expect(steps[0].predictedCorrect).toBeCloseTo(0.3 * 0.9 + 0.7 * 0.25, 10);
    expect(steps[1].pBefore).toBe(steps[0].pAfter);
    expect(steps[2]).toMatchObject({ competency: 'road_signs', source: 'quiz', itemId: 'q1', pBefore: 0.3 });
    expect(steps[3].pAfter).toBeCloseTo(buildBKTProfile(logs).parking, 12);
  });
});
