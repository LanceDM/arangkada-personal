// @vitest-environment jsdom
/**
 * The Short Quiz draws a sitting from its module's bank, shows its questions
 * and their choices in a seeded order, and grades against the authored answer
 * whatever that order is. A player can leave at any question and go back to
 * change an answer. Each finished sitting reports which items and revisions it
 * showed.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUIZ_SECONDS_PER_ITEM, quizTimeLimitSeconds } from '@/features/driving-sim/domain/scenario/lessonModule';
import type { LevelQuiz, QuizItemDoc, QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { fixtureLevelQuiz } from '@/features/driving-sim/domain/scenario/quizBank.fixture';
import { LanguageProvider } from '@/shared/i18n/language';
import { scenarioFingerprint, textsOf } from '@/features/driving-sim/domain/scenario/scenarioTexts';
import MissionQuiz from './MissionQuiz';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const open = (
  quiz: LevelQuiz,
  seed: number,
  handlers: { onPass?: () => void; onClose?: () => void; onFinish?: (sitting: QuizSittingDoc) => void } = {}
) =>
  act(() =>
    root.render(
      <MissionQuiz
        quiz={quiz}
        levelId={1}
        onPass={handlers.onPass ?? (() => {})}
        onClose={handlers.onClose ?? (() => {})}
        onFinish={handlers.onFinish}
        newSeed={() => seed}
      />
    )
  );

const buttons = () => [...container.querySelectorAll('button')];
const button = (label: string) => buttons().find(b => b.textContent?.includes(label));
const heading = () => container.querySelector('h2')!.textContent!;
/** The choice buttons, in the order shown: each one's option text. */
const shownChoices = () =>
  buttons()
    .filter(b => b.hasAttribute('aria-pressed'))
    .map(b => b.querySelector('span')!.textContent!);
const click = (element: HTMLElement) => act(() => element.click());
const pick = (option: string) =>
  click(buttons().find(b => b.hasAttribute('aria-pressed') && b.querySelector('span')!.textContent === option)!);
const itemNamed = (quiz: LevelQuiz, text: string): QuizItemDoc => quiz.items.find(q => q.question === text)!;
const wrong = (q: QuizItemDoc) => (q.correctIndex + 1) % q.options.length;

/** Answers every question shown by the authored index `choose` gives, and returns the score line. */
const sit = (quiz: LevelQuiz, choose: (item: QuizItemDoc) => number) => {
  for (let i = 0; i < quiz.itemsPerSitting; i++) {
    const q = itemNamed(quiz, heading());
    pick(q.options[choose(q)]);
  }
  return container.textContent!.match(/Score: (\d+) \/ (\d+)/)![1];
};

describe('MissionQuiz order', () => {
  it("keeps the bank's order at seed 0", () => {
    const quiz = fixtureLevelQuiz(6);
    open(quiz, 0);
    expect(heading()).toBe(quiz.items[0].question);
    expect(shownChoices()).toEqual(quiz.items[0].options);
  });

  it('does not keep the correct answer on top, nor the questions in one order', () => {
    const quiz = fixtureLevelQuiz(6);
    // Every fixture item is written with its answer first.
    expect(quiz.items.every(q => q.correctIndex === 0)).toBe(true);

    let correctOnTop = 0;
    const firstQuestions = new Set<string>();
    const seeds = 200;
    for (let seed = 1; seed <= seeds; seed++) {
      open(quiz, seed * 7919);
      const q = itemNamed(quiz, heading());
      firstQuestions.add(q.question);
      if (shownChoices()[0] === q.options[q.correctIndex]) correctOnTop++;
      act(() => root.render(<></>));
    }
    const chance = seeds / quiz.items[0].options.length;
    expect(correctOnTop).toBeLessThan(chance * 1.5);
    expect(correctOnTop).toBeGreaterThan(chance * 0.5);
    expect(firstQuestions.size).toBeGreaterThan(1);
  });

  it('draws a sitting of its size from a larger bank, a different draw per seed', () => {
    const quiz = fixtureLevelQuiz(30, { itemsPerSitting: 10, passingScore: 6 });
    const draws = new Set<string>();
    for (const seed of [11, 22, 33]) {
      const asked: string[] = [];
      open(quiz, seed);
      expect(container.textContent).toContain('1 / 10');
      for (let i = 0; i < 10; i++) {
        const q = itemNamed(quiz, heading());
        asked.push(q.id);
        pick(q.options[q.correctIndex]);
      }
      expect(new Set(asked).size).toBe(10);
      expect(container.textContent).toContain('Score: 10 / 10 | Passing: 6');
      draws.add([...asked].sort().join());
      act(() => root.render(<></>));
    }
    expect(draws.size).toBeGreaterThan(1);
  });

  it('gives the same score for the same authored answers under any order', () => {
    const quiz = fixtureLevelQuiz(6);
    // Right on the even items, the first wrong option on the odd ones.
    const choose = (q: QuizItemDoc) => (q.order % 2 === 0 ? q.correctIndex : wrong(q));
    const expected = String(quiz.items.filter(q => q.order % 2 === 0).length);
    for (const seed of [0, 1, 42, 0xdeadbeef, 123456789]) {
      open(quiz, seed);
      expect(sit(quiz, choose)).toBe(expected);
      act(() => root.render(<></>));
    }
  });

  it('reviews each question with the answer chosen, the correct one and its source', () => {
    const quiz = fixtureLevelQuiz(6);
    open(quiz, 99);
    sit(quiz, wrong);
    const text = container.textContent!;
    for (const q of quiz.items) {
      expect(text).toContain(`Your answer: ${q.options[wrong(q)]}`);
      expect(text).toContain(`Correct answer: ${q.options[q.correctIndex]}`);
      expect(text).toContain(q.explanation);
    }
    expect(text).toContain('Source: Fixture');
  });

  it("shows an item's picture above its question", () => {
    const quiz = fixtureLevelQuiz(1);
    quiz.items[0] = { ...quiz.items[0], image: '/arangkada_extracted_images/level3/no-u-turn.png' };
    open(quiz, 0);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/arangkada_extracted_images/level3/no-u-turn.png');
  });
});

