/**
 * BKT calibration from the pilot players' logged answers (2026-11-13). It
 * estimates, and applies nothing:
 *
 * - the starting P(L) per competency, from the group's pre-test answers
 *   (parameters estimated from group data per skill: Bulut et al., 2023; Zhang
 *   et al., 2025). Each player's own pre-test answers then update that start,
 *   the group-first, individual-on-top pattern of Eagle et al. (2016);
 * - one slip for 4-choice items (pre-test, quiz, post-test); their guess stays
 *   1/4, fixed by the format, and the tests keep T = 0 (no feedback);
 * - one learn rate T for quiz and drive answers;
 * - one slip and one guess for drive scenarios, when there are enough of them;
 * - as a comparison only, a learn rate per player shared across that player's
 *   competencies (Yudelson, Koedinger & Gordon, 2013; to verify).
 *
 * Every value is searched on a grid inside the bounds of Zhang et al. (2025):
 * start 0.001-0.5, T 0.001-0.1, guess and slip 0.01-0.3, which also keeps
 * G + S below 1. The fit is by likelihood of each answer given the answers
 * before it (test, then train). Real players only.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { DEFAULT_BKT_MODEL, priorFor, updateMastery, type BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { predictionsFrom, predictiveMetrics, type Prediction } from './modelEvaluation';

/** TENTATIVE: the least data a value is fitted on; below it the current value is kept. */
export const CALIBRATION_MINIMUMS = { playersPerCompetency: 10, driveAnswers: 100, learningAnswers: 100, answersPerPlayerT: 20 } as const;

const range = (from: number, to: number, step: number): number[] => {
  const values: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) values.push(Math.round((from + i * step) * 1000) / 1000);
  return values;
};

const START_GRID = [0.001, ...range(0.01, 0.5, 0.01)];
const SLIP_GRID = range(0.01, 0.3, 0.01);
const GUESS_GRID = range(0.01, 0.3, 0.01);
const LEARN_GRID = [0.001, 0.005, ...range(0.01, 0.1, 0.01)];

export interface Fit {
  n: number;
  /** Mean log-likelihood per answer (higher is better). */
  logLik: number | null;
  rmse: number | null;
  auc: number | null;
  accuracy: number | null;
}

type Sequences = Prediction[][];

/** Each player's answers for each competency, in the order they were given. */
const sequencesOf = (answers: readonly Prediction[]): Sequences => {
  const groups = new Map<string, Prediction[]>();
  for (const answer of answers) {
    const key = `${answer.uid}|${answer.competency}`;
    const group = groups.get(key);
    if (group) group.push(answer);
    else groups.set(key, [answer]);
  }
  return [...groups.values()].map(group => group.sort((a, b) => a.seq - b.seq));
};

/** Replays every sequence under a model: the summed log-likelihood, and each prediction when asked for. */
const replay = (
  sequences: Sequences,
  model: BKTModel,
  learnOf: (uid: string) => number | null = () => null,
  collect?: { predicted: number; correct: boolean }[]
): number => {
  let logLik = 0;
  for (const sequence of sequences) {
    let p = priorFor(model, sequence[0].competency as DrivingCompetency);
    const own = learnOf(sequence[0].uid);
    for (const answer of sequence) {
      const base = model[answer.source];
      const params = own !== null && base.pTransit > 0 ? { ...base, pTransit: own } : base;
      const predicted = p * (1 - params.pSlip) + (1 - p) * params.pGuess;
      logLik += Math.log(Math.max(1e-12, answer.correct ? predicted : 1 - predicted));
      collect?.push({ predicted, correct: answer.correct });
      p = updateMastery(p, answer.correct, params);
    }
  }
  return logLik;
};

const fitOf = (sequences: Sequences, model: BKTModel, learnOf?: (uid: string) => number | null): Fit => {
  const predictions: { predicted: number; correct: boolean }[] = [];
  const logLik = replay(sequences, model, learnOf, predictions);
  const metrics = predictiveMetrics(predictions);
  return {
    n: predictions.length,
    logLik: predictions.length ? logLik / predictions.length : null,
    rmse: metrics?.rmse ?? null,
    auc: metrics?.auc ?? null,
    accuracy: metrics?.accuracy ?? null,
  };
};

