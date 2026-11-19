/**
 * Model evaluation for the admin (2026-11-12): how well BKT predicted each
 * answer before it saw it, per player and for the whole model, and how the
 * Q-learning policy behaved. Everything is computed from logged records of
 * real players; nothing is simulated or refitted.
 *
 * BKT is evaluated prequentially (test, then train): each log entry holds
 * `predictedCorrect`, P(correct) = P(L)(1 - S) + (1 - P(L))G, written before
 * the answer updated the model, so no prediction has seen its own answer.
 *
 * Aggregating over players (Pelánek, 2017, "Measuring Predictive Performance
 * of User Models: The Details Matter", UMAP '17 Adjunct): a metric can be
 * computed globally over every prediction, or per student and then averaged,
 * or per skill and then averaged. The three can disagree, and none is the
 * correct one, so the report must say which it used. Here the headline is the
 * global (pooled) figure, and the per-player and per-competency averages are
 * reported beside it. Intervals come from a cluster bootstrap that resamples
 * whole players, since one player's answers are not independent (Schuetze,
 * Yan & Carvalho, 2025, IJAIED 35(6): cluster bootstrap, 1,000 replicates,
 * for mean RMSE and AUC; the resampling unit there is to be verified).
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import {
  DEFAULT_WARM_UP,
  Q_STATES,
  fallbackAction,
  legalActions,
  stateKey,
  type CompetencyAction,
} from '@/domain/competencyRouting/qLearning';
import type { CourseLogRow } from './adminReport';

// ---------------------------------------------------------------- BKT

export type PredictionSource = 'diagnostic' | 'quiz' | 'drive' | 'post_exam';
export const PREDICTION_SOURCES: readonly PredictionSource[] = ['diagnostic', 'quiz', 'drive', 'post_exam'];
export const SOURCE_LABEL: Record<PredictionSource, string> = {
  diagnostic: 'Pre-test',
  quiz: 'Short quiz',
  drive: 'Drive',
  post_exam: 'Post-test',
};

/** One answer with the chance BKT gave it of being right, before it was read. */
export interface Prediction {
  uid: string;
  competency: string;
  source: PredictionSource;
  predicted: number;
  correct: boolean;
  seq: number;
}

/** The usable entries of the BKT update log; anything malformed is left out and counted. */
export const predictionsFrom = (rows: readonly Record<string, unknown>[]): { predictions: Prediction[]; skipped: number } => {
  const predictions: Prediction[] = [];
  let skipped = 0;
  for (const row of rows) {
    const { uid, competency, source, predictedCorrect, correct, userSeq } = row;
    if (
      typeof uid !== 'string' ||
      typeof competency !== 'string' ||
      !PREDICTION_SOURCES.includes(source as PredictionSource) ||
      typeof predictedCorrect !== 'number' ||
      !(predictedCorrect >= 0 && predictedCorrect <= 1) ||
      typeof correct !== 'boolean'
    ) {
      skipped++;
      continue;
    }
    predictions.push({
      uid,
      competency,
      source: source as PredictionSource,
      predicted: predictedCorrect,
      correct,
      seq: typeof userSeq === 'number' ? userSeq : 0,
    });
  }
  return { predictions, skipped };
};

export interface PredictiveMetrics {
  n: number;
  /** Share of the answers that were right. */
  observedRate: number;
  /** BKT's average predicted chance of a right answer. */
  meanPredicted: number;
  /** Share predicted on the right side of 0.5. */
  accuracy: number;
  /** Accuracy of always predicting the commoner outcome. */
  baselineAccuracy: number;
  /** Area under the ROC curve; null when every answer was right, or every one wrong. */
  auc: number | null;
  rmse: number;
  /** RMSE of predicting the observed rate for every answer. */
  baselineRmse: number;
}

/** AUC as the Mann-Whitney statistic, ties given the average rank. */
export const auc = (items: readonly { predicted: number; correct: boolean }[]): number | null => {
  const positives = items.reduce((n, item) => n + (item.correct ? 1 : 0), 0);
  const negatives = items.length - positives;
  if (positives === 0 || negatives === 0) return null;
  const sorted = [...items].sort((a, b) => a.predicted - b.predicted);
  let rankSum = 0;
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].predicted === sorted[i].predicted) j++;
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (sorted[k].correct) rankSum += rank;
    i = j;
  }
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
};

