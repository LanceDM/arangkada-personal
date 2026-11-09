/**
 * How a sitting shows its items:
 * `presentWith`'s order, by the quiz's shuffle (`orderChoices`, a seeded
 * Fisher–Yates), keyed the way the quiz keys its draw.
 */
import { orderChoices, QUIZ_SECONDS_PER_ITEM, seedForQuestion, type QuizItemDoc } from '@/features/driving-sim';
import { presentWith } from '@/domain/assessment/sittingFromDraft';
import type { PresentedItem } from '@/domain/assessment/testResponse';

/**
 * The time allowed per item: the Short Quiz's minute, the one answer-time
 * allowance the game has (`basis-register.md` §5, a GAP). Both tests keep it,
 * so the post-test is answered at the pace the frozen difficulties were
 * calibrated at.
 */
export const TEST_SECONDS_PER_ITEM = QUIZ_SECONDS_PER_ITEM;

/** `draw` names the draw: the pre-test's, or a post-test block's. */
export const presentItems = (items: readonly QuizItemDoc[], seed: number, draw: string): PresentedItem<QuizItemDoc>[] =>
  presentWith({ order: orderChoices, seedFor: seedForQuestion }, items, seed, draw);

/** The bank's items a test may ask: switched on, and test items. */
export const isTestItem = (item: QuizItemDoc): boolean => item.isActive && item.use === 'test';
