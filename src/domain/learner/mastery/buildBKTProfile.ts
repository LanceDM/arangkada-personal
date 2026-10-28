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
 * - `post_exam`: the post-evaluation exam. Like the diagnostic: no feedback, so
 *   T = 0. Its answers update each learner's final mastery (Lance, 2026-10-28,
 *   reversing the earlier exclusion). IRT scoring of the exam is separate and
 *   is not part of this model.
 */
export interface BKTModel {
  pInit: number;
  drive: BKTEvidenceParams;
  quiz: BKTEvidenceParams;
  diagnostic: BKTEvidenceParams;
  post_exam: BKTEvidenceParams;
}

/**
 * TENTATIVE defaults taken from published studies, because no study data
 * exists yet to fit them (no pilot fitting for now; no value here comes from
 * simulated learners). To be discussed: where the real values come from.
 *
 * - pInit 0.30: inside the fitting bounds of Zhang et al. (2025), P(L0)
 *   0.001-0.5. It is only the value before the diagnostic; the diagnostic's
 *   answers then move each learner's own starting value per competency.
 * - T 0.03 per opportunity: the fitted learn rates of Zhang, Pradhan, Lee,
 *   Pei, Sales & Ottmar (JEDM, perceptual scaffolding study) run 0.014-0.038
 *   across conditions; 0.03 sits in that range and inside Zhang et al. (2025)'s
 *   0.001-0.1 bound. T = 0 for the diagnostic and post-exam (no feedback).
 * - S 0.10: the low end of the slips fitted by Zhang, Pradhan et al.
 *   (0.107-0.243) and inside Zhang et al. (2025)'s 0.01-0.3 bound.
 * - G 0.25 for 4-choice items (quiz, diagnostic, post-exam): 1/k, which is
 *   also the prior mean Zhang, Pradhan et al. place on guess.
 * - G 0.20 for driving decisions: inside the 0.01-0.3 bound; how many real
 *   options a decision has is not known yet.
 *
 * Every class keeps G and S below 0.5 (Zhang, Pradhan et al.; Baker et al.,
 * 2008) and G + S < 1, the non-degeneracy constraint of Shchepakin,
 * Sankaranarayanan & Zimmaro (2024), so a right answer always raises mastery
 * and a wrong one always lowers it.
 */
export const DEFAULT_BKT_MODEL: BKTModel = {
  pInit: 0.3,
  drive: { pTransit: 0.03, pSlip: 0.1, pGuess: 0.2 },
  // OPEN: whether the quiz shows feedback after each answer decides whether
  // the learning step applies during the quiz. Kept on until that is decided.
  quiz: { pTransit: 0.03, pSlip: 0.1, pGuess: 0.25 },
  diagnostic: { pTransit: 0, pSlip: 0.1, pGuess: 0.25 },
  post_exam: { pTransit: 0, pSlip: 0.1, pGuess: 0.25 },
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
export const paramsForSource = (model: BKTModel, source: EvidenceSource): BKTEvidenceParams => model[source];

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
        post_exam: { ...params, pTransit: 0 },
      };

/** Whether a log is graded evidence BKT reads: a tagged, non-neutral answer from a source that feeds the model. */
const isBKTEvidence = (log: ActionLog): log is ActionLog & { competency: DrivingCompetency } =>
  !!log.competency &&
  (COMPETENCIES as string[]).includes(log.competency) &&
  log.result !== 'neutral';

/**
 * Replays `logs` in order, updating a per-competency mastery probability.
 * A competency with no evidence stays at `pInit` - "not yet demonstrated", not
 * "fine". Neutral logs are skipped. The tutorial is kept
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
  post_exam: number;
}

export const buildBKTEvidence = (logs: ActionLog[]): Record<DrivingCompetency, CompetencyEvidence> => {
  const evidence = COMPETENCIES.reduce((acc, competency) => {
    acc[competency] = { total: 0, drive: 0, quiz: 0, diagnostic: 0, post_exam: 0 };
    return acc;
  }, {} as Record<DrivingCompetency, CompetencyEvidence>);
  for (const log of logs) {
    if (!isBKTEvidence(log)) continue;
    const source = evidenceSourceOf(log);
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
