/**
 * Builds the post-test's two-stage design (twoStageDesign.ts) from the 60
 * test items: four blocks of 15, a routing block everyone takes and an easy,
 * medium and hard block, with two cut points on the routing score.
 *
 * Two ways, for two moments of the study:
 *
 * - `placeholderDesign` (TENTATIVE, 2026-11-10): before there are enough
 *   pre-tests to estimate anything. The blocks are parallel, each with the
 *   competencies spread as evenly as the items allow, and the cuts split the
 *   routing score in thirds. "Easy", "medium" and "hard" are names only here:
 *   no difficulty is known yet. Its calibrationId says `placeholder`, so every
 *   post-test sitting under it can be told apart and set aside.
 * - `irtDesign`: once the pre-tests are in. Each item's Rasch difficulty is
 *   b = ln((1 − p) / p) from the share who got it right on the pre-test (the
 *   change plan's first estimate). The routing block takes items spread across
 *   the whole range; the other 45, in order of difficulty, fill easy, medium
 *   and hard. The cuts are the routing scores at the 1/3 and 2/3 points of the
 *   pre-test takers' own routing scores, so about a third goes to each block.
 *
 * Both are pure and seeded; the script (scripts/db/postTestDesign.ts) writes
 * the result to `test_designs/post`.
 */
import { difficultyFromProportion } from './rasch';
import { twoStageDesignProblems, type RoutingCuts, type TwoStageDesign } from './twoStageDesign';

export const BLOCK_SIZE = 15;
export const DESIGN_ITEMS = BLOCK_SIZE * 4;

export interface DesignItem {
  id: string;
  competency: string;
}

const PLACEHOLDER_CUTS: RoutingCuts = [Math.round(BLOCK_SIZE / 3), Math.round((2 * BLOCK_SIZE) / 3)];

const byId = (a: DesignItem, b: DesignItem) => a.id.localeCompare(b.id);

const assertSize = (items: readonly DesignItem[]) => {
  if (items.length !== DESIGN_ITEMS) throw new Error(`A two-stage design needs exactly ${DESIGN_ITEMS} test items; the bank has ${items.length}.`);
};

const checked = (design: TwoStageDesign): TwoStageDesign => {
  const problems = twoStageDesignProblems(design);
  if (problems.length > 0) throw new Error(`The design is not usable: ${problems.join('; ')}`);
  return design;
};

/**
 * Deals the items into four blocks competency by competency, so each block
 * gets each competency's items in turn: with 5 or 6 items per competency,
 * every block has every competency once or twice.
 */
export const placeholderDesign = (items: readonly DesignItem[], designId: string): TwoStageDesign => {
  assertSize(items);
  const blocks: string[][] = [[], [], [], []];
  const sorted = [...items].sort((a, b) => a.competency.localeCompare(b.competency) || byId(a, b));
  // Deal round-robin, always to the emptiest block, so the sizes stay equal.
  let next = 0;
  for (const item of sorted) {
    while (blocks[next % 4].length >= BLOCK_SIZE) next++;
    blocks[next % 4].push(item.id);
    next++;
  }
  const [routing, easy, medium, hard] = blocks;
  return checked({ schemaVersion: 1, designId, calibrationId: 'placeholder', routing, easy, medium, hard, cuts: PLACEHOLDER_CUTS });
};

/** One pre-test as the IRT assembly reads it: which items were right. */
export interface PreTestAnswers {
  correct: ReadonlySet<string>;
  answered: ReadonlySet<string>;
}

export interface ItemDifficulty extends DesignItem {
  b: number;
  correct: number;
  total: number;
}

export const itemDifficulties = (items: readonly DesignItem[], pretests: readonly PreTestAnswers[]): ItemDifficulty[] =>
  items.map(item => {
    const total = pretests.filter(p => p.answered.has(item.id)).length;
    const correct = pretests.filter(p => p.correct.has(item.id)).length;
    return { ...item, correct, total, b: total > 0 ? difficultyFromProportion(correct, total) : 0 };
  });

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

export const irtDesign = (
  items: readonly DesignItem[],
  pretests: readonly PreTestAnswers[],
  designId: string,
  calibrationId: string
): { design: TwoStageDesign; difficulties: ItemDifficulty[] } => {
  assertSize(items);
  const difficulties = itemDifficulties(items, pretests).sort((a, b) => a.b - b.b || byId(a, b));
  // Every fourth item, from the easiest, is routing: it spans the whole range.
  const routing = difficulties.filter((_, i) => i % 4 === 1).map(item => item.id);
  const rest = difficulties.filter((_, i) => i % 4 !== 1);
  const easy = rest.slice(0, BLOCK_SIZE).map(item => item.id);
  const medium = rest.slice(BLOCK_SIZE, 2 * BLOCK_SIZE).map(item => item.id);
  const hard = rest.slice(2 * BLOCK_SIZE).map(item => item.id);

  // The pre-test takers' scores on the routing block, for the cuts.
  const routingSet = new Set(routing);
  const scores = pretests.map(p => [...p.correct].filter(id => routingSet.has(id)).length).sort((a, b) => a - b);
  let c1 = scores.length ? quantile(scores, 1 / 3) : PLACEHOLDER_CUTS[0];
  let c2 = scores.length ? quantile(scores, 2 / 3) : PLACEHOLDER_CUTS[1];
  // Keep every block reachable: 1 ≤ c1 < c2 ≤ 15.
  c1 = Math.min(Math.max(c1, 1), BLOCK_SIZE - 1);
  c2 = Math.min(Math.max(c2, c1 + 1), BLOCK_SIZE);
  return { design: checked({ schemaVersion: 1, designId, calibrationId, routing, easy, medium, hard, cuts: [c1, c2] }), difficulties };
};
