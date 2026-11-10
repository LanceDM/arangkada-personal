import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { DEFAULT_BKT_PARAMS, buildBKTProfile } from './buildBKTProfile';
import { EVIDENCE_BKT_MODEL, buildEvidenceBKTProfile, bktTrajectory, evidenceCounts } from './evidenceBKT';

const log = (result: 'correct' | 'violation', extra: Partial<ActionLog> = {}): ActionLog => ({
  timestamp: 0, action: 'a', result, points: 0, competency: 'road_signs', ...extra,
});

describe('evidenceBKT', () => {
  it('starts every competency at pInit', () => {
    expect(buildEvidenceBKTProfile([]).road_signs).toBe(EVIDENCE_BKT_MODEL.pInit);
  });

  it('seeds from the pre-test with no learning step', () => {
    const [s] = bktTrajectory([log('correct', { source: 'pre_test' })]);
    expect(s.params.pTransit).toBe(0);
    expect(s.pAfter).toBeCloseTo(s.posterior, 12);
    expect(s.pAfter).toBeGreaterThan(EVIDENCE_BKT_MODEL.pInit);
  });

  it('applies the learning step to drives, and reads a log with no source as a drive', () => {
    const [s] = bktTrajectory([log('violation')]);
    expect(s.source).toBe('drive');
    expect(s.pAfter).toBeGreaterThan(s.posterior);
  });

  it('skips what is not evidence: unanswered, standing, neutral, untagged', () => {
    const skipped: ActionLog[] = [
      log('correct', { unanswered: true }),
      log('correct', { standing: true }),
      { ...log('correct'), result: 'neutral' },
      { ...log('correct'), competency: undefined },
    ];
    expect(bktTrajectory(skipped)).toHaveLength(0);
    expect(evidenceCounts(skipped).road_signs.total).toBe(0);
  });

  it('counts evidence by source', () => {
    const c = evidenceCounts([log('correct', { source: 'pre_test' }), log('correct', { source: 'quiz' }), log('correct')]);
    expect(c.road_signs).toEqual({ total: 3, drive: 1, quiz: 1, pre_test: 1 });
  });

  it('leaves the frozen design\'s BKT exactly as it was', () => {
    expect(DEFAULT_BKT_PARAMS).toEqual({ pInit: 0.3, pTransit: 0.1, pSlip: 0.1, pGuess: 0.2 });
    expect(buildBKTProfile([log('correct', { source: 'quiz' })]).road_signs).toBeCloseTo(
      buildBKTProfile([log('correct')]).road_signs, 12
    );
  });
});
