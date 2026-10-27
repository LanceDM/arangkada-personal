import type { ActionLog, EvidenceSource } from '@/domain/learner/attempt';
import type { DrivingCompetency, LearnerProfile } from '@/domain/learner/competency';
import { buildLearnerProfile, COMPETENCIES } from '@/domain/learner/profile';

/**
 * Standard 2-state Bayesian Knowledge Tracing (Corbett & Anderson, 1995):
 * prior, learn, guess and slip, no forgetting. One model per learner and
 * competency, updated in time order by every graded answer tagged with that
 * competency.
 */
export interface BKTParams {
  pInit: number;
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

/** The per-observation half of a model: what one answer of a given kind updates with. */
export type BKTEvidenceParams = Pick<BKTParams, 'pTransit' | 'pSlip' | 'pGuess'>;

/**
 * One BKT model with separate guess and slip per item class ("multigs";
 * Bulut et al., 2023): a 4-choice question and a stop-or-go decision on the
 * road are different kinds of evidence.
 *
 * - `drive`: decisions in the simulation, practice and review drives included.
 * - `quiz`: short-quiz answers and retakes.
 * - `diagnostic`: the pre-test. T = 0, because no feedback is given and nothing
 *   is taught during it; the diagnostic only moves the starting value.
 *
 * Post-evaluation exam answers never enter BKT: the exam is the outcome that is
 * independent of the models.
 */
export interface BKTModel {
  pInit: number;
  drive: BKTEvidenceParams;
  quiz: BKTEvidenceParams;
  diagnostic: BKTEvidenceParams;
}

/**
 * TENTATIVE values, until the pilot group (5-10 people, kept out of the main
 * study) fits T and S by grid search and the driving guess rate. Sources:
 *
 * - pInit 0.30: the starting point before the diagnostic; the diagnostic then
 *   sets each learner's own starting value per competency.
 * - T 0.10, S 0.10: inside the bounds Zhang et al. (2025) report; to be refit.
 *   Sensitivity runs at S = 0.05 and 0.15.
 * - G 0.25 for quiz and diagnostic items: 1/k for 4-choice items.
 * - G 0.20 for driving decisions: a placeholder; fitted on the pilot, because
 *   it depends on how many options a decision really has.
 *
 * G and S stay well below 0.5 to avoid model degeneracy (Baker et al., 2008).
 * No value here comes from simulated learners.
 */
export const DEFAULT_BKT_MODEL: BKTModel = {
  pInit: 0.3,
  drive: { pTransit: 0.1, pSlip: 0.1, pGuess: 0.2 },
  // OPEN: whether the quiz shows feedback after each answer decides whether
  // the learning step applies during the quiz. Kept on until that is decided.
  quiz: { pTransit: 0.1, pSlip: 0.1, pGuess: 0.25 },
  diagnostic: { pTransit: 0, pSlip: 0.1, pGuess: 0.25 },
};

/**
 * The drive-only parameter set, for callers that replay driving decisions
 * alone (decision telemetry). Equal to `DEFAULT_BKT_MODEL.drive` with its prior.
 */
export const DEFAULT_BKT_PARAMS: BKTParams = {
  pInit: DEFAULT_BKT_MODEL.pInit,
  ...DEFAULT_BKT_MODEL.drive,
};

/** Where an answer came from; a log written before sources existed is a driving decision. */
export const evidenceSourceOf = (log: Pick<ActionLog, 'source'>): EvidenceSource => log.source ?? 'drive';

/** The parameters one answer is updated with. */
export const paramsForSource = (model: BKTModel, source: EvidenceSource): BKTEvidenceParams | null =>
  source === 'post_exam' ? null : model[source];

/**
 * One Bayesian update step: infer the posterior probability of mastery given
 * this observation, then apply the chance the skill was learned on this
 * opportunity. Unlike a cumulative accuracy average, a run of recent correct
 * answers can pull mastery back up even after an earlier run of mistakes.
 */
export const updateMastery = (
  priorMastery: number,
  isCorrect: boolean,
  params: BKTEvidenceParams = DEFAULT_BKT_MODEL.drive
): number => {
  const { pTransit, pSlip, pGuess } = params;

  const posterior = isCorrect
    ? (priorMastery * (1 - pSlip)) / (priorMastery * (1 - pSlip) + (1 - priorMastery) * pGuess)
    : (priorMastery * pSlip) / (priorMastery * pSlip + (1 - priorMastery) * (1 - pGuess));

  return posterior + (1 - posterior) * pTransit;
};

const asModel = (params: BKTModel | BKTParams): BKTModel =>
  'drive' in params
    ? params
    : {
        pInit: params.pInit,
        drive: params,
        quiz: params,
        diagnostic: { ...params, pTransit: 0 },
      };

/** Whether a log is graded evidence BKT reads: a tagged, non-neutral answer from a source that feeds the model. */
const isBKTEvidence = (log: ActionLog): log is ActionLog & { competency: DrivingCompetency } =>
  !!log.competency &&
  (COMPETENCIES as string[]).includes(log.competency) &&
  log.result !== 'neutral' &&
  evidenceSourceOf(log) !== 'post_exam';

/**
 * Replays `logs` in order, updating a per-competency mastery probability.
 * A competency with no evidence stays at `pInit` - "not yet demonstrated", not
 * "fine". Neutral logs and post-exam answers are skipped. The tutorial is kept
 * out by the caller (`historyLogs` leaves Level 0 out of the stream), because
 * its steps teach the controls, not a competency.
 *
 * Accepts a single `BKTParams` set too, applied to every source.
 */
export const buildBKTProfile = (
  logs: ActionLog[],
  params: BKTModel | BKTParams = DEFAULT_BKT_MODEL
): Record<DrivingCompetency, number> => {
  const model = asModel(params);
  const mastery = COMPETENCIES.reduce((acc, competency) => {
    acc[competency] = model.pInit;
    return acc;
  }, {} as Record<DrivingCompetency, number>);

  for (const log of logs) {
    if (!isBKTEvidence(log)) continue;
    const evidence = paramsForSource(model, evidenceSourceOf(log));
    if (!evidence) continue;
    mastery[log.competency] = updateMastery(mastery[log.competency], log.result === 'correct', evidence);
  }

  return mastery;
};

/** How much evidence BKT has seen per competency, by source. */
export interface CompetencyEvidence {
  total: number;
  drive: number;
  quiz: number;
  diagnostic: number;
}

export const buildBKTEvidence = (logs: ActionLog[]): Record<DrivingCompetency, CompetencyEvidence> => {
  const evidence = COMPETENCIES.reduce((acc, competency) => {
    acc[competency] = { total: 0, drive: 0, quiz: 0, diagnostic: 0 };
    return acc;
  }, {} as Record<DrivingCompetency, CompetencyEvidence>);
  for (const log of logs) {
    if (!isBKTEvidence(log)) continue;
    const source = evidenceSourceOf(log);
    if (source === 'post_exam') continue;
    evidence[log.competency].total += 1;
    evidence[log.competency][source] += 1;
  }
  return evidence;
};

/**
 * A LearnerProfile whose `.score` comes from BKT mastery instead of a
 * cumulative-average score. Keeps `attempts`/`correct`/`violations`
 * bookkeeping from `buildLearnerProfile` intact, on the same 0-100 scale, so
 * every existing threshold comparison keeps working - only how the score is
 * computed changes.
 */
export const buildBKTLearnerProfile = (logs: ActionLog[], params: BKTModel | BKTParams = DEFAULT_BKT_MODEL): LearnerProfile => {
  const profile = buildLearnerProfile(logs);
  const mastery = buildBKTProfile(logs, params);

  for (const competency of COMPETENCIES) {
    profile[competency].score = Math.round(mastery[competency] * 100);
  }

  return profile;
};
