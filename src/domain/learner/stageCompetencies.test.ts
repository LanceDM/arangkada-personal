import { describe, expect, it } from 'vitest';
import {
  ALL_COMPETENCIES,
  COMPETENCY_STAGES,
  MIN_STAGES_PER_COMPETENCY,
  STAGE_COMPETENCIES,
  introStageOf,
  stagesOf,
} from './stageCompetencies';

describe('the competency spread', () => {
  it('puts every competency in at least 3 stages of L1-L11', () => {
    for (const competency of ALL_COMPETENCIES) {
      expect(stagesOf(competency).length, competency).toBeGreaterThanOrEqual(MIN_STAGES_PER_COMPETENCY);
    }
  });

  it('matches the placement table of 2026-10-28', () => {
    expect(stagesOf('driver_legality')).toEqual([1, 10, 11]);
    expect(stagesOf('document_awareness')).toEqual([1, 2, 10, 11]);
    expect(stagesOf('right_of_way')).toEqual([2, 5, 6, 7, 8]);
    expect(stagesOf('traffic_signals')).toEqual([3, 5, 6, 8, 10]);
    expect(stagesOf('road_signs')).toEqual([3, 5, 6, 7]);
    expect(stagesOf('parking')).toEqual([6, 7, 9, 11]);
    expect(stagesOf('speed_control')).toEqual([2, 3, 4, 7, 10]);
  });

  it('introduces parking at L6, where its module teaches it (L5 and L6 are not swapped)', () => {
    expect(introStageOf('parking')).toBe(6);
  });

  it('lists no competency twice in a stage', () => {
    for (const stage of COMPETENCY_STAGES) {
      expect(new Set(STAGE_COMPETENCIES[stage]).size).toBe(STAGE_COMPETENCIES[stage].length);
    }
  });
});