export const predictiveMetrics = (items: readonly { predicted: number; correct: boolean }[]): PredictiveMetrics | null => {
  const n = items.length;
  if (n === 0) return null;
  let right = 0;
  let predicted = 0;
  let hits = 0;
  let squared = 0;
  for (const item of items) {
    const y = item.correct ? 1 : 0;
    right += y;
    predicted += item.predicted;
    if (item.predicted >= 0.5 === item.correct) hits++;
    squared += (item.predicted - y) ** 2;
  }
  const rate = right / n;
  return {
    n,
    observedRate: rate,
    meanPredicted: predicted / n,
    accuracy: hits / n,
    baselineAccuracy: Math.max(rate, 1 - rate),
    auc: auc(items),
    rmse: Math.sqrt(squared / n),
    baselineRmse: Math.sqrt(rate * (1 - rate)),
  };
};

const groupBy = <T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> => {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
};

export interface PlayerBktMetrics extends PredictiveMetrics {
  uid: string;
  label: string;
  bySource: Partial<Record<PredictionSource, PredictiveMetrics>>;
  byCompetency: Record<string, PredictiveMetrics>;
}

const split = <K extends string>(items: readonly Prediction[], key: (p: Prediction) => K): Record<K, PredictiveMetrics> =>
  Object.fromEntries([...groupBy(items, key)].map(([k, group]) => [k, predictiveMetrics(group)!])) as Record<K, PredictiveMetrics>;

/** Each player's own figures, most answers first. */
export const playerBktMetrics = (predictions: readonly Prediction[], label: (uid: string) => string): PlayerBktMetrics[] =>
  [...groupBy(predictions, p => p.uid)]
    .map(([uid, items]) => ({
      uid,
      label: label(uid),
      ...predictiveMetrics(items)!,
      bySource: split(items, p => p.source),
      byCompetency: split(items, p => p.competency),
    }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));

export interface Spread {
  /** How many groups had the metric (AUC needs both outcomes). */
  n: number;
  mean: number;
  /** Sample standard deviation; null with one group. */
  sd: number | null;
}

export const spread = (values: readonly (number | null)[]): Spread | null => {
  const xs = values.filter((v): v is number => v !== null);
  if (xs.length === 0) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1)) : null;
  return { n: xs.length, mean, sd };
};

export type Interval = [low: number, high: number];

/** A small seeded generator (mulberry32), so the same data always gives the same interval. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const percentile = (sorted: readonly number[], q: number): number => {
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  const high = Math.ceil(at);
  return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
};

/**
 * A 95% percentile interval from a cluster bootstrap: whole clusters (players)
 * are drawn with replacement and the statistic is recomputed on their pooled
 * items. Null with fewer than two clusters, or when no replicate had a value.
 */
export const clusterBootstrap = <T>(
  clusters: readonly (readonly T[])[],
  statistic: (items: T[]) => number | null,
  replicates = 1000,
  seed = 20261112
): Interval | null => {
  if (clusters.length < 2) return null;
  const rng = seeded(seed);
  const values: number[] = [];
  for (let b = 0; b < replicates; b++) {
    const sample: T[] = [];
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[Math.floor(rng() * clusters.length)];
      for (const item of cluster) sample.push(item);
    }
    const value = statistic(sample);
    if (value !== null && Number.isFinite(value)) values.push(value);
  }
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  return [percentile(values, 0.025), percentile(values, 0.975)];
};

export interface CalibrationBin {
  from: number;
  to: number;
  n: number;
  meanPredicted: number | null;
  observedRate: number | null;
}

/** Ten equal-width bins of the predicted chance, with what happened in each. */
export const calibration = (items: readonly Prediction[], bins = 10): { bins: CalibrationBin[]; ece: number | null } => {
  const sums = Array.from({ length: bins }, () => ({ n: 0, predicted: 0, right: 0 }));
  for (const item of items) {
    const bin = sums[Math.min(bins - 1, Math.floor(item.predicted * bins))];
    bin.n++;
    bin.predicted += item.predicted;
    bin.right += item.correct ? 1 : 0;
  }
  const rows = sums.map((bin, i) => ({
    from: i / bins,
    to: (i + 1) / bins,
    n: bin.n,
    meanPredicted: bin.n ? bin.predicted / bin.n : null,
    observedRate: bin.n ? bin.right / bin.n : null,
  }));
  const ece = items.length
    ? rows.reduce((total, row) => total + (row.n ? (row.n / items.length) * Math.abs(row.meanPredicted! - row.observedRate!) : 0), 0)
    : null;
  return { bins: rows, ece };
};

