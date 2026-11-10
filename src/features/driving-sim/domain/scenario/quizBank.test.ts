/**
 * The Short Quiz bank's rules: what an item must be, what a module's
 * settings must be against the items it serves, and what a level plays.
 */
import { describe, expect, it } from 'vitest';
import {
  drawSitting,
  levelQuizFrom,
  localizeQuizItem,
  quizFilipinoProblems,
  quizFilipinoState,
  quizItemProblems,
  settleFilipino,
  quizModuleProblems,
  quizSittingRecord,
  readQuizItem,
  type QuizItemDraft,
  type QuizModuleDoc,
} from './quizBank';
import { fixtureLevelQuiz, fixtureQuizItem } from './quizBank.fixture';
import { scenarioFingerprint, STYLE_GUIDE_VERSION, textsOf } from './scenarioTexts';

const draft = (overrides: Partial<QuizItemDraft> = {}): QuizItemDraft => {
  const { moduleId, question, options, correctIndex, explanation, image, competency, source, use, isActive, order } =
    fixtureQuizItem('lto_level_1', 1);
  return { moduleId, question, options, correctIndex, explanation, image, competency, source, use, isActive, order, ...overrides };
};

const settings = (overrides: Partial<QuizModuleDoc> = {}): QuizModuleDoc => ({
  schemaVersion: 1,
  moduleId: 'lto_level_1',
  hasQuiz: true,
  itemsPerSitting: 10,
  passingScore: 6,
  revision: 1,
  updatedAt: 0,
  updatedBy: 'admin',
  ...overrides,
});

describe('an item', () => {
  it('is valid as the fixture writes it, with no explanation and no picture', () => {
    expect(quizItemProblems(draft())).toEqual([]);
    expect(quizItemProblems(draft({ explanation: '', image: '' }))).toEqual([]);
  });

  it('needs its text, 2 to 4 distinct choices, one correct and a source', () => {
    expect(quizItemProblems(draft({ question: '  ' }))).toContain('The question is empty.');
    expect(quizItemProblems(draft({ options: ['Only one'] }))).toContain('An item has 2 to 4 choices.');
    expect(quizItemProblems(draft({ options: ['a', 'b', 'c', 'd', 'e'] }))).toContain('An item has 2 to 4 choices.');
    expect(quizItemProblems(draft({ options: ['Same', ' same', 'Other'] }))).toContain('Two choices are the same.');
    expect(quizItemProblems(draft({ options: ['a', ''] }))).toContain('A choice is empty.');
    expect(quizItemProblems(draft({ correctIndex: 4 }))).toContain('Mark exactly one choice correct.');
    expect(quizItemProblems(draft({ source: '' }))).toContain('The source is empty.');
    expect(quizItemProblems(draft({ question: 'x'.repeat(301) }))).toContain('The question is over 300 characters.');
  });

  it('takes a picture only from the extracted images, never a link elsewhere', () => {
    expect(quizItemProblems(draft({ image: '/arangkada_extracted_images/level3/no-u-turn.png' }))).toEqual([]);
    expect(
      quizItemProblems(draft({ image: 'https://upload.wikimedia.org/wikipedia/commons/1/14/Philippines_road_sign_R3-15.svg' }))
    ).toContain('A picture must be a file under /arangkada_extracted_images/.');
  });

  it('needs one of the 11 competencies', () => {
    expect(quizItemProblems(draft({ competency: 'cooking' as never }))).toContain('Choose a competency.');
  });

  it('reads back from Firestore, or not at all', () => {
    const { id, ...data } = fixtureQuizItem('lto_level_1', 2);
    expect(readQuizItem(id, data)).toMatchObject({ id, revision: 1, use: 'quiz' });
    expect(readQuizItem(id, { ...data, correctIndex: 9 })).toBeNull();
    expect(readQuizItem(id, { ...data, use: 'exam' })).toBeNull();
  });
});

