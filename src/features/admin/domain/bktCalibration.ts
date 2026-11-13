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
 * - every guess stays as it is in force (decided 2026-11-13): 0.25 for
 *   4-choice items, 0.20 for drive scenarios;
 * - one learn rate T for quiz and drive answers;
 * - one slip for drive scenarios, when there are enough of them;
 * - as a comparison only, a learn rate per player shared across that player's
 *   competencies (Yudelson, Koedinger & Gordon, 2013; to verify), judged on
 *   answers held out by time, against a margin fixed in advance.
 *
 * The start is one per competency only when every competency has pre-tests
 * from enough players; otherwise one shared start from all of them pooled.
 *
 * Fitted on the players an admin marked pilot (`bktPilots`), whatever value
 * set each of them ran on: the fit replays their raw answers. Post-test
 * answers are left out: they still update each player's final BKT, but they
 * are not used to set the values.
 *
 * Every value is searched on a grid inside the bounds of Zhang et al. (2025):
 * start 0.001-0.5, T 0.001-0.1, slip 0.01-0.3 (the slip ceiling is still
 * the group's to settle: 0.3 or 0.1), which with the fixed guesses keeps
 * G + S below 1. The fit is by likelihood of each answer given the answers
 * before it (test, then train). Real players only.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { DEFAULT_BKT_MODEL, priorFor, updateMastery, type BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { masteryLevel } from '@/domain/competencyRouting/mastery';
import { MIN_PILOT_PLAYERS, setLabel, type BKTCalibrationState } from '@/domain/learner/mastery/bktValueSets';
import { clusterBootstrap, predictionsFrom, predictiveMetrics, type Interval, type Prediction } from './modelEvaluation';

/** TENTATIVE: the least data a value is fitted on; below it the current value is kept. */
export const CALIBRATION_MINIMUMS = { playersPerCompetency: MIN_PILOT_PLAYERS, driveAnswers: 100, learningAnswers: 100, answersPerPlayerT: 20 } as const;

/**
 * The held-out test of a learn rate per player, fixed before the pilot data
 * is looked at (TENTATIVE): each player's first 70% of quiz and drive answers
 * fit their T, the rest are predicted. It is adopted only if held-out RMSE
 * improves by the margin and the 95% interval of the improvement (players
 * resampled) stays above zero. For scale, Eagle et al. (2016) gained 0.014.
 */
export const HELD_OUT_TEST = { trainShare: 0.7, rmseMargin: 0.01 } as const;

const range = (from: number, to: number, step: number): number[] => {
  const values: number[] = [];
  for (let i = 0; from + i * step <= to + 1e-9; i++) values.push(Math.round((from + i * step) * 1000) / 1000);
  return values;
};

const START_GRID = [0.001, ...range(0.01, 0.5, 0.01)];
const SLIP_GRID = range(0.01, 0.3, 0.01);
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
  collect?: { predicted: number; correct: boolean }[],
  /** Which answers to score and collect; every answer still updates the model. */
  scored: (answer: Prediction) => boolean = () => true
): number => {
  let logLik = 0;
  for (const sequence of sequences) {
    let p = priorFor(model, sequence[0].competency as DrivingCompetency);
    const own = learnOf(sequence[0].uid);
    for (const answer of sequence) {
      const base = model[answer.source];
      const params = own !== null && base.pTransit > 0 ? { ...base, pTransit: own } : base;
      const predicted = p * (1 - params.pSlip) + (1 - p) * params.pGuess;
      if (scored(answer)) {
        logLik += Math.log(Math.max(1e-12, answer.correct ? predicted : 1 - predicted));
        collect?.push({ predicted, correct: answer.correct });
      }
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

export interface HeldOutTest {
  /** Players with enough quiz and drive answers to split. */
  players: number;
  /** Held-out answers predicted. */
  answers: number;
  shared: { rmse: number | null; auc: number | null };
  perPlayer: { rmse: number | null; auc: number | null };
  /** Held-out RMSE of the shared T minus that of the per-player T: above zero favours per-player. */
  improvement: number | null;
  interval: Interval | null;
  /** The rule's verdict: adopt a learn rate per player, or keep the shared one. */
  adopt: boolean;
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
  /** Left out of the fit: post-test answers, and answers of players on the calibrated set. */
  excluded: { postTest: number; notPilot: number };
  bySource: Record<Prediction['source'], number>;
  starts: StartEstimate[];
  /** One start for every competency, from all pre-test answers pooled; null with too few players. */
  sharedStart: number | null;
  /** Which start the rule selects: one per competency, the shared one, or the value in force (too little data). */
  startRule: 'per_competency' | 'shared' | 'kept';
  /** Fitted, or null when there was too little data to fit it. */
  slipChoice: number | null;
  learn: number | null;
  slipDrive: number | null;
  /** The current model with every fitted value put in; unfitted values stay as they are. */
  model: BKTModel;
  current: Fit;
  calibrated: Fit;
  perPlayerLearn: { rates: PlayerLearnRate[]; fit: Fit; fitted: number; heldOut: HeldOutTest };
  /** What is still missing before every value can be fitted. */
  missing: string[];
  ready: boolean;
  skipped: number;
}

export const calibrateBkt = (
  rows: readonly Record<string, unknown>[],
  label: (uid: string) => string = uid => uid,
  base: BKTModel = DEFAULT_BKT_MODEL,
  /** The players marked pilot; every player when absent. */
  pilots?: ReadonlySet<string>
): BktCalibration => {
  const pilotRows = pilots ? rows.filter(row => pilots.has(String(row.uid))) : [...rows];
  const { predictions: answers, skipped } = predictionsFrom(pilotRows);
  const postTest = answers.filter(a => a.source === 'post_exam').length;
  const known = answers.filter(a => (COMPETENCIES as string[]).includes(a.competency) && a.source !== 'post_exam');
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
  const pooled = COMPETENCIES.flatMap(c => [...scores.get(c)!.values()]);
  const preTestPlayers = new Set(known.filter(a => a.source === 'diagnostic').map(a => a.uid)).size;
  // The rule, fixed in advance: a start per competency only when every competency has enough players;
  // otherwise one shared start from all pre-test answers pooled; with too few players, the value in force.
  const startRule: BktCalibration['startRule'] =
    enough.length === COMPETENCIES.length ? 'per_competency' : preTestPlayers >= min.playersPerCompetency ? 'shared' : 'kept';
  let slipChoice: number | null = null;
  if (startRule !== 'kept') {
    let best = -Infinity;
    for (const slip of SLIP_GRID) {
      const total =
        startRule === 'per_competency'
          ? COMPETENCIES.reduce((sum, c) => sum + bestStart([...scores.get(c)!.values()], slip, guessChoice).logLik, 0)
          : bestStart(pooled, slip, guessChoice).logLik;
      if (total > best) {
        best = total;
        slipChoice = slip;
      }
    }
  }
  const sharedStart = slipChoice !== null ? bestStart(pooled, slipChoice, guessChoice).start : null;
  if (startRule === 'kept') missing.push(`${preTestPlayers} player(s) have pre-test answers; the starting value needs ${min.playersPerCompetency}`);
  else if (startRule === 'shared') {
    missing.push(`${COMPETENCIES.length - enough.length} of ${COMPETENCIES.length} competencies have pre-test answers from fewer than ${min.playersPerCompetency} players, so one shared start is used`);
  }

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
      value: startRule === 'per_competency' ? estimate! : startRule === 'shared' ? sharedStart! : priorFor(base, competency),
      atBound: estimate !== null && (estimate <= START_GRID[0] || estimate >= START_GRID[START_GRID.length - 1]),
    };
  });

  const choice = (params: BKTModel['quiz']) => ({ ...params, pSlip: slipChoice ?? params.pSlip });
  let model: BKTModel = {
    ...base,
    ...(startRule === 'shared' ? { pInit: sharedStart!, pInitBy: {} } : {}),
    ...(startRule === 'per_competency'
      ? { pInitBy: Object.fromEntries(starts.map(s => [s.competency, s.estimate])) as BKTModel['pInitBy'] }
      : {}),
    diagnostic: choice(base.diagnostic),
    quiz: choice(base.quiz),
    post_exam: choice(base.post_exam),
  };

  // 2. One learn rate for quiz and drive answers, with the drive slip and guess when there are enough drive answers.
  const learningAnswers = bySource.quiz + bySource.drive;
  const fitDrive = bySource.drive >= min.driveAnswers;
  let learn: number | null = null;
  let slipDrive: number | null = null;
  if (learningAnswers >= min.learningAnswers) {
    let best = -Infinity;
    for (const t of LEARN_GRID) {
      for (const s of fitDrive ? SLIP_GRID : [base.drive.pSlip]) {
        const candidate: BKTModel = { ...model, quiz: { ...model.quiz, pTransit: t }, drive: { pTransit: t, pSlip: s, pGuess: base.drive.pGuess } };
        const logLik = replay(sequences, candidate);
        if (logLik > best) {
          best = logLik;
          learn = t;
          slipDrive = fitDrive ? s : null;
        }
      }
    }
    model = {
      ...model,
      quiz: { ...model.quiz, pTransit: learn! },
      drive: { pTransit: learn!, pSlip: slipDrive ?? base.drive.pSlip, pGuess: base.drive.pGuess },
    };
  } else {
    missing.push(`${learningAnswers} quiz and drive answers so far; the learn rate needs ${min.learningAnswers}`);
  }
  if (!fitDrive) missing.push(`${bySource.drive} drive answers so far; the drive slip needs ${min.driveAnswers}`);

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

  // 4. The held-out test: each player's T from their earlier answers, scored on their later ones.
  const isLearning = (answer: Prediction) => answer.source === 'quiz' || answer.source === 'drive';
  const errors: { shared: number; own: number }[][] = [];
  const heldShared: { predicted: number; correct: boolean }[] = [];
  const heldOwn: { predicted: number; correct: boolean }[] = [];
  for (const [, playerSequences] of byPlayer) {
    const learning = playerSequences.flat().filter(isLearning).map(a => a.seq).sort((x, y) => x - y);
    if (learning.length < min.answersPerPlayerT) continue;
    const cut = learning[Math.floor(learning.length * HELD_OUT_TEST.trainShare) - 1];
    const train = playerSequences.map(sequence => sequence.filter(a => a.seq <= cut)).filter(sequence => sequence.length > 0);
    let rate = model.drive.pTransit;
    let best = -Infinity;
    for (const t of LEARN_GRID) {
      const logLik = replay(train, model, () => t);
      if (logLik > best) {
        best = logLik;
        rate = t;
      }
    }
    const later = (answer: Prediction) => answer.seq > cut;
    const withShared: { predicted: number; correct: boolean }[] = [];
    const withOwn: { predicted: number; correct: boolean }[] = [];
    replay(playerSequences, model, () => null, withShared, later);
    replay(playerSequences, model, () => rate, withOwn, later);
    if (withShared.length === 0) continue;
    heldShared.push(...withShared);
    heldOwn.push(...withOwn);
    errors.push(withShared.map((item, i) => ({ shared: (item.predicted - (item.correct ? 1 : 0)) ** 2, own: (withOwn[i].predicted - (withOwn[i].correct ? 1 : 0)) ** 2 })));
  }
  const gain = (items: { shared: number; own: number }[]): number | null =>
    items.length ? Math.sqrt(items.reduce((sum, e) => sum + e.shared, 0) / items.length) - Math.sqrt(items.reduce((sum, e) => sum + e.own, 0) / items.length) : null;
  const improvement = gain(errors.flat());
  const interval = clusterBootstrap(errors, gain);
  const sharedHeld = predictiveMetrics(heldShared);
  const ownHeld = predictiveMetrics(heldOwn);
  const heldOut: HeldOutTest = {
    players: errors.length,
    answers: heldShared.length,
    shared: { rmse: sharedHeld?.rmse ?? null, auc: sharedHeld?.auc ?? null },
    perPlayer: { rmse: ownHeld?.rmse ?? null, auc: ownHeld?.auc ?? null },
    improvement,
    interval,
    adopt: improvement !== null && improvement >= HELD_OUT_TEST.rmseMargin && interval !== null && interval[0] > 0,
  };

  return {
    players: players.size,
    answers: known.length,
    excluded: { postTest, notPilot: rows.length - pilotRows.length },
    bySource,
    starts,
    sharedStart,
    startRule,
    slipChoice,
    learn,
    slipDrive,
    model,
    current: fitOf(sequences, base),
    calibrated: fitOf(sequences, model),
    perPlayerLearn: { rates, fit: fitOf(sequences, model, uid => own.get(uid) ?? null), fitted: rates.filter(r => r.learn !== null).length, heldOut },
    missing,
    ready: missing.length === 0,
    skipped,
  };
};

export interface CalibrationProgress {
  /** 1 mark pilot players, 2 enough to calibrate. */
  step: 1 | 2;
  /** Players marked pilot. */
  marked: number;
  /** Of those, with pre-test answers. */
  markedWithPreTest: number;
  needed: number;
  /** Competencies with pre-tests from enough marked players (a start of their own; otherwise one shared start). */
  competenciesReady: number;
  competencies: number;
  /** The set new players get now. */
  inForce: string;
  number: number;
  appliedAt: number | null;
}

/**
 * Where the calibration stands, from the evidence counts the admin already
 * holds (no log read) and the pilot marks: how many marked players have
 * pre-tests, and which set new players get.
 */
export const calibrationProgress = (
  players: readonly { uid: string; evidence: Record<string, { diagnostic: number }> }[],
  pilots: ReadonlySet<string>,
  state: BKTCalibrationState
): CalibrationProgress => {
  const marked = players.filter(player => pilots.has(player.uid));
  const perCompetency = COMPETENCIES.map(c => marked.filter(player => (player.evidence[c]?.diagnostic ?? 0) > 0).length);
  const markedWithPreTest = marked.filter(player => COMPETENCIES.some(c => (player.evidence[c]?.diagnostic ?? 0) > 0)).length;
  return {
    step: markedWithPreTest >= MIN_PILOT_PLAYERS ? 2 : 1,
    marked: pilots.size,
    markedWithPreTest,
    needed: MIN_PILOT_PLAYERS,
    competenciesReady: perCompetency.filter(n => n >= CALIBRATION_MINIMUMS.playersPerCompetency).length,
    competencies: COMPETENCIES.length,
    inForce: setLabel(state.activeSetId),
    number: state.number,
    appliedAt: state.appliedAt,
  };
};

/** A calibration can be applied once enough marked players have pre-tests to set the starting values. */
export const canApply = (result: BktCalibration): boolean => result.startRule !== 'kept';

/** One player as a saved calibration names them. */
export interface PilotRef {
  uid: string;
  label: string;
}

/**
 * Everything saved with an applied calibration (`bktSetLogs/cal-N`): the values,
 * and the log of how they were reached, so the calibration can be reported
 * and checked later without the admin page.
 */
export interface CalibrationRecord {
  basedOn: string;
  model: BKTModel;
  startRule: BktCalibration['startRule'];
  sharedStart: number | null;
  starts: { competency: string; players: number; answers: number; shareRight: number | null; estimate: number | null; value: number }[];
  fitted: { slipChoice: number | null; learn: number | null; slipDrive: number | null };
  fixed: { guessChoice: number; guessDrive: number; learnTests: 0 };
  pilots: PilotRef[];
  data: { players: number; answers: number; bySource: BktCalibration['bySource']; excluded: BktCalibration['excluded'] };
  fit: { before: Fit; after: Fit };
  heldOut: HeldOutTest;
  sensitivity: SensitivityRow[];
  minimums: typeof CALIBRATION_MINIMUMS;
  missing: string[];
  note: string;
  settingsVersion: string;
}

export const calibrationRecord = (input: {
  result: BktCalibration;
  sensitivity: readonly SensitivityRow[];
  pilots: readonly PilotRef[];
  state: BKTCalibrationState;
  note: string;
  settingsVersion: string;
}): CalibrationRecord => {
  const { result } = input;
  return {
    basedOn: input.state.activeSetId,
    model: result.model,
    startRule: result.startRule,
    sharedStart: result.sharedStart,
    starts: result.starts.map(({ competency, players, answers, shareRight, estimate, value }) => ({ competency, players, answers, shareRight, estimate, value })),
    fitted: { slipChoice: result.slipChoice, learn: result.learn, slipDrive: result.slipDrive },
    fixed: { guessChoice: result.model.diagnostic.pGuess, guessDrive: result.model.drive.pGuess, learnTests: 0 },
    pilots: [...input.pilots],
    data: { players: result.players, answers: result.answers, bySource: result.bySource, excluded: result.excluded },
    fit: { before: result.current, after: result.calibrated },
    heldOut: result.perPlayerLearn.heldOut,
    sensitivity: [...input.sensitivity],
    minimums: CALIBRATION_MINIMUMS,
    missing: result.missing,
    note: input.note.trim().slice(0, 500),
    settingsVersion: input.settingsVersion,
  };
};

export interface SensitivityRow {
  label: string;
  /** What was changed from the values in force. */
  change: string;
  fit: Fit;
  /** Share of (player, competency) pairs whose final mastery level differs from the values in force. */
  levelsChanged: number | null;
}

/**
 * The sensitivity check (B7): the same logged answers replayed with nearby
 * values, one change at a time: the start at 0.10 and 0.50, and the slip of
 * every answer type down and up by 0.05 (the ceiling capping it). Every
 * answer is used, the post-test included, since it reads how the final BKT
 * depends on the values. Analysis only.
 */
export const sensitivityCheck = (
  rows: readonly Record<string, unknown>[],
  base: BKTModel = DEFAULT_BKT_MODEL,
  slipCeiling = 0.3
): { rows: SensitivityRow[]; pairs: number } => {
  const { predictions } = predictionsFrom(rows);
  const sequences = sequencesOf(predictions.filter(a => (COMPETENCIES as string[]).includes(a.competency)));
  const finalLevels = (model: BKTModel): number[] =>
    sequences.map(sequence => {
      let p = priorFor(model, sequence[0].competency as DrivingCompetency);
      let drive = 0;
      for (const answer of sequence) {
        p = updateMastery(p, answer.correct, model[answer.source]);
        if (answer.source === 'drive') drive++;
      }
      return masteryLevel(p, drive);
    });
  const reference = finalLevels(base);
  const withSlip = (delta: number): BKTModel => {
    const slip = (params: BKTModel['drive']) => ({ ...params, pSlip: Math.min(slipCeiling, Math.max(0.01, Math.round((params.pSlip + delta) * 1000) / 1000)) });
    return { ...base, drive: slip(base.drive), quiz: slip(base.quiz), diagnostic: slip(base.diagnostic), post_exam: slip(base.post_exam) };
  };
  const withStart = (start: number): BKTModel => ({ ...base, pInit: start, pInitBy: {} });
  const variants: { label: string; change: string; model: BKTModel }[] = [
    { label: 'Values in force', change: '–', model: base },
    { label: 'Start 0.10', change: 'every competency starts at 0.10', model: withStart(0.1) },
    { label: 'Start 0.50', change: 'every competency starts at 0.50', model: withStart(0.5) },
    { label: 'Slip − 0.05', change: `every slip lowered by 0.05`, model: withSlip(-0.05) },
    { label: 'Slip + 0.05', change: `every slip raised by 0.05 (at most ${slipCeiling})`, model: withSlip(0.05) },
  ];
  return {
    pairs: sequences.length,
    rows: variants.map(({ label, change, model }) => {
      const levels = finalLevels(model);
      return {
        label,
        change,
        fit: fitOf(sequences, model),
        levelsChanged: levels.length ? levels.filter((level, i) => level !== reference[i]).length / levels.length : null,
      };
    }),
  };
};
