import type { RoutingCuts, Stage2Block, TestBlock, TwoStageDesign } from './twoStageDesign';
import { routeByScore } from './twoStageDesign';

/**
 * What a pre-test or post-test sitting records: the format the
 * pre/post screens write, and the long CSV the Rasch
 * analysis reads (`analysis/rasch/`).
 *
 * A sitting names its player by code, never by name or email. Each answer
 * keeps the item's id and revision in the bank, where it was shown,
 * the order its choices were shown in, what was chosen and how long it took,
 * so every sitting can be rebuilt and scored again. A post-test sitting also
 * keeps its routing: the score, the cut points, the block and the design.
 *
 * The stored document at `users/{uid}/testSittings/{kind}` is a `TestSitting`
 * exactly, so the export reads it with
 * `readTestSitting` and writes it with `testResponsesCsv`, unedited.
 */

export const TEST_SITTING_SCHEMA_VERSION = 1;

export type TestKind = 'pre' | 'post';
export type TestStage = 'pre' | 'routing' | 'stage2';

/**
 * How a sitting ended: its participant answered the last
 * item, its clock ran out and the app closed it when they came back, or they
 * never came back and the export built the record from the server's draft.
 */
export type SittingClosure = 'participant' | 'deadline' | 'export';

export interface TestResponse {
  readonly itemId: string;
  /** The item's revision in the bank when it was shown. */
  readonly revision: number;
  readonly competency: string;
  readonly stage: TestStage;
  /** The block the item was asked in; null on the pre-test. */
  readonly block: TestBlock | null;
  /** 1-based place in the sitting, in the order shown. */
  readonly position: number;
  /** The item's stored choices, by index, in the order shown. */
  readonly choiceOrder: readonly number[];
  /** The stored choice picked, by index; null when the server has no answer to it. */
  readonly chosen: number | null;
  readonly correct: boolean;
  /** From the item appearing to the answer, in milliseconds. */
  readonly timeMs: number;
}

export interface TestRouting {
  /** Number correct on the routing block. */
  readonly score: number;
  readonly cuts: RoutingCuts;
  readonly block: Stage2Block;
}

export interface TestSitting {
  readonly schemaVersion: typeof TEST_SITTING_SCHEMA_VERSION;
  readonly sittingId: string;
  /** The participant's code. Never a name or an email. */
  readonly playerCode: string;
  readonly kind: TestKind;
  /** One seed per sitting: item order and choice order are drawn from it. */
  readonly seed: number;
  readonly startedAt: number;
  readonly finishedAt: number;
  /** Absent on a record built without saying. */
  readonly closedBy?: SittingClosure;
  /** The frozen design a post-test was routed by; null on the pre-test. */
  readonly designId: string | null;
  readonly routing: TestRouting | null;
  readonly responses: readonly TestResponse[];
}

const isPermutation = (order: readonly number[]): boolean =>
  order.length > 0 && [...order].sort((a, b) => a - b).every((x, i) => x === i);

/**
 * What is wrong with a sitting, if anything. With `design`, a post-test is
 * also held to the design it names: its blocks' items and its cut points.
 */
export const testSittingProblems = (sitting: TestSitting, design?: TwoStageDesign): string[] => {
  const problems: string[] = [];
  const { responses } = sitting;
  if (sitting.schemaVersion !== TEST_SITTING_SCHEMA_VERSION) problems.push('unknown schemaVersion');
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(sitting.playerCode)) {
    problems.push('playerCode must be a code of letters, digits, - or _ (never a name or an email)');
  }
  if (!Number.isInteger(sitting.seed)) problems.push('seed is not an integer');
  if (!(sitting.finishedAt >= sitting.startedAt)) problems.push('finishedAt is before startedAt');
  if (responses.length === 0) problems.push('no responses');

  const positions = responses.map(r => r.position).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) problems.push('positions are not 1..n, each once');
  if (new Set(responses.map(r => r.itemId)).size !== responses.length) problems.push('an item is asked twice');

  for (const r of responses) {
    const label = `item ${r.itemId}`;
    if (!Number.isInteger(r.revision) || r.revision < 1) problems.push(`${label}: revision is not a positive integer`);
    if (!isPermutation(r.choiceOrder)) problems.push(`${label}: choiceOrder is not an order of the choices`);
    if (r.chosen === null ? r.correct : !r.choiceOrder.includes(r.chosen)) {
      problems.push(`${label}: chosen is not a shown choice, or an unanswered item is marked correct`);
    }
    if (!Number.isFinite(r.timeMs) || r.timeMs < 0) problems.push(`${label}: timeMs is not a time`);
  }

  if (sitting.kind === 'pre') {
    if (sitting.designId !== null || sitting.routing !== null) problems.push('a pre-test has no design or routing');
    if (responses.some(r => r.stage !== 'pre' || r.block !== null)) problems.push('a pre-test item has a stage or block');
    return problems;
  }

  const routing = sitting.routing;
  if (routing === null || sitting.designId === null) {
    problems.push('a post-test records its design and routing');
    return problems;
  }
  const routed = responses.filter(r => r.stage === 'routing');
  const stage2 = responses.filter(r => r.stage === 'stage2');
  if (routed.length + stage2.length !== responses.length) problems.push('a post-test item is not in the routing or second stage');
  if (routed.some(r => r.block !== 'routing')) problems.push('a routing-stage item is not in the routing block');
  if (stage2.some(r => r.block !== routing.block)) problems.push('a second-stage item is not in the routed block');
  if (Math.max(...routed.map(r => r.position)) > Math.min(...stage2.map(r => r.position))) {
    problems.push('a second-stage item was shown before the routing block ended');
  }
  const score = routed.filter(r => r.correct).length;
  if (routing.score !== score) problems.push(`routing score ${routing.score} is not the ${score} correct`);
  if (routeByScore(routing.score, routing.cuts) !== routing.block) problems.push('the block is not the one the cut points give');

  if (design) {
    if (design.designId !== sitting.designId) problems.push(`design ${sitting.designId} is not ${design.designId}`);
    if (design.cuts[0] !== routing.cuts[0] || design.cuts[1] !== routing.cuts[1]) problems.push('cut points differ from the design');
    const same = (a: readonly string[], b: readonly string[]) =>
      a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
    if (!same(routed.map(r => r.itemId), design.routing)) problems.push('routing items differ from the design');
    if (!same(stage2.map(r => r.itemId), design[routing.block])) problems.push('second-stage items differ from the design');
  }
  return problems;
};

