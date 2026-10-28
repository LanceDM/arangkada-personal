import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  DEFAULT_BKT_MODEL,
  buildBKTEvidence,
  buildBKTProfile,
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

  it('never reads post-exam answers, neutral logs or untagged logs', () => {
    const mastery = buildBKTProfile([
      log('parking', true, { source: 'post_exam' }),
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
    expect(evidence.parking).toEqual({ total: 3, drive: 1, quiz: 1, diagnostic: 1 });
  });
});
