/**
 * The post-test as a sitting shows it: the
 * frozen design's routing block, then the block its number correct routes to,
 * each in the seeded order `presentItems` draws under the block's own key, so
 * the two stages never share a draw and neither repeats the pre-test's.
 *
 * Each stage has its own clock at the pre-test's minute per item: the routing
 * block always closes, and the second block always gets its time.
 */
import type { QuizItemDoc } from '@/features/driving-sim';
import { postTestDraw } from '@/domain/assessment/sittingFromDraft';
import type { PresentedItem } from '@/domain/assessment/testResponse';
import type { TestBlock, TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import { isTestItem, presentItems, TEST_SECONDS_PER_ITEM } from './testForm';

/** A stage's countdown: a minute per item of its block. */
export const postTestStageSeconds = (itemCount: number): number => itemCount * TEST_SECONDS_PER_ITEM;

export const presentBlock = (items: readonly QuizItemDoc[], seed: number, block: TestBlock): PresentedItem<QuizItemDoc>[] =>
  presentItems(items, seed, postTestDraw(block));

/**
 * A block's items as the bank returned them, or the ids it could not use: a
 * block opens only when every item of the design is there, switched on and a
 * test item. Nothing is ever put in a missing item's place.
 */
export const blockItems = (
  design: TwoStageDesign,
  block: TestBlock,
  loaded: readonly QuizItemDoc[]
): { items: QuizItemDoc[]; missing: string[] } => {
  const byId = new Map(loaded.filter(isTestItem).map(item => [item.id, item]));
  const ids = design[block];
  return {
    items: ids.flatMap(id => (byId.has(id) ? [byId.get(id)!] : [])),
    missing: ids.filter(id => !byId.has(id)),
  };
};