/** What the record needs of a bank item: its id, revision, competency and key. */
export interface TestItemKey {
  readonly id: string;
  readonly revision: number;
  readonly competency: string;
  readonly correctIndex: number;
}

/** One item as a sitting shows it: in its place, with its choices in their order. */
export interface PresentedItem<T extends TestItemKey = TestItemKey> {
  readonly item: T;
  readonly choiceOrder: readonly number[];
}

/** An answer the server took: the stored choice picked, and how long the item took. */
export interface TestAnswer {
  readonly chosen: number | null;
  readonly timeMs: number;
}

/**
 * One item's response. An item with no answer (not reached, or on screen when
 * the clock ran out) is recorded unanswered with no time.
 */
export const testResponseOf = (
  presented: PresentedItem,
  position: number,
  answer: TestAnswer | undefined,
  stage: TestStage,
  block: TestBlock | null
): TestResponse => {
  const chosen = answer?.chosen ?? null;
  return {
    itemId: presented.item.id,
    revision: presented.item.revision,
    competency: presented.item.competency,
    stage,
    block,
    position,
    choiceOrder: [...presented.choiceOrder],
    chosen,
    correct: chosen !== null && chosen === presented.item.correctIndex,
    timeMs: Math.max(0, Math.round(answer?.timeMs ?? 0)),
  };
};

/** A pre-test's record: every presented item in its place, answered or not. */
export const preTestSittingRecord = (input: {
  sittingId: string;
  playerCode: string;
  seed: number;
  startedAt: number;
  finishedAt: number;
  closedBy?: SittingClosure;
  presented: readonly PresentedItem[];
  answers: Readonly<Record<string, TestAnswer>>;
}): TestSitting => ({
  schemaVersion: TEST_SITTING_SCHEMA_VERSION,
  sittingId: input.sittingId,
  playerCode: input.playerCode,
  kind: 'pre',
  seed: input.seed,
  startedAt: input.startedAt,
  finishedAt: input.finishedAt,
  ...(input.closedBy ? { closedBy: input.closedBy } : {}),
  designId: null,
  routing: null,
  responses: input.presented.map((p, i) => testResponseOf(p, i + 1, input.answers[p.item.id], 'pre', null)),
});

/**
 * A post-test's record: the routing block, then the
 * block it routed to, each item in its place, answered or not. The routing
 * score counts the routing block's correct answers, an unanswered item as
 * wrong, and the block is the one the cut points give that score.
 */
export const postTestSittingRecord = (input: {
  sittingId: string;
  playerCode: string;
  seed: number;
  startedAt: number;
  finishedAt: number;
  closedBy?: SittingClosure;
  design: Pick<TwoStageDesign, 'designId' | 'cuts'>;
  routingPresented: readonly PresentedItem[];
  stage2Presented: readonly PresentedItem[];
  answers: Readonly<Record<string, TestAnswer>>;
}): TestSitting => {
  const routed = input.routingPresented.map((p, i) => testResponseOf(p, i + 1, input.answers[p.item.id], 'routing', 'routing'));
  const score = routed.filter(r => r.correct).length;
  const block = routeByScore(score, input.design.cuts);
  const offset = routed.length;
  return {
    schemaVersion: TEST_SITTING_SCHEMA_VERSION,
    sittingId: input.sittingId,
    playerCode: input.playerCode,
    kind: 'post',
    seed: input.seed,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    ...(input.closedBy ? { closedBy: input.closedBy } : {}),
    designId: input.design.designId,
    routing: { score, cuts: [input.design.cuts[0], input.design.cuts[1]], block },
    responses: [
      ...routed,
      ...input.stage2Presented.map((p, i) => testResponseOf(p, offset + i + 1, input.answers[p.item.id], 'stage2', block)),
    ],
  };
};

