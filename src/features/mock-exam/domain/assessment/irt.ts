/**
 * 2-parameter logistic Item Response Theory: each item has a discrimination
 * `a` and difficulty `b`; an examinee's ability `theta` is estimated from the
 * pattern of which items they got right, not just how many - unlike a flat
 * raw count, a hard item answered correctly counts for more than an easy one.
 */
export interface ItemParams {
  a: number;
  b: number;
}

export const itemResponseProbability = (theta: number, params: ItemParams): number =>
  1 / (1 + Math.exp(-params.a * (theta - params.b)));

const normalPdf = (x: number, mean: number, sd: number): number =>
  Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

/**
 * Expected-A-Posteriori ability estimate: numerical integration over a fixed
 * theta grid, weighting each point by the likelihood of the observed
 * responses times a normal prior, returning the posterior mean. Chosen over
 * Newton-Raphson MLE because MLE is undefined for an all-correct or
 * all-wrong response pattern - a real possibility with a 40-item exam - while
 * EAP stays well-behaved (it just returns something close to the prior mean).
 */
export const estimateAbilityEAP = (
  responses: { params: ItemParams; correct: boolean }[],
  priorMean = 0,
  priorSd = 1,
  gridMin = -4,
  gridMax = 4,
  gridStep = 0.1
): number => {
  let numerator = 0;
  let denominator = 0;

  for (let theta = gridMin; theta <= gridMax; theta += gridStep) {
    const likelihood = responses.reduce((product, r) => {
      const p = itemResponseProbability(theta, r.params);
      return product * (r.correct ? p : 1 - p);
    }, 1);
    const weight = likelihood * normalPdf(theta, priorMean, priorSd);
    numerator += theta * weight;
    denominator += weight;
  }

  return denominator > 0 ? numerator / denominator : priorMean;
};

/**
 * One gradient-ascent step on a single item's own log-likelihood across all
 * examinees, holding their ability estimates fixed. Closed-form 2PL
 * gradients (z = a*(theta-b)):
 *   dLL/db = a * sum(p_i - y_i)
 *   dLL/da = sum((theta_i - b) * (y_i - p_i))
 */
const stepItemParams = (
  thetas: number[],
  responses: boolean[],
  params: ItemParams,
  learningRate: number
): ItemParams => {
  const n = thetas.length;
  let gradB = 0;
  let gradA = 0;

  for (let i = 0; i < n; i += 1) {
    const p = itemResponseProbability(thetas[i], params);
    const y = responses[i] ? 1 : 0;
    gradB += params.a * (p - y);
    gradA += (thetas[i] - params.b) * (y - p);
  }

  gradB /= n;
  gradA /= n;

  return {
    a: clamp(params.a + learningRate * gradA, 0.1, 4),
    b: clamp(params.b + learningRate * gradB, -6, 6),
  };
};

/**
 * Alternating estimation (a simplified Joint MLE) - the standard approach
 * when no pre-existing item parameters exist. Alternates between: (1) a few
 * gradient-ascent steps per item holding abilities fixed, and (2) an EAP
 * ability re-estimate per examinee holding item parameters fixed, until both
 * settle.
 */
export const calibrateItemParameters = (
  responseMatrix: boolean[][],
  iterations = 20,
  innerStepsPerItem = 5,
  learningRate = 0.5
): { itemParams: ItemParams[]; abilities: number[] } => {
  const numItems = responseMatrix[0]?.length ?? 0;

  let abilities = responseMatrix.map(row => {
    const proportionCorrect = clamp(row.filter(Boolean).length / numItems, 0.05, 0.95);
    return Math.log(proportionCorrect / (1 - proportionCorrect));
  });

  let itemParams: ItemParams[] = Array.from({ length: numItems }, () => ({ a: 1, b: 0 }));

  for (let iter = 0; iter < iterations; iter += 1) {
    itemParams = itemParams.map((params, itemIndex) => {
      const responses = responseMatrix.map(row => row[itemIndex]);
      let updated = params;
      for (let step = 0; step < innerStepsPerItem; step += 1) {
        updated = stepItemParams(abilities, responses, updated, learningRate);
      }
      return updated;
    });

    abilities = responseMatrix.map(row => {
      const responses = row.map((correct, itemIndex) => ({ params: itemParams[itemIndex], correct }));
      return estimateAbilityEAP(responses);
    });
  }

  return { itemParams, abilities };
};