/**
 * The pre-test likelihood of one player's k right out of n for a competency.
 * With T = 0 the player either knows it throughout or does not, so it is a
 * mixture of the two.
 */
const preTestLikelihood = (start: number, right: number, total: number, slip: number, guess: number): number =>
  start * (1 - slip) ** right * slip ** (total - right) + (1 - start) * guess ** right * (1 - guess) ** (total - right);

interface PreTestScore {
  right: number;
  total: number;
}

const bestStart = (scores: readonly PreTestScore[], slip: number, guess: number): { start: number; logLik: number } => {
  let best = { start: START_GRID[0], logLik: -Infinity };
  for (const start of START_GRID) {
    let logLik = 0;
    for (const score of scores) logLik += Math.log(Math.max(1e-300, preTestLikelihood(start, score.right, score.total, slip, guess)));
    if (logLik > best.logLik) best = { start, logLik };
  }
  return best;
};

export interface StartEstimate {
  competency: DrivingCompetency;
  /** Players with pre-test answers for it. */
  players: number;
  answers: number;
  /** Share of those answers that were right. */
  shareRight: number | null;
  /** The group's estimated start; null when too few players (the current value is kept). */
  estimate: number | null;
  /** The value the calibrated model would use. */
  value: number;
  /** The estimate sits on the edge of the search range: read it with care. */
  atBound: boolean;
}

export interface PlayerLearnRate {
  uid: string;
  label: string;
  answers: number;
  /** The player's own T; null with too few quiz and drive answers (the group T is used). */
  learn: number | null;
}

export interface BktCalibration {
  players: number;
  answers: number;
  bySource: Record<Prediction['source'], number>;
  starts: StartEstimate[];
  /** Fitted, or null when there was too little data to fit it. */
  slipChoice: number | null;
  learn: number | null;
  slipDrive: number | null;
  guessDrive: number | null;
  /** The current model with every fitted value put in; unfitted values stay as they are. */
  model: BKTModel;
  current: Fit;
  calibrated: Fit;
  perPlayerLearn: { rates: PlayerLearnRate[]; fit: Fit; fitted: number };
  /** What is still missing before every value can be fitted. */
  missing: string[];
  ready: boolean;
  skipped: number;
}

