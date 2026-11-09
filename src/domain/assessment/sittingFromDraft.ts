/**
 * How a sitting shows its items, and a record built from the server's draft
 * alone, for a participant who never came back to close
 * their sitting: the export runs this, and the screens run the same two
 * builders, so calibration day never loses a pre-test.
 *
 * The shuffle is passed in. It is the quiz's seeded Fisher–Yates
 * (`orderChoices`, `seedForQuestion`), which belongs to Driving Sim, and this
 * domain imports no feature.
 */
import { routingScoreOf, postTestSittingRecord, preTestSittingRecord, type PresentedItem, type TestItemKey, type TestSitting, type SittingClosure } from './testResponse';
import { timedAnswers, type DraftAnswers } from './sittingClock';
import { routeByScore, type TestBlock, type TwoStageDesign } from './twoStageDesign';

export interface TestShuffle {
  order<T>(values: readonly T[], seed: number): T[];
  seedFor(sittingSeed: number, key: string): number;
}

export interface ShownItem extends TestItemKey {
  readonly options: readonly unknown[];
}

export const PRE_TEST_DRAW = 'pre-test';
export const postTestDraw = (block: TestBlock): string => `post-test:${block}`;

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * The items sorted by id, then in an order drawn from the sitting's seed, each
 * item's choices in an order drawn from the same seed and its id. Sorting first
 * makes the order depend on the seed and the set of items alone, never on the
 * order the database returned them in: the record's `seed` rebuilds the sitting.
 */
export const presentWith = <T extends ShownItem>(
  shuffle: TestShuffle,
  items: readonly T[],
  seed: number,
  draw: string
): PresentedItem<T>[] =>
  shuffle.order([...items].sort(byId), shuffle.seedFor(seed, draw)).map(item => ({
    item,
    choiceOrder: shuffle.order(item.options.map((_, index) => index), shuffle.seedFor(seed, item.id)),
  }));

/** One sitting per participant and kind, so the code names the sitting. */
export const testSittingId = (playerCode: string, kind: 'pre' | 'post'): string => `${playerCode}-${kind}`;

const idsOf = (presented: readonly PresentedItem[]) => presented.map(p => p.item.id);

/** A pre-test's record from the server's draft: every item in its place, answered or not. */
export const preTestFromDraft = (input: {
  playerCode: string;
  seed: number;
  startedAt: number;
  finishedAt: number;
  closedBy: SittingClosure;
  presented: readonly PresentedItem[];
  answers: DraftAnswers;
}): TestSitting =>
  preTestSittingRecord({
    sittingId: testSittingId(input.playerCode, 'pre'),
    playerCode: input.playerCode,
    seed: input.seed,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    closedBy: input.closedBy,
    presented: input.presented,
    answers: timedAnswers(idsOf(input.presented), input.answers, input.startedAt),
  });

/** A post-test's record from the server's draft: both parts, each timed from its own start. */
export const postTestFromDraft = (input: {
  playerCode: string;
  seed: number;
  startedAt: number;
  stage2StartedAt: number | null;
  finishedAt: number;
  closedBy: SittingClosure;
  design: Pick<TwoStageDesign, 'designId' | 'cuts'>;
  routingPresented: readonly PresentedItem[];
  stage2Presented: readonly PresentedItem[];
  answers: DraftAnswers;
}): TestSitting =>
  postTestSittingRecord({
    sittingId: testSittingId(input.playerCode, 'post'),
    playerCode: input.playerCode,
    seed: input.seed,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    closedBy: input.closedBy,
    design: input.design,
    routingPresented: input.routingPresented,
    stage2Presented: input.stage2Presented,
    answers: {
      ...timedAnswers(idsOf(input.routingPresented), input.answers, input.startedAt),
      ...timedAnswers(idsOf(input.stage2Presented), input.answers, input.stage2StartedAt ?? input.startedAt),
    },
  });

/**
 * A sitting nobody closed, as the export closes it: at the time it stopped, with
 * what the server has. Items never reached are unanswered, as on any record. A
 * post-test whose routing never closed is routed here as the screen would have,
 * from the same answers.
 */
export const abandonedSitting = <T extends ShownItem>(input: {
  shuffle: TestShuffle;
  playerCode: string;
  kind: 'pre' | 'post';
  seed: number;
  startedAt: number;
  stage2StartedAt: number | null;
  stoppedAt: number;
  items: readonly T[];
  answers: DraftAnswers;
  design: TwoStageDesign | null;
}): TestSitting => {
  const { shuffle, seed, items, design } = input;
  if (input.kind === 'pre') {
    return preTestFromDraft({
      playerCode: input.playerCode,
      seed,
      startedAt: input.startedAt,
      finishedAt: input.stoppedAt,
      closedBy: 'export',
      presented: presentWith(shuffle, items, seed, PRE_TEST_DRAW),
      answers: input.answers,
    });
  }
  if (!design) throw new Error(`${input.playerCode}: a post-test cannot be closed without its design.`);
  const blockOf = (ids: readonly string[]) => items.filter(item => ids.includes(item.id));
  const routingPresented = presentWith(shuffle, blockOf(design.routing), seed, postTestDraw('routing'));
  const block = routeByScore(routingScoreOf(routingPresented, input.answers), design.cuts);
  return postTestFromDraft({
    playerCode: input.playerCode,
    seed,
    startedAt: input.startedAt,
    stage2StartedAt: input.stage2StartedAt,
    finishedAt: input.stoppedAt,
    closedBy: 'export',
    design,
    routingPresented,
    stage2Presented: presentWith(shuffle, blockOf(design[block]), seed, postTestDraw(block)),
    answers: input.answers,
  });
};

/** Where a saved record and the server's draft disagree. They never should. */
export const recordDraftProblems = (sitting: TestSitting, answers: DraftAnswers): string[] => {
  const problems: string[] = [];
  for (const response of sitting.responses) {
    const answer = answers[response.itemId];
    if ((answer?.chosen ?? null) !== response.chosen) {
      problems.push(`item ${response.itemId}: the record says ${String(response.chosen)}, the draft ${String(answer?.chosen ?? null)}`);
    }
  }
  return problems;
};
