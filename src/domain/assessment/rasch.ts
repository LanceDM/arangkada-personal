/**
 * Scoring the post-evaluation exam with a Rasch (1PL) model: one difficulty b
 * per item, discrimination fixed at 1, ability by EAP with a standard normal
 * prior. Under Rasch, with everyone taking the same items, the ranking by
 * ability matches the ranking by number correct, so rough starting
 * difficulties do not reorder learners.
 *
 * Difficulties start from a content rubric (easy -1, medium 0, hard +1; 0 until
 * the group rates the items), are estimated on the pilot group with
 * b = ln((1 - p) / p), and are recalibrated on all participants as an
 * exploratory step. No simulated item parameters are used.
 */
export const raschProbability = (theta: number, b: number): number => 1 / (1 + Math.exp(-(theta - b)));

const normalPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export interface RaschResponse {
  b: number;
  correct: boolean;
}

export interface AbilityEstimate {
  theta: number;
  /** Posterior standard deviation: the estimate's standard error. */
  se: number;
}

/** EAP ability over a quadrature grid, N(0, 1) prior. Defined for all-correct and all-wrong patterns. */
export const raschEAP = (responses: readonly RaschResponse[], gridMin = -4, gridMax = 4, step = 0.05): AbilityEstimate => {
  let sum = 0;
  let sumTheta = 0;
  let sumTheta2 = 0;
  for (let theta = gridMin; theta <= gridMax + 1e-9; theta += step) {
    let likelihood = 1;
    for (const r of responses) {
      const p = raschProbability(theta, r.b);
      likelihood *= r.correct ? p : 1 - p;
    }
    const w = likelihood * normalPdf(theta);
    sum += w;
    sumTheta += w * theta;
    sumTheta2 += w * theta * theta;
  }
  const mean = sumTheta / sum;
  return { theta: mean, se: Math.sqrt(Math.max(sumTheta2 / sum - mean * mean, 0)) };
};

/** b = ln((1 - p) / p), with p clamped away from 0 and 1 (half a response either side). */
export const difficultyFromProportion = (correct: number, total: number): number => {
  const p = Math.min(Math.max(correct, 0.5), total - 0.5) / total;
  return Math.log((1 - p) / p);
};

/** The content rubric's starting difficulty. */
export const RUBRIC_DIFFICULTY = { easy: -1, medium: 0, hard: 1 } as const;

/** KR-20 reliability over a persons x items 0/1 matrix. */
export const kr20 = (matrix: readonly (readonly boolean[])[]): number => {
  const people = matrix.length;
  const items = matrix[0]?.length ?? 0;
  if (people < 2 || items < 2) return Number.NaN;
  const totals = matrix.map(row => row.filter(Boolean).length);
  const mean = totals.reduce((a, b) => a + b, 0) / people;
  // Population variance, the same denominator the p q terms use.
  const variance = totals.reduce((a, t) => a + (t - mean) ** 2, 0) / people;
  let pq = 0;
  for (let j = 0; j < items; j++) {
    const p = matrix.filter(row => row[j]).length / people;
    pq += p * (1 - p);
  }
  return variance > 0 ? (items / (items - 1)) * (1 - pq / variance) : Number.NaN;
};

/** Point-biserial discrimination of one item against the rest-score. */
export const pointBiserial = (matrix: readonly (readonly boolean[])[], item: number): number => {
  const xs: number[] = matrix.map(row => (row[item] ? 1 : 0));
  const ys = matrix.map(row => row.filter((v, j) => v && j !== item).length);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : Number.NaN;
};
