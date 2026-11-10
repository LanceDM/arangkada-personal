/**
 * The post-test's two-stage design: a routing block everyone takes,
 * then an easy, medium or hard block chosen by the routing block's number
 * correct. The four blocks partition the 60 test items.
 *
 * The design is frozen on calibration day, from the pre-tests, and the app
 * only reads it. Routing needs no IRT at runtime: under the Rasch model the
 * number correct orders people exactly as their ability estimate does, so the
 * cut points are integers on the raw score.
 */

export type Stage2Block = 'easy' | 'medium' | 'hard';
export type TestBlock = 'routing' | Stage2Block;

export const STAGE2_BLOCKS: readonly Stage2Block[] = ['easy', 'medium', 'hard'];

/**
 * [c1, c2]: a routing score below c1 goes to easy, below c2 to medium, and the
 * rest to hard.
 */
export type RoutingCuts = readonly [number, number];

export interface TwoStageDesign {
  readonly schemaVersion: 1;
  /** Names this frozen design; every post-test sitting records it. */
  readonly designId: string;
  /** The frozen calibration (`frozen-calibration.json`) the blocks and cuts were built from. */
  readonly calibrationId: string;
  readonly routing: readonly string[];
  readonly easy: readonly string[];
  readonly medium: readonly string[];
  readonly hard: readonly string[];
  readonly cuts: RoutingCuts;
}

export const routeByScore = (score: number, cuts: RoutingCuts): Stage2Block =>
  score < cuts[0] ? 'easy' : score < cuts[1] ? 'medium' : 'hard';

/** What is wrong with a design, if anything: an empty list means it can be used. */
export const twoStageDesignProblems = (design: TwoStageDesign): string[] => {
  const problems: string[] = [];
  if (design.schemaVersion !== 1) problems.push(`unknown schemaVersion ${String(design.schemaVersion)}`);
  if (!design.designId) problems.push('designId is empty');
  if (!design.calibrationId) problems.push('calibrationId is empty');
  const blocks: TestBlock[] = ['routing', ...STAGE2_BLOCKS];
  const size = design.routing.length;
  if (size === 0) problems.push('the routing block is empty');
  const seen = new Set<string>();
  for (const block of blocks) {
    const ids = design[block];
    if (ids.length !== size) problems.push(`the ${block} block has ${ids.length} items, not ${size}`);
    for (const id of ids) {
      if (seen.has(id)) problems.push(`item ${id} is in more than one place`);
      seen.add(id);
    }
  }
  const [c1, c2] = design.cuts;
  if (!Number.isInteger(c1) || !Number.isInteger(c2) || c1 < 1 || c1 >= c2 || c2 > size) {
    problems.push(`cuts [${c1}, ${c2}] must be integers with 1 ≤ c1 < c2 ≤ ${size}, so every block can be reached`);
  }
  return problems;
};

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');

/**
 * A design as Firestore hands it back (`test_designs/post`), or null when it
 * is not one. A design it returns may still have problems
 * (`twoStageDesignProblems` says which), and is then not used.
 */
export const readTwoStageDesign = (data: Record<string, unknown> | null): TwoStageDesign | null => {
  if (!data) return null;
  const { routing, easy, medium, hard, cuts } = data;
  if (
    data.schemaVersion !== 1 || typeof data.designId !== 'string' || typeof data.calibrationId !== 'string' ||
    !isIdList(routing) || !isIdList(easy) || !isIdList(medium) || !isIdList(hard) ||
    !Array.isArray(cuts) || cuts.length !== 2 || !cuts.every(c => typeof c === 'number')
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    designId: data.designId,
    calibrationId: data.calibrationId,
    routing, easy, medium, hard,
    cuts: [cuts[0] as number, cuts[1] as number],
  };
};