describe('MissionQuiz record', () => {
  it('reports each finished sitting once, by item id and revision', () => {
    const quiz = fixtureLevelQuiz(12, { itemsPerSitting: 10, passingScore: 6 });
    quiz.items[3] = { ...quiz.items[3], revision: 4 };
    const onFinish = vi.fn();
    open(quiz, 7, { onFinish });
    sit(quiz, q => q.correctIndex);
    expect(onFinish).toHaveBeenCalledTimes(1);

    const sitting: QuizSittingDoc = onFinish.mock.calls[0][0];
    expect(sitting).toMatchObject({ moduleId: quiz.moduleId, levelId: 1, seed: 7, score: 10, passed: true, timedOut: false });
    expect(sitting.answers).toHaveLength(10);
    expect(sitting.answers.every(answer => answer.correct && answer.chosen === 0)).toBe(true);
    for (const answer of sitting.answers) {
      expect(answer.revision).toBe(quiz.items.find(q => q.id === answer.itemId)!.revision);
    }

    click(button('Proceed to Mission')!);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('reports a retry as a sitting of its own', () => {
    const quiz = fixtureLevelQuiz(6);
    const onFinish = vi.fn();
    let seed = 0;
    act(() =>
      root.render(
        <MissionQuiz quiz={quiz} levelId={1} onPass={() => {}} onClose={() => {}} onFinish={onFinish} newSeed={() => ++seed * 104729} />
      )
    );
    sit(quiz, wrong);
    click(button('Retry Checkpoint')!);
    sit(quiz, q => q.correctIndex);
    expect(onFinish).toHaveBeenCalledTimes(2);
    expect(onFinish.mock.calls.map(([s]) => s.passed)).toEqual([false, true]);
  });
});

describe('MissionQuiz navigation', () => {
  it('asks before leaving through Back to Briefing, and Stay keeps the sitting', () => {
    const quiz = fixtureLevelQuiz(6);
    const onClose = vi.fn();
    open(quiz, 5, { onClose });

    pick(shownChoices()[0]);
    const second = heading();
    click(button('Back to Briefing')!);
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    click(button('Stay')!);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(heading()).toBe(second);
    click(button('Previous')!);
    expect(buttons().some(b => b.getAttribute('aria-pressed') === 'true')).toBe(true);

    click(button('Back to Briefing')!);
    click(button('Leave')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('goes back with Previous so an answer can be changed', () => {
    const quiz = fixtureLevelQuiz(6);
    const onPass = vi.fn();
    open(quiz, 5, { onPass });
    expect(button('Previous')).toBeUndefined();

    // A wrong answer to the first question, then back to change it.
    const first = itemNamed(quiz, heading());
    const wrongOption = first.options[wrong(first)];
    pick(wrongOption);
    click(button('Previous')!);
    expect(heading()).toBe(first.question);
    expect(buttons().find(b => b.getAttribute('aria-pressed') === 'true')!.textContent).toContain(wrongOption);
    pick(first.options[first.correctIndex]);

    // The rest right: a full score, so the change counted.
    for (let i = 1; i < quiz.itemsPerSitting; i++) {
      const q = itemNamed(quiz, heading());
      pick(q.options[q.correctIndex]);
    }
    expect(container.textContent).toContain(`Score: ${quiz.itemsPerSitting} / ${quiz.itemsPerSitting}`);
    click(button('Proceed to Mission')!);
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('does not ask again from the results screen', () => {
    const quiz = fixtureLevelQuiz(6);
    const onClose = vi.fn();
    open(quiz, 5, { onClose });
    sit(quiz, wrong);
    click(button('Back to Briefing')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('takes a fresh seed on retry', () => {
    const quiz = fixtureLevelQuiz(6);
    let seed = 0;
    const newSeed = vi.fn(() => ++seed * 104729);
    act(() => root.render(<MissionQuiz quiz={quiz} levelId={1} onPass={() => {}} onClose={() => {}} newSeed={newSeed} />));
    const calls = newSeed.mock.calls.length;
    sit(quiz, wrong);
    click(button('Retry Checkpoint')!);
    expect(newSeed.mock.calls.length).toBe(calls + 1);
  });
});

describe('MissionQuiz clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const clock = () => container.querySelector('[role="timer"]')!.textContent;
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it('gives the sitting one minute per item it asks', () => {
    const quiz = fixtureLevelQuiz(12, { itemsPerSitting: 10, passingScore: 6 });
    expect(quizTimeLimitSeconds(quiz.itemsPerSitting)).toBe(10 * QUIZ_SECONDS_PER_ITEM);
    open(quiz, 5);
    expect(clock()).toBe('10:00');
    advance(61_000);
    expect(clock()).toBe('8:59');
  });

  it('ends the sitting when time runs out, with unanswered items wrong and recorded as such', () => {
    const quiz = fixtureLevelQuiz(6);
    const onFinish = vi.fn();
    open(quiz, 5, { onFinish });
    // Two right, then the clock runs out.
    for (let i = 0; i < 2; i++) {
      const q = itemNamed(quiz, heading());
      pick(q.options[q.correctIndex]);
    }
    advance(quizTimeLimitSeconds(quiz.itemsPerSitting) * 1000);
    const text = container.textContent!;
    expect(text).toContain("Time's up");
    expect(text).toContain(`Score: 2 / ${quiz.itemsPerSitting}`);
    expect(text.match(/No answer/g)).toHaveLength(quiz.itemsPerSitting - 2);

    const sitting: QuizSittingDoc = onFinish.mock.calls[0][0];
    expect(sitting.timedOut).toBe(true);
    expect(sitting.answers.filter(answer => answer.chosen === null)).toHaveLength(quiz.itemsPerSitting - 2);
  });

  it('warns once 30 seconds are left, and not before', () => {
    const quiz = fixtureLevelQuiz(6);
    const warning = () => container.querySelector('[role="alert"]');
    open(quiz, 5);
    advance(quizTimeLimitSeconds(quiz.itemsPerSitting) * 1000 - 31_000);
    expect(warning()).toBeNull();

    advance(1_000);
    expect(warning()!.textContent).toContain('Under 30 seconds left');
    expect(warning()!.textContent).toContain('count as wrong');
  });

  it('shows the time left in the leave question', () => {
    const quiz = fixtureLevelQuiz(6);
    open(quiz, 5);
    advance(90_000);
    click(button('Back to Briefing')!);
    expect(container.querySelector('[role="alertdialog"]')!.textContent).toContain('4:30 left');
  });

  it('keeps running while the leave question is open, and resets on retry', () => {
    const quiz = fixtureLevelQuiz(6);
    open(quiz, 5);
    click(button('Back to Briefing')!);
    advance(quizTimeLimitSeconds(quiz.itemsPerSitting) * 1000);
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.textContent).toContain("Time's up");

    click(button('Retry Checkpoint')!);
    expect(container.textContent).not.toContain("Time's up");
    expect(clock()).toBe('6:00');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe('MissionQuiz in the language chosen', () => {
  it('shows reviewed Filipino, scores by the same key and names the language', () => {
    const base = fixtureLevelQuiz(3, { passingScore: 1 });
    const items = base.items.map(item => ({
      ...item,
      fil: {
        question: `XX ${item.id}`,
        options: item.options.map(option => `XX ${option}`),
        explanation: 'XX why',
        status: 'reviewed' as const,
        sourceText: scenarioFingerprint(textsOf(item, ['question', 'options.*', 'explanation'])),
      },
    }));
    const quiz = { ...base, items };
    const finish = vi.fn();
    act(() =>
      root.render(
        <LanguageProvider value={{ language: 'fil', chosen: true, choose: () => {} }}>
          <MissionQuiz quiz={quiz} levelId={1} onPass={() => {}} onClose={() => {}} onFinish={finish} newSeed={() => 9} />
        </LanguageProvider>
      )
    );
    expect(container.textContent).toContain('XX L1-GR-');
    for (let i = 0; i < quiz.itemsPerSitting; i++) {
      const q = items.find(item => heading() === item.fil.question)!;
      pick(q.fil.options[q.correctIndex]);
    }
    expect(container.textContent).toContain('XX why');
    expect(finish.mock.calls[0][0]).toMatchObject({ language: 'fil', score: 3, passed: true });
  });
});