/** The routing block's number correct, as the record will count it. */
export const routingScoreOf = (
  routingPresented: readonly PresentedItem[],
  answers: Readonly<Record<string, { readonly chosen: number | null }>>
): number =>
  routingPresented.filter(p => {
    const chosen = answers[p.item.id]?.chosen ?? null;
    return chosen !== null && chosen === p.item.correctIndex;
  }).length;

const TEST_STAGES: readonly TestStage[] = ['pre', 'routing', 'stage2'];
const TEST_BLOCKS: readonly TestBlock[] = ['routing', 'easy', 'medium', 'hard'];
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

const readResponse = (data: unknown): TestResponse | null => {
  if (typeof data !== 'object' || data === null) return null;
  const r = data as Record<string, unknown>;
  const order = r.choiceOrder;
  if (
    !isStr(r.itemId) || !isInt(r.revision) || !isStr(r.competency) ||
    !TEST_STAGES.includes(r.stage as TestStage) ||
    !(r.block === null || TEST_BLOCKS.includes(r.block as TestBlock)) ||
    !isInt(r.position) || !Array.isArray(order) || !order.every(isInt) ||
    !(r.chosen === null || isInt(r.chosen)) || typeof r.correct !== 'boolean' ||
    typeof r.timeMs !== 'number'
  ) {
    return null;
  }
  return {
    itemId: r.itemId, revision: r.revision, competency: r.competency,
    stage: r.stage as TestStage, block: r.block as TestBlock | null, position: r.position,
    choiceOrder: order, chosen: r.chosen as number | null, correct: r.correct, timeMs: r.timeMs,
  };
};

/**
 * A sitting as Firestore hands it back, or null when it is not one. The rules
 * check the shape on write; this guards the export against anything written
 * outside them. A sitting it returns may still have problems
 * (`testSittingProblems` says which).
 */
export const readTestSitting = (data: Record<string, unknown>): TestSitting | null => {
  const responses = Array.isArray(data.responses) ? data.responses.map(readResponse) : null;
  const routing = data.routing as Record<string, unknown> | null | undefined;
  const cuts = routing?.cuts;
  if (
    data.schemaVersion !== TEST_SITTING_SCHEMA_VERSION || !isStr(data.sittingId) || !isStr(data.playerCode) ||
    (data.kind !== 'pre' && data.kind !== 'post') || !isInt(data.seed) ||
    typeof data.startedAt !== 'number' || typeof data.finishedAt !== 'number' ||
    !(data.designId === null || isStr(data.designId)) ||
    !(routing === null || (typeof routing === 'object' && isInt(routing.score) &&
      Array.isArray(cuts) && cuts.length === 2 && cuts.every(isInt) &&
      ['easy', 'medium', 'hard'].includes(routing.block as string))) ||
    responses === null || responses.some(r => r === null)
  ) {
    return null;
  }
  return {
    schemaVersion: TEST_SITTING_SCHEMA_VERSION,
    sittingId: data.sittingId,
    playerCode: data.playerCode,
    kind: data.kind,
    seed: data.seed,
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    ...(data.closedBy === 'participant' || data.closedBy === 'deadline' || data.closedBy === 'export' ? { closedBy: data.closedBy } : {}),
    designId: data.designId as string | null,
    routing: routing
      ? { score: routing.score as number, cuts: [(cuts as number[])[0], (cuts as number[])[1]], block: routing.block as Stage2Block }
      : null,
    responses: responses as TestResponse[],
  };
};

/** The long CSV the analysis reads: one row per answer. */
export const TEST_RESPONSE_CSV_COLUMNS = [
  'player_code', 'kind', 'sitting_id', 'seed', 'design_id',
  'item_id', 'revision', 'competency', 'stage', 'block', 'position',
  'choice_order', 'chosen', 'answered', 'correct', 'time_ms',
  'routing_score', 'routed_block', 'routing_cuts',
] as const;

const csvField = (value: string | number | null): string => {
  const text = value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A sitting's rows, in the order shown, without the header. */
export const testSittingCsvRows = (sitting: TestSitting): string[] =>
  [...sitting.responses]
    .sort((a, b) => a.position - b.position)
    .map(r => [
      sitting.playerCode, sitting.kind, sitting.sittingId, sitting.seed, sitting.designId,
      r.itemId, r.revision, r.competency, r.stage, r.block, r.position,
      r.choiceOrder.join('|'), r.chosen, r.chosen === null ? 0 : 1, r.correct ? 1 : 0, Math.round(r.timeMs),
      sitting.routing?.score ?? null, sitting.routing?.block ?? null,
      sitting.routing ? sitting.routing.cuts.join('|') : null,
    ].map(csvField).join(','));

export const testResponsesCsv = (sittings: readonly TestSitting[]): string =>
  [TEST_RESPONSE_CSV_COLUMNS.join(','), ...sittings.flatMap(testSittingCsvRows)].join('\n') + '\n';
