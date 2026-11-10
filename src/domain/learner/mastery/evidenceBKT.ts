import type { ActionLog, EvidenceSource } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { updateMastery } from './buildBKTProfile';

/**
 * The redesign's BKT: the standard 2-state model
 * (Corbett & Anderson, 1995) with its own learn, slip and guess per evidence
 * source, ported from the groupmate's course. One model per learner and
 * competency, updated in time order.
 *
 * It sits beside `buildBKTProfile`, which stays as the frozen design ran it
 * (P(T) = 0.1, one set for every log): the earlier experiments and the goldens reproduce from
 * that one, so it is never changed to match this.
 *
 * The pre-test seeds a competency's starting mastery and teaches nothing
 * (P(T) = 0). The caller keeps out what is not evidence: the tutorial
 * (`bktEvidence` drops Level 0) and the post-test, which never reaches here.
 */
export interface EvidenceParams {
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

export interface EvidenceBKTModel {
  pInit: number;
  drive: EvidenceParams;
  quiz: EvidenceParams;
  pre_test: EvidenceParams;
}

/** Hand-set, fixed before the first participant; fitted to the real answers only after the study. */
export const EVIDENCE_BKT_MODEL: EvidenceBKTModel = {
  pInit: 0.3,
  drive: { pTransit: 0.03, pSlip: 0.1, pGuess: 0.2 },
  // OPEN (carried from the groupmate's code): whether the quiz gives feedback after each answer
  // decides whether a learning step applies during it. Kept on until that is decided.
  quiz: { pTransit: 0.03, pSlip: 0.1, pGuess: 0.25 },
  pre_test: { pTransit: 0, pSlip: 0.1, pGuess: 0.25 },
};

export const evidenceSourceOf = (log: Pick<ActionLog, 'source'>): EvidenceSource => log.source ?? 'drive';

/** A log BKT reads: tagged with a known competency, graded, answered, and not a standing penalty. */
const isEvidence = (log: ActionLog): log is ActionLog & { competency: DrivingCompetency } =>
  !!log.competency &&
  (COMPETENCIES as string[]).includes(log.competency) &&
  log.result !== 'neutral' &&
  !log.unanswered &&
  !log.standing;

const step = (prior: number, correct: boolean, params: EvidenceParams): number =>
  updateMastery(prior, correct, { pInit: prior, ...params });

const startingMastery = (model: EvidenceBKTModel): Record<DrivingCompetency, number> =>
  Object.fromEntries(COMPETENCIES.map(c => [c, model.pInit])) as Record<DrivingCompetency, number>;

/** Every competency's P(L) after replaying `logs` in order. A competency with no evidence stays at `pInit`. */
export const buildEvidenceBKTProfile = (
  logs: readonly ActionLog[],
  model: EvidenceBKTModel = EVIDENCE_BKT_MODEL
): Record<DrivingCompetency, number> => {
  const mastery = startingMastery(model);
  for (const log of logs) {
    if (!isEvidence(log)) continue;
    mastery[log.competency] = step(mastery[log.competency], log.result === 'correct', model[evidenceSourceOf(log)]);
  }
  return mastery;
};

/** One graded answer as BKT read it, for the BKT log and next-answer AUC / RMSE. */
export interface BKTStep {
  timestamp: number;
  competency: DrivingCompetency;
  source: EvidenceSource;
  correct: boolean;
  pBefore: number;
  /** P(correct) predicted before the answer: P(L)(1 - S) + (1 - P(L)) G. */
  predictedCorrect: number;
  /** P(L) given the answer, before the learning step. */
  posterior: number;
  pAfter: number;
  params: EvidenceParams;
  /** Position in the logs passed in. */
  logIndex: number;
  itemId?: string;
}

export const bktTrajectory = (logs: readonly ActionLog[], model: EvidenceBKTModel = EVIDENCE_BKT_MODEL): BKTStep[] => {
  const mastery = startingMastery(model);
  const steps: BKTStep[] = [];
  logs.forEach((log, logIndex) => {
    if (!isEvidence(log)) return;
    const source = evidenceSourceOf(log);
    const params = model[source];
    const pBefore = mastery[log.competency];
    const correct = log.result === 'correct';
    const pAfter = step(pBefore, correct, params);
    mastery[log.competency] = pAfter;
    steps.push({
      timestamp: log.timestamp,
      competency: log.competency,
      source,
      correct,
      pBefore,
      predictedCorrect: pBefore * (1 - params.pSlip) + (1 - pBefore) * params.pGuess,
      posterior: step(pBefore, correct, { ...params, pTransit: 0 }),
      pAfter,
      params,
      logIndex,
      ...(log.itemId ? { itemId: log.itemId } : {}),
    });
  });
  return steps;
};

export interface CompetencyEvidence {
  total: number;
  drive: number;
  quiz: number;
  pre_test: number;
}

/** How much evidence BKT has per competency, by source: `drive` is what the minimum-evidence cap reads. */
export const evidenceCounts = (logs: readonly ActionLog[]): Record<DrivingCompetency, CompetencyEvidence> => {
  const counts = Object.fromEntries(
    COMPETENCIES.map(c => [c, { total: 0, drive: 0, quiz: 0, pre_test: 0 }])
  ) as Record<DrivingCompetency, CompetencyEvidence>;
  for (const log of logs) {
    if (!isEvidence(log)) continue;
    counts[log.competency].total += 1;
    counts[log.competency][evidenceSourceOf(log)] += 1;
  }
  return counts;
};
