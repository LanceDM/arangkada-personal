// The per-competency verdict on one drive: each competency the drive counted
// is passed when at least 2 of its 3 scenarios were answered correctly
// (TENTATIVE, decided 2026-10-28). This replaces the single drive pass mark,
// which let a stage pass while one of its competencies failed.
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { DRIVE_PASS_CORRECT } from '@/domain/learner/stageCompetencies';

export interface CountedScenario {
  competency: DrivingCompetency;
  scenarioId: string;
}

export interface CompetencyVerdict {
  competency: DrivingCompetency;
  /** Scenarios counted for it in this drive (3). */
  total: number;
  correct: number;
  /** Counted scenarios the drive never graded (a crash ended the run first): counted as not correct. */
  ungraded: number;
  passed: boolean;
  /** Share correct, for the reward's A_next. */
  accuracy: number;
}

/**
 * Reads the drive's logs against the scenarios it counted. A scenario's first
 * graded decision is its answer; standing penalties and route-bound scenarios
 * that were not counted are ignored here (they still reach BKT).
 */
export const competencyVerdicts = (
  counted: readonly CountedScenario[],
  logs: readonly ActionLog[],
  passCorrect = DRIVE_PASS_CORRECT
): CompetencyVerdict[] => {
  const firstAnswer = new Map<string, ActionLog>();
  for (const log of logs) {
    if (log.scenarioId && log.result !== 'neutral' && !firstAnswer.has(log.scenarioId)) firstAnswer.set(log.scenarioId, log);
  }
  const byCompetency = new Map<DrivingCompetency, CompetencyVerdict>();
  for (const { competency, scenarioId } of counted) {
    const verdict = byCompetency.get(competency) ?? { competency, total: 0, correct: 0, ungraded: 0, passed: false, accuracy: 0 };
    const answer = firstAnswer.get(scenarioId);
    verdict.total += 1;
    if (!answer) verdict.ungraded += 1;
    else if (answer.result === 'correct') verdict.correct += 1;
    byCompetency.set(competency, verdict);
  }
  return [...byCompetency.values()].map(verdict => ({
    ...verdict,
    passed: verdict.correct >= Math.min(passCorrect, verdict.total),
    accuracy: verdict.total > 0 ? verdict.correct / verdict.total : 0,
  }));
};
