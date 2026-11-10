/**
 * The pre-test as a sitting shows it: every
 * switched-on `test` item of the bank, in the seeded order `presentItems`
 * draws under its own key.
 */
import type { QuizItemDoc } from '@/features/driving-sim';
import { PRE_TEST_DRAW } from '@/domain/assessment/sittingFromDraft';
import type { PresentedItem } from '@/domain/assessment/testResponse';
import { isTestItem, presentItems, TEST_SECONDS_PER_ITEM } from './testForm';

/** A participant's sitting opens only on exactly this many. */
export const PRE_TEST_SIZE = 60;

/** One countdown for the sitting, a minute per item. */
export const PRE_TEST_SECONDS = PRE_TEST_SIZE * TEST_SECONDS_PER_ITEM;

/** The bank's items a pre-test asks: switched on, and test items. */
export const preTestItems = (items: readonly QuizItemDoc[]): QuizItemDoc[] => items.filter(isTestItem);

export const presentPreTest = (items: readonly QuizItemDoc[], seed: number): PresentedItem<QuizItemDoc>[] =>
  presentItems(items, seed, PRE_TEST_DRAW);
