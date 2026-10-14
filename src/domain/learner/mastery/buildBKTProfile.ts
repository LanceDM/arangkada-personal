import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency, LearnerProfile } from '@/domain/learner/competency';
import { buildLearnerProfile, COMPETENCIES } from '@/domain/learner/profile';

/**
 * Standard 2-state Bayesian Knowledge Tracing parameters (Corbett & Anderson
 * style). One shared set applied uniformly across all competencies for now -
 * per-competency calibration (e.g. via EM against real attempt data) is
 * future work, not needed to validate the model against simulated learners.
 */
export interface BKTParams {
  pInit: number;
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

export const DEFAULT_BKT_PARAMS: BKTParams = {
  pInit: 0.3,
  pTransit: 0.1,
  pSlip: 0.1,
  pGuess: 0.2,
};

/**
 * One Bayesian update step: infer the posterior probability of mastery given
 * this observation, then apply the chance the skill was learned on this
 * opportunity. Unlike a cumulative accuracy average, a run of recent correct
 * answers can pull mastery back up even after an earlier run of mistakes.
 */
export const updateMastery = (
  priorMastery: number,
  isCorrect: boolean,
  params: BKTParams = DEFAULT_BKT_PARAMS
): number => {
  const { pTransit, pSlip, pGuess } = params;

  const posterior = isCorrect
    ? (priorMastery * (1 - pSlip)) / (priorMastery * (1 - pSlip) + (1 - priorMastery) * pGuess)
    : (priorMastery * pSlip) / (priorMastery * pSlip + (1 - priorMastery) * (1 - pGuess));

  return posterior + (1 - posterior) * pTransit;
};

/**
 * Replays `logs` in order, updating a per-competency mastery probability.
 * Mirrors `buildLearnerProfile`'s `(logs) => ...` shape so it's a drop-in
 * alternative mastery signal over the same input. A competency with no logs
 * stays at `pInit` - "not yet demonstrated", not "fine" (unlike the raw
 * cumulative score, which defaults an untouched competency to a full 100).
 */
export const buildBKTProfile = (
  logs: ActionLog[],
  params: BKTParams = DEFAULT_BKT_PARAMS
): Record<DrivingCompetency, number> => {
  const mastery = COMPETENCIES.reduce((acc, competency) => {
    acc[competency] = params.pInit;
    return acc;
  }, {} as Record<DrivingCompetency, number>);

  for (const log of logs) {
    const competency = log.competency as DrivingCompetency | undefined;
    if (!competency || !(competency in mastery)) continue;

    mastery[competency] = updateMastery(mastery[competency], log.result === 'correct', params);
  }

  return mastery;
};

/**
 * A LearnerProfile whose `.score` comes from BKT mastery instead of a
 * cumulative-average score. Keeps `attempts`/`correct`/`violations`
 * bookkeeping from `buildLearnerProfile` intact (needed by
 * `getWeakestCompetency`'s `attempts > 0` filter and `getLevelRecommendation`),
 * on the same 0-100 scale, so every existing threshold comparison
 * (`isMastered`, `countWeakCompetencies`, `getMasteryState` in
 * `LevelComplete.tsx`) keeps working unmodified - only how the score is
 * computed changes.
 */
export const buildBKTLearnerProfile = (logs: ActionLog[], params: BKTParams = DEFAULT_BKT_PARAMS): LearnerProfile => {
  const profile = buildLearnerProfile(logs);
  const mastery = buildBKTProfile(logs, params);

  for (const competency of COMPETENCIES) {
    profile[competency].score = Math.round(mastery[competency] * 100);
  }

  return profile;
};