export const calibrateBkt = (
  rows: readonly Record<string, unknown>[],
  label: (uid: string) => string = uid => uid,
  base: BKTModel = DEFAULT_BKT_MODEL
): BktCalibration => {
  const { predictions: answers, skipped } = predictionsFrom(rows);
  const known = answers.filter(a => (COMPETENCIES as string[]).includes(a.competency));
  const sequences = sequencesOf(known);
  const players = new Set(known.map(a => a.uid));
  const bySource = { diagnostic: 0, quiz: 0, drive: 0, post_exam: 0 };
  for (const answer of known) bySource[answer.source]++;
  const missing: string[] = [];
  const min = CALIBRATION_MINIMUMS;

  // 1. The starts and the 4-choice slip, together, from the pre-test.
  const guessChoice = base.diagnostic.pGuess;
  const scores = new Map<DrivingCompetency, Map<string, PreTestScore>>(COMPETENCIES.map(c => [c, new Map()]));
  for (const answer of known) {
    if (answer.source !== 'diagnostic') continue;
    const perPlayer = scores.get(answer.competency as DrivingCompetency)!;
    const score = perPlayer.get(answer.uid) ?? { right: 0, total: 0 };
    score.total++;
    if (answer.correct) score.right++;
    perPlayer.set(answer.uid, score);
  }
  const enough = COMPETENCIES.filter(c => scores.get(c)!.size >= min.playersPerCompetency);
  let slipChoice: number | null = null;
  if (enough.length > 0) {
    let best = -Infinity;
    for (const slip of SLIP_GRID) {
      const total = enough.reduce((sum, c) => sum + bestStart([...scores.get(c)!.values()], slip, guessChoice).logLik, 0);
      if (total > best) {
        best = total;
        slipChoice = slip;
      }
    }
  }
  const short = COMPETENCIES.length - enough.length;
  if (short > 0) missing.push(`${short} of ${COMPETENCIES.length} competencies have pre-test answers from fewer than ${min.playersPerCompetency} players`);

  const starts: StartEstimate[] = COMPETENCIES.map(competency => {
    const own = [...scores.get(competency)!.values()];
    const total = own.reduce((sum, s) => sum + s.total, 0);
    const right = own.reduce((sum, s) => sum + s.right, 0);
    const estimate = slipChoice !== null && enough.includes(competency) ? bestStart(own, slipChoice, guessChoice).start : null;
    return {
      competency,
      players: own.length,
      answers: total,
      shareRight: total ? right / total : null,
      estimate,
      value: estimate ?? priorFor(base, competency),
      atBound: estimate !== null && (estimate <= START_GRID[0] || estimate >= START_GRID[START_GRID.length - 1]),
    };
  });

  const choice = (params: BKTModel['quiz']) => ({ ...params, pSlip: slipChoice ?? params.pSlip });
  let model: BKTModel = {
    ...base,
    pInitBy: Object.fromEntries(starts.filter(s => s.estimate !== null).map(s => [s.competency, s.estimate])) as BKTModel['pInitBy'],
    diagnostic: choice(base.diagnostic),
    quiz: choice(base.quiz),
    post_exam: choice(base.post_exam),
  };

  // 2. One learn rate for quiz and drive answers, with the drive slip and guess when there are enough drive answers.
  const learningAnswers = bySource.quiz + bySource.drive;
  const fitDrive = bySource.drive >= min.driveAnswers;
  let learn: number | null = null;
  let slipDrive: number | null = null;
  let guessDrive: number | null = null;
  if (learningAnswers >= min.learningAnswers) {
    let best = -Infinity;
    for (const t of LEARN_GRID) {
      for (const s of fitDrive ? SLIP_GRID : [base.drive.pSlip]) {
        for (const g of fitDrive ? GUESS_GRID : [base.drive.pGuess]) {
          const candidate: BKTModel = { ...model, quiz: { ...model.quiz, pTransit: t }, drive: { pTransit: t, pSlip: s, pGuess: g } };
          const logLik = replay(sequences, candidate);
          if (logLik > best) {
            best = logLik;
            learn = t;
            slipDrive = fitDrive ? s : null;
            guessDrive = fitDrive ? g : null;
          }
        }
      }
    }
    model = {
      ...model,
      quiz: { ...model.quiz, pTransit: learn! },
      drive: { pTransit: learn!, pSlip: slipDrive ?? base.drive.pSlip, pGuess: guessDrive ?? base.drive.pGuess },
    };
  } else {
    missing.push(`${learningAnswers} quiz and drive answers so far; the learn rate needs ${min.learningAnswers}`);
  }
  if (!fitDrive) missing.push(`${bySource.drive} drive answers so far; the drive slip and guess need ${min.driveAnswers}`);

  // 3. Comparison only: a learn rate per player, shared across that player's competencies.
  const byPlayer = new Map<string, Sequences>();
  for (const sequence of sequences) {
    const own = byPlayer.get(sequence[0].uid);
    if (own) own.push(sequence);
    else byPlayer.set(sequence[0].uid, [sequence]);
  }
  const rates: PlayerLearnRate[] = [...byPlayer].map(([uid, own]) => {
    const count = own.reduce((sum, sequence) => sum + sequence.filter(a => a.source === 'quiz' || a.source === 'drive').length, 0);
    let rate: number | null = null;
    if (count >= min.answersPerPlayerT) {
      let best = -Infinity;
      for (const t of LEARN_GRID) {
        const logLik = replay(own, model, () => t);
        if (logLik > best) {
          best = logLik;
          rate = t;
        }
      }
    }
    return { uid, label: label(uid), answers: count, learn: rate };
  });
  rates.sort((a, b) => b.answers - a.answers || a.label.localeCompare(b.label));
  const own = new Map(rates.map(rate => [rate.uid, rate.learn]));

  return {
    players: players.size,
    answers: known.length,
    bySource,
    starts,
    slipChoice,
    learn,
    slipDrive,
    guessDrive,
    model,
    current: fitOf(sequences, base),
    calibrated: fitOf(sequences, model),
    perPlayerLearn: { rates, fit: fitOf(sequences, model, uid => own.get(uid) ?? null), fitted: rates.filter(r => r.learn !== null).length },
    missing,
    ready: missing.length === 0,
    skipped,
  };
};