export interface BktEvaluation {
  players: PlayerBktMetrics[];
  /** Global: every prediction counted once. The headline. */
  pooled: PredictiveMetrics | null;
  /** 95% cluster-bootstrap intervals of the pooled figures, players resampled. */
  pooledInterval: { auc: Interval | null; rmse: Interval | null; accuracy: Interval | null };
  /** Each player's own metric, averaged: every player weighs the same. */
  perPlayer: { auc: Spread | null; rmse: Spread | null; accuracy: Spread | null };
  /** Each competency's own metric, averaged. */
  perCompetency: { auc: Spread | null; rmse: Spread | null; accuracy: Spread | null };
  byCompetency: { competency: string; metrics: PredictiveMetrics | null; players: number }[];
  bySource: { source: PredictionSource; metrics: PredictiveMetrics | null; players: number }[];
  calibration: { bins: CalibrationBin[]; ece: number | null };
  skipped: number;
  replicates: number;
}

export const evaluateBkt = (
  rows: readonly Record<string, unknown>[],
  label: (uid: string) => string = uid => uid,
  replicates = 1000
): BktEvaluation => {
  const { predictions, skipped } = predictionsFrom(rows);
  const players = playerBktMetrics(predictions, label);
  const clusters = [...groupBy(predictions, p => p.uid).values()];
  const interval = (pick: (m: PredictiveMetrics) => number | null) =>
    clusterBootstrap(clusters, items => {
      const m = predictiveMetrics(items);
      return m ? pick(m) : null;
    }, replicates);
  const part = (items: Prediction[]) => ({ metrics: predictiveMetrics(items), players: new Set(items.map(p => p.uid)).size });
  const byCompetency = COMPETENCIES.map(competency => ({ competency, ...part(predictions.filter(p => p.competency === competency)) }));
  const spreads = (groups: readonly (PredictiveMetrics | null)[]) => ({
    auc: spread(groups.map(m => m?.auc ?? null)),
    rmse: spread(groups.map(m => m?.rmse ?? null)),
    accuracy: spread(groups.map(m => m?.accuracy ?? null)),
  });
  return {
    players,
    pooled: predictiveMetrics(predictions),
    pooledInterval: { auc: interval(m => m.auc), rmse: interval(m => m.rmse), accuracy: interval(m => m.accuracy) },
    perPlayer: spreads(players),
    perCompetency: spreads(byCompetency.map(row => row.metrics)),
    byCompetency,
    bySource: PREDICTION_SOURCES.map(source => ({ source, ...part(predictions.filter(p => p.source === source)) })),
    calibration: calibration(predictions),
    skipped,
    replicates,
  };
};

// ---------------------------------------------------------------- Q-learning

export interface ActionOutcome {
  state: string;
  action: CompetencyAction;
  chosen: number;
  rewarded: number;
  players: number;
  meanReward: number | null;
  /** 95% cluster-bootstrap interval of the mean reward, players resampled. */
  interval: Interval | null;
}

export interface CoursePolicyEvaluation {
  decisions: number;
  /** Explored, exploited, or forced (one legal action, or the attempt cap). */
  selection: { explore: number; exploit: number; forced: number };
  /** Decisions with a real choice (two legal actions, not the cap). */
  choices: number;
  /** Of those, how many differ from the fallback rule, overall and when exploiting. */
  disagreement: { all: number; exploit: number; exploitChoices: number };
  /** Decisions whose action the rules did not allow in their state: must be 0. */
  illegal: number;
  /** State-action pairs: legal, chosen at least once, rewarded at least once, through the first exploration. */
  coverage: { pairs: number; chosen: number; rewarded: number; explored: number };
  outcomes: ActionOutcome[];
  /** Mean reward of the rewards in time order, cut in four equal parts. */
  rewardQuarters: { n: number; mean: number | null }[];
  rewards: number;
}

const quarters = (values: readonly number[]): { n: number; mean: number | null }[] =>
  [0, 1, 2, 3].map(i => {
    const part = values.slice(Math.floor((i * values.length) / 4), Math.floor(((i + 1) * values.length) / 4));
    return { n: part.length, mean: part.length ? part.reduce((a, b) => a + b, 0) / part.length : null };
  });

