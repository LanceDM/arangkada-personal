/**
 * What order a question's answers are shown in.
 *
 * Every multiple-choice point in the game authors its choices with the correct
 * one written first, because that is how a person writes a question: the answer,
 * then the ways of getting it wrong. Rendered in that order, it is also how a
 * person *beats* a question — across the 58 multiple-choice points in the game
 * the correct answer sat first in 32 of them, so "always pick the top one"
 * scored 55% against a 33% baseline, without reading anything.
 *
 * So the authored order is the content's business and the displayed order is
 * this module's. Nothing here mutates the authored array: a level's `choices`
 * stay exactly as written, and every consumer renders a reordered copy.
 *
 * ## Why a seed rather than `Math.random()`
 *
 * Three things have to be true at once, and a bare random call gives none of
 * them: the order must hold still while the player is reading it (a re-render
 * must not move the answers under the cursor), it must survive the step from
 * the question to its verdict, and it must be reproducible in a test. A seed
 * derived from the attempt and the question's own id gives all three — the same
 * question in the same attempt always lands the same way, a new attempt lands
 * differently, and a test that fixes the seed sees a fixed order.
 */
import type { QuestionChoice } from './scenarioDefinition';
import { mixSeed } from './attemptSeed';

/**
 * xorshift32: small, deterministic, and identical on every platform.
 *
 * The same generator `driveSamples` uses, for the same reason — a shuffle that
 * depended on the host's `Math.random` would make a failing test unreproducible.
 */
const rng = (seed: number) => {
  let state = seed | 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 0x100000000) / 0x100000000;
  };
};

/**
 * The seed one question is ordered by, in one attempt.
 *
 * Mixing the attempt with the id rather than counting questions: a level rolls
 * its content fresh, so a positional counter would give two different questions
 * the same order on two different runs and make the whole thing look patterned.
 *
 * An attempt seed of 0 passes straight through as 0, which `orderChoices` reads
 * as "leave it alone". That is the one escape hatch, and it has to survive this
 * mixing or it is not an escape hatch at all: the component gallery and every
 * test that asserts against authored copy rely on it.
 */
export const seedForQuestion = (attemptSeed: number, questionId: string): number =>
  attemptSeed === 0
    ? 0
    : mixSeed(attemptSeed, questionId);

/**
 * The authored choices, in the order they should be shown.
 *
 * A copy, always — Fisher-Yates over a fresh array, so the level's own data is
 * never touched and two consumers of the same event cannot disagree about what
 * the content says. A seed of 0 is the authored order, which is what the
 * component gallery and a golden want: a stage previewed for visual QA should
 * look the same every time it is opened.
 */
export const orderChoices = <T>(choices: readonly T[], seed: number): T[] => {
  const ordered = [...choices];
  if (seed === 0 || ordered.length < 2) return ordered;
  const next = rng(seed);
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
};

/**
 * One question's answers as the screen shows them, with the authored index each
 * came from.
 *
 * The index is carried because a scenario's feedback and its telemetry are
 * written against the authored order, and because a test that asserts "the
 * third button submits the first authored action" needs to be able to say so.
 */
export interface DisplayedChoice {
  choice: QuestionChoice;
  /** Where this answer sits in the level's own `choices` array. */
  authoredIndex: number;
}

/** The displayed order for one question, ready to render and to key off. */
export const displayedChoices = (
  choices: readonly QuestionChoice[] | undefined,
  attemptSeed: number,
  questionId: string
): DisplayedChoice[] =>
  orderChoices(
    (choices ?? []).map((choice, authoredIndex) => ({ choice, authoredIndex })),
    seedForQuestion(attemptSeed, questionId)
  );