describe("a module's settings", () => {
  it('hold a pass mark within the sitting and a sitting within the served items', () => {
    expect(quizModuleProblems(settings(), 12)).toEqual([]);
    expect(quizModuleProblems(settings({ passingScore: 11 }), 12)).toContain(
      'The pass mark is more than the items a sitting asks.'
    );
    expect(quizModuleProblems(settings(), 9)).toContain('A sitting asks 10 items, but only 9 are switched on.');
    expect(quizModuleProblems(settings({ hasQuiz: false }), 0)).toEqual([]);
  });
});

describe('what a level plays', () => {
  const moduleId = 'lto_level_1';
  const items = (count: number) => Array.from({ length: count }, (_, i) => fixtureQuizItem(moduleId, i + 1));

  it('is 10 of the served items at 6 to pass by default', () => {
    const state = levelQuizFrom(moduleId, items(30), null);
    expect(state.kind === 'quiz' && [state.quiz.itemsPerSitting, state.quiz.passingScore]).toEqual([10, 6]);
  });

  it('serves only switched-on quiz items, never a test item', () => {
    const bank = [
      ...items(3),
      fixtureQuizItem(moduleId, 4, { use: 'test' }),
      fixtureQuizItem(moduleId, 5, { isActive: false }),
    ];
    const state = levelQuizFrom(moduleId, bank, null);
    expect(state.kind === 'quiz' && state.quiz.items.map(item => item.order)).toEqual([1, 2, 3]);
  });

  it('asks every served item, and never passes above them, when fewer are served than the sitting asks', () => {
    const state = levelQuizFrom(moduleId, items(4), settings());
    expect(state.kind === 'quiz' && [state.quiz.itemsPerSitting, state.quiz.passingScore]).toEqual([4, 4]);
  });

  it('is nothing to play when no item is served, and no quiz when the level has none on purpose', () => {
    expect(levelQuizFrom(moduleId, [], null)).toEqual({ kind: 'empty' });
    expect(levelQuizFrom(moduleId, [fixtureQuizItem(moduleId, 1, { use: 'test' })], null)).toEqual({ kind: 'empty' });
    expect(levelQuizFrom(moduleId, items(5), settings({ hasQuiz: false }))).toEqual({ kind: 'no-quiz' });
  });

  it('draws a sitting by its seed: the same seed the same items, seed 0 the bank order', () => {
    const quiz = fixtureLevelQuiz(30, { itemsPerSitting: 10 });
    expect(drawSitting(quiz, 0).map(item => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(drawSitting(quiz, 77)).toEqual(drawSitting(quiz, 77));
    expect(drawSitting(quiz, 77)).not.toEqual(drawSitting(quiz, 78));
  });
});

describe('a sitting record', () => {
  it('names each item shown with its revision, and is never an ActionLog', () => {
    const quiz = fixtureLevelQuiz(3, { passingScore: 2 });
    const record = quizSittingRecord({
      quiz,
      levelId: 1,
      seed: 5,
      items: quiz.items,
      answers: { [quiz.items[0].id]: 0, [quiz.items[1].id]: 2 },
      timedOut: true,
      startedAt: 10,
      finishedAt: 20,
    });
    expect(record.answers).toEqual([
      { itemId: quiz.items[0].id, revision: 1, chosen: 0, correct: true },
      { itemId: quiz.items[1].id, revision: 1, chosen: 2, correct: false },
      { itemId: quiz.items[2].id, revision: 1, chosen: null, correct: false },
    ]);
    expect(record).toMatchObject({ score: 1, passed: false, timedOut: true, itemsPerSitting: 3 });
    expect(record).not.toHaveProperty('competency');
  });
});

describe('an item in the language chosen', () => {
  const item = fixtureQuizItem('lto_level_1', 1);
  const texts = textsOf(item, ['question', 'options.*', 'explanation']);
  const fil = {
    question: 'XX q',
    options: item.options.map((_, i) => `XX ${i}`),
    explanation: 'XX e',
    status: 'reviewed' as const,
    sourceText: scenarioFingerprint(texts),
  };
  const options = { showDrafts: false };

  it('shows reviewed Filipino on the same id, revision and answer key', () => {
    const shown = localizeQuizItem({ ...item, fil }, 'fil', options);
    expect(shown.question).toBe('XX q');
    expect(shown.options).toEqual(fil.options);
    expect(shown).toMatchObject({ id: item.id, revision: item.revision, correctIndex: item.correctIndex, source: item.source });
  });

  it('is the item itself in English, with no Filipino, unfinished, stale or unreviewed', () => {
    const withFil = { ...item, fil };
    expect(localizeQuizItem(withFil, 'en', options)).toBe(withFil);
    expect(localizeQuizItem(item, 'fil', options)).toBe(item);
    for (const over of [{ question: '' }, { sourceText: 'old' }, { status: 'draft' as const }]) {
      const bad = { ...item, fil: { ...fil, ...over } };
      expect(localizeQuizItem(bad, 'fil', options)).toBe(bad);
    }
  });

  it('scores and records a sitting the same, naming only the language', () => {
    const quiz = fixtureLevelQuiz(3, { passingScore: 2 });
    const input = { quiz, levelId: 1, seed: 7, answers: Object.fromEntries(quiz.items.map(i => [i.id, 0])), timedOut: false, startedAt: 1, finishedAt: 2 };
    const english = quizSittingRecord({ ...input, items: quiz.items });
    const shown = quiz.items.map(i => ({ ...i, question: 'XX', options: i.options.map(o => `XX ${o}`) }));
    expect(quizSittingRecord({ ...input, items: shown, language: 'fil' })).toEqual({ ...english, language: 'fil' });
  });
});

describe('saving an item’s Filipino', () => {
  const item = fixtureQuizItem('lto_level_1', 1);
  const fil = { question: 'XX', options: item.options.map((_, i) => `XX ${i}`), explanation: 'XX', status: 'draft' as const, sourceText: '' };

  it('ties it to the English when the Filipino is touched, and goes stale when only the English is', () => {
    const saved = settleFilipino({ ...item, fil }, undefined)!;
    const withFil = { ...item, fil: saved };
    expect(quizFilipinoState(withFil)).toBe('draft');
    const reworded = { ...withFil, question: 'A new question?' };
    const kept = settleFilipino(reworded, saved)!;
    expect(kept.sourceText).toBe(saved.sourceText);
    expect(quizFilipinoState({ ...reworded, fil: kept })).toBe('stale');
    const redone = settleFilipino({ ...reworded, fil: { ...kept, question: 'XX new' } }, saved)!;
    expect(quizFilipinoState({ ...reworded, fil: redone })).toBe('draft');
  });

  it('drops a block with nothing in it', () => {
    expect(settleFilipino({ ...item, fil: { ...fil, question: ' ', explanation: '', options: item.options.map(() => '') } }, undefined)).toBeUndefined();
  });

  it('asks a review for its signature, and a draft for nothing', () => {
    const good = { ...fil, status: 'reviewed' as const, translatedBy: 'AB', reviewedBy: 'CD', reviewedOn: '2026-11-09', guide: STYLE_GUIDE_VERSION };
    expect(quizFilipinoProblems({ options: item.options, fil: { ...fil, question: '' } })).toEqual([]);
    expect(quizFilipinoProblems({ options: item.options, fil: good })).toEqual([]);
    expect(quizFilipinoProblems({ options: item.options, fil: { ...good, reviewedBy: 'ab' , translatedBy: 'AB'} })).toContain('Reviewed by its own translator.');
    expect(quizFilipinoProblems({ options: ['a'], fil: good }).join()).toMatch(/one choice for each/);
  });
});