const mean = (values: readonly number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** The policy's behaviour, from every player's course log. */
export const evaluateCoursePolicy = (logs: readonly CourseLogRow[], replicates = 1000): CoursePolicyEvaluation => {
  const ordered = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const selection = { explore: 0, exploit: 0, forced: 0 };
  const disagreement = { all: 0, exploit: 0, exploitChoices: 0 };
  let decisions = 0;
  let choices = 0;
  let illegal = 0;
  const chosen = new Map<string, number>();
  // The fallback rule reviews on a repeat failure: a failure earlier in the same stage, as the course tracks it.
  const failed = new Set<string>();
  for (const row of ordered) {
    for (const d of [...row.decisions].sort((a, b) => a.seq - b.seq)) {
      decisions++;
      selection[d.selection]++;
      const pair = `${stateKey(d.state)}|${d.action}`;
      const stage = `${row.userId}|${d.levelId}|${d.competency}`;
      if (d.source !== 'cap') {
        chosen.set(pair, (chosen.get(pair) ?? 0) + 1);
        if (!legalActions(d.state).includes(d.action)) illegal++;
        if (d.legal.length > 1) {
          choices++;
          const rule = fallbackAction({ state: d.state, masteryP: d.masteryP, failedBefore: failed.has(stage) });
          const differs = d.action !== rule;
          if (differs) disagreement.all++;
          if (d.selection === 'exploit') {
            disagreement.exploitChoices++;
            if (differs) disagreement.exploit++;
          }
        }
      }
      if (d.state.result === 'failed') failed.add(stage);
    }
  }

  const rewards = ordered.flatMap(row => row.rewards.map(reward => ({ uid: row.userId, ...reward }))).sort((a, b) => a.timestamp - b.timestamp);
  const outcomes: ActionOutcome[] = Q_STATES.flatMap(state =>
    legalActions(state).map(action => {
      const key = stateKey(state);
      const own = rewards.filter(r => stateKey(r.state) === key && r.action === action);
      const clusters = [...groupBy(own, r => r.uid).values()].map(group => group.map(r => r.reward));
      return {
        state: key,
        action,
        chosen: chosen.get(`${key}|${action}`) ?? 0,
        rewarded: own.length,
        players: clusters.length,
        meanReward: mean(own.map(r => r.reward)),
        interval: clusterBootstrap(clusters, mean, replicates),
      };
    })
  );
  return {
    decisions,
    selection,
    choices,
    disagreement,
    illegal,
    coverage: {
      pairs: outcomes.length,
      chosen: outcomes.filter(o => o.chosen > 0).length,
      rewarded: outcomes.filter(o => o.rewarded > 0).length,
      explored: outcomes.filter(o => o.chosen >= DEFAULT_WARM_UP.exploreFirst).length,
    },
    outcomes,
    rewardQuarters: quarters(rewards.map(r => r.reward)),
    rewards: rewards.length,
  };
};

export interface LeaderStability {
  state: string;
  leader: string | null;
  /** How often the leader changed after it was first set. */
  changes: number;
  /** Table updates since the leader last changed (or was first set). */
  updatesSinceChange: number | null;
}

export interface QConvergence {
  learnUpdates: number;
  /** Mean |Q after − Q before| of the learning updates in order, cut in four equal parts. */
  deltaQuarters: { n: number; mean: number | null }[];
  /** Mean |ΔQ| of the last ten learning updates. */
  lastTen: number | null;
  stability: LeaderStability[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

/** How far the table still moves and how settled each state's leader is, from the shared table's update log. */
export const evaluateConvergence = (rows: readonly Record<string, unknown>[]): QConvergence => {
  const ordered = [...rows].sort((a, b) => Number(a.globalSeq ?? 0) - Number(b.globalSeq ?? 0));
  const deltas: number[] = [];
  const leaders = new Map<string, { leader: string | null; changes: number; since: number; set: boolean }>();
  for (const row of ordered) {
    const learning = record(row.learning);
    if (row.kind === 'learn' && learning && typeof learning.qBefore === 'number' && typeof learning.qAfter === 'number') {
      deltas.push(Math.abs(learning.qAfter - learning.qBefore));
    }
    const states = record(row.statesAfter);
    if (!states) continue;
    for (const [key, status] of Object.entries(states)) {
      const leader = (record(status)?.leader ?? null) as string | null;
      const seen = leaders.get(key) ?? { leader: null, changes: 0, since: 0, set: false };
      if (leader !== seen.leader) {
        if (seen.set) seen.changes++;
        seen.leader = leader;
        seen.since = 0;
        if (leader !== null) seen.set = true;
      } else {
        seen.since++;
      }
      leaders.set(key, seen);
    }
  }
  return {
    learnUpdates: deltas.length,
    deltaQuarters: quarters(deltas),
    lastTen: mean(deltas.slice(-10)),
    stability: Q_STATES.map(state => {
      const seen = leaders.get(stateKey(state));
      return {
        state: stateKey(state),
        leader: seen?.leader ?? null,
        changes: seen?.changes ?? 0,
        updatesSinceChange: seen?.set ? seen.since : null,
      };
    }),
  };
};
