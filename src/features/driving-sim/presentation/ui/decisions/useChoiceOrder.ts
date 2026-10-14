import { useMemo } from 'react';
import type { QuestionChoice } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  displayedChoices,
  type DisplayedChoice,
} from '@/features/driving-sim/domain/scenario/choiceOrder';

/**
 * One question's answers in the order this attempt shows them.
 *
 * Memoized on the seed and the question's id, which is what holds the order
 * still: the drive re-renders this component on every frame it paints, and an
 * order recomputed per render would move the answers under the player's cursor
 * sixty times a second. The phase the panel is in is deliberately not a
 * dependency — the question and its verdict show the same order.
 */
export const useChoiceOrder = (
  choices: QuestionChoice[] | undefined,
  attemptSeed: number,
  questionId: string
): DisplayedChoice[] =>
  useMemo(
    () => displayedChoices(choices, attemptSeed, questionId),
    [choices, attemptSeed, questionId]
  );
