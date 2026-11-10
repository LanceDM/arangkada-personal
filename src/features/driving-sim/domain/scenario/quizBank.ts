/**
 * The Short Quiz's item bank: what an item and a module's quiz
 * settings are, what makes them valid, how a sitting is drawn, and what a
 * sitting records.
 *
 * The bank lives in Firestore and is edited from `/admin/quiz`; nothing is
 * bundled. Two collections and one player path carry it:
 *   - `quiz_items/{itemId}`: one item, keyed by the question bank's Item ID;
 *   - `quiz_modules/{moduleId}`: a module's sitting size and pass mark, or
 *     that its level has no quiz;
 *   - `users/{uid}/quizSittings/{id}`: what one sitting showed and how it was
 *     answered, by item id and revision.
 *
 * Quiz answers are never BKT evidence: a sitting is its own record
 * and never becomes an `ActionLog`.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { Language } from '@/shared/lib/localized';
import { orderChoices, seedForQuestion } from './choiceOrder';
import { applyEntry, entryProblem, scenarioFingerprint, STYLE_GUIDE_VERSION, textsOf, type LocalizeOptions } from './scenarioTexts';

/**
 * `test` marks an item of the 60-item pre-test and post-test. The
 * game never serves one; the rules let an admin read it, and a participant
 * only while their own pre-test is open.
 */
export type QuizItemUse = 'quiz' | 'test';
export const QUIZ_ITEM_USES: readonly QuizItemUse[] = ['quiz', 'test'];

/**
 * An item's Filipino. Choices sit in the English's order, so the
 * answer key is the same index in both. `source` is a citation and stays as
 * written. Quiz items are public, so the team signs with initials, never a name.
 */
export interface QuizItemFilipino {
  question: string;
  options: string[];
  explanation: string;
  status: 'draft' | 'reviewed';
  /** `scenarioFingerprint` of the English this was written against. */
  sourceText: string;
  translatedBy?: string;
  reviewedBy?: string;
  reviewedOn?: string;
  guide?: string;
}

/** What an admin writes: everything but the bookkeeping. */
export interface QuizItemDraft {
  moduleId: string;
  question: string;
  options: string[];
  correctIndex: number;
  /** Optional: the question bank has no explanation column. */
  explanation: string;
  /** A picture under `/arangkada_extracted_images/`, or empty. */
  image: string;
  competency: DrivingCompetency;
  /** The official basis, as the question bank cites it. */
  source: string;
  use: QuizItemUse;
  isActive: boolean;
  order: number;
  fil?: QuizItemFilipino;
}

export interface QuizItemDoc extends QuizItemDraft {
  schemaVersion: 1;
  /** The question bank's Item ID, also the document id. */
  id: string;
  /** 1 when created, one more on every edit. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  /** The admin's account id. */
  updatedBy: string;
}

export interface QuizModuleDoc {
  schemaVersion: 1;
  moduleId: string;
  /** False for a level that has no quiz on purpose: its drive opens at once. */
  hasQuiz: boolean;
  itemsPerSitting: number;
  passingScore: number;
  revision: number;
  updatedAt: number;
  updatedBy: string;
}

/**
 * The editor's limits. The text caps are about one and a half times the
 * longest item in the question bank (145, 117 and 85 characters) and keep an
 * item on one screen; 2–4 choices is the bank's own form, which the LTO
 * reviewer also uses. Assumptions are the team's.
 */
export const QUIZ_ITEM_LIMITS = {
  questionMax: 300,
  optionMax: 160,
  explanationMax: 600,
  sourceMax: 200,
  optionsMin: 2,
  optionsMax: 4,
} as const;

/**
 * A sitting draws 10 items and passes at 6: the "6 of 10" of
 * The module specification, the team's own specification, not an LTO
 * rule. Both are per module and editable.
 */
export const DEFAULT_ITEMS_PER_SITTING = 10;
export const DEFAULT_PASSING_SCORE = 6;

/** Where an item's picture must live: the curriculum's own extracted images. */
export const QUIZ_IMAGE_PREFIX = '/arangkada_extracted_images/';

/** The question bank's IDs: module, competency, number, e.g. `L1-DL-01`. */
export const QUIZ_ITEM_ID_PATTERN = /^L\d{1,2}-[A-Z]{2}-\d{2,3}$/;

const blank = (text: string) => text.trim().length === 0;

/** Every problem with a draft, in words an admin can act on; empty when valid. */
export const quizItemProblems = (draft: QuizItemDraft): string[] => {
  const problems: string[] = [];
  const L = QUIZ_ITEM_LIMITS;
  if (blank(draft.question)) problems.push('The question is empty.');
  if (draft.question.length > L.questionMax) problems.push(`The question is over ${L.questionMax} characters.`);
  if (draft.options.length < L.optionsMin || draft.options.length > L.optionsMax) {
    problems.push(`An item has ${L.optionsMin} to ${L.optionsMax} choices.`);
  }
  if (draft.options.some(blank)) problems.push('A choice is empty.');
  if (draft.options.some(option => option.length > L.optionMax)) problems.push(`A choice is over ${L.optionMax} characters.`);
  const distinct = new Set(draft.options.map(option => option.trim().toLowerCase()));
  if (distinct.size !== draft.options.length) problems.push('Two choices are the same.');
  if (!Number.isInteger(draft.correctIndex) || draft.correctIndex < 0 || draft.correctIndex >= draft.options.length) {
    problems.push('Mark exactly one choice correct.');
  }
  if (draft.explanation.length > L.explanationMax) problems.push(`The explanation is over ${L.explanationMax} characters.`);
  if (blank(draft.source)) problems.push('The source is empty.');
  if (draft.source.length > L.sourceMax) problems.push(`The source is over ${L.sourceMax} characters.`);
  if (draft.image && !draft.image.startsWith(QUIZ_IMAGE_PREFIX)) {
    problems.push(`A picture must be a file under ${QUIZ_IMAGE_PREFIX}.`);
  }
  if (!COMPETENCIES.includes(draft.competency)) problems.push('Choose a competency.');
  if (!QUIZ_ITEM_USES.includes(draft.use)) problems.push('Choose quiz or test.');
  if (blank(draft.moduleId)) problems.push('Choose a level.');
  if (!Number.isInteger(draft.order) || draft.order < 0) problems.push('The order is not a whole number.');
  return problems;
};

/** The items a sitting may draw from: switched on, and quiz items. */
export const servedItems = <T extends Pick<QuizItemDraft, 'isActive' | 'use'>>(items: readonly T[]): T[] =>
  items.filter(item => item.isActive && item.use === 'quiz');

/** Every problem with a module's settings against the items it now serves. */
export const quizModuleProblems = (
  settings: Pick<QuizModuleDoc, 'hasQuiz' | 'itemsPerSitting' | 'passingScore'>,
  servedCount: number
): string[] => {
  if (!settings.hasQuiz) return [];
  const problems: string[] = [];
  const { itemsPerSitting, passingScore } = settings;
  if (!Number.isInteger(itemsPerSitting) || itemsPerSitting < 1) problems.push('A sitting asks at least one item.');
  if (!Number.isInteger(passingScore) || passingScore < 1) problems.push('The pass mark is at least 1.');
  if (passingScore > itemsPerSitting) problems.push('The pass mark is more than the items a sitting asks.');
  if (itemsPerSitting > servedCount) {
    problems.push(`A sitting asks ${itemsPerSitting} items, but only ${servedCount} are switched on.`);
  }
  return problems;
};

/** What the game plays: one module's served items and its sitting's size and pass mark. */
export interface LevelQuiz {
  moduleId: string;
  items: QuizItemDoc[];
  itemsPerSitting: number;
  passingScore: number;
}

/**
 * What a level's briefing gets from the bank: a quiz, a level with no quiz on
 * purpose, or nothing to play, which blocks the level (no bundled fallback).
 */
export type LevelQuizState =
  | { kind: 'quiz'; quiz: LevelQuiz }
  | { kind: 'no-quiz' }
  | { kind: 'empty' };

const byOrder = (a: QuizItemDoc, b: QuizItemDoc) => a.order - b.order || a.id.localeCompare(b.id);

/**
 * A module's quiz from what the bank holds. A module with no settings document
 * takes the defaults. A sitting never asks more items than are served, and its
 * pass mark never exceeds its size, so an item switched off after the
 * settings were saved shortens the sitting rather than making it unpassable.
 */
export const levelQuizFrom = (
  moduleId: string,
  items: readonly QuizItemDoc[],
  settings: QuizModuleDoc | null
): LevelQuizState => {
  if (settings && !settings.hasQuiz) return { kind: 'no-quiz' };
  const served = servedItems(items.filter(item => item.moduleId === moduleId)).sort(byOrder);
  if (served.length === 0) return { kind: 'empty' };
  const size = Math.min(settings?.itemsPerSitting ?? DEFAULT_ITEMS_PER_SITTING, served.length);
  const passingScore = Math.max(1, Math.min(settings?.passingScore ?? DEFAULT_PASSING_SCORE, size));
  return { kind: 'quiz', quiz: { moduleId, items: served, itemsPerSitting: size, passingScore } };
};

/**
 * One sitting's items, in the order they are asked: a seeded shuffle of every
 * served item, cut to the sitting's size. Seed 0 keeps the bank's order.
 */
export const drawSitting = (quiz: LevelQuiz, seed: number): QuizItemDoc[] =>
  orderChoices(quiz.items, seedForQuestion(seed, `${quiz.moduleId}.quiz`)).slice(0, quiz.itemsPerSitting);

export interface QuizSittingAnswer {
  itemId: string;
  revision: number;
  /** The authored index of the choice picked; null when the clock ran out first. */
  chosen: number | null;
  correct: boolean;
}

/** `users/{uid}/quizSittings/{id}`: what one finished sitting showed and how it went. */
export interface QuizSittingDoc {
  schemaVersion: 1;
  moduleId: string;
  levelId: number;
  seed: number;
  answers: QuizSittingAnswer[];
  score: number;
  itemsPerSitting: number;
  passingScore: number;
  passed: boolean;
  timedOut: boolean;
  startedAt: number;
  finishedAt: number;
  /** The language chosen when the sitting began. */
  language?: Language;
}

export const quizSittingRecord = (input: {
  quiz: LevelQuiz;
  levelId: number;
  seed: number;
  items: readonly QuizItemDoc[];
  answers: Readonly<Record<string, number>>;
  timedOut: boolean;
  startedAt: number;
  finishedAt: number;
  language?: Language;
}): QuizSittingDoc => {
  const answers = input.items.map(item => {
    const chosen = input.answers[item.id] ?? null;
    return { itemId: item.id, revision: item.revision, chosen, correct: chosen === item.correctIndex };
  });
  const score = answers.filter(answer => answer.correct).length;
  return {
    schemaVersion: 1,
    moduleId: input.quiz.moduleId,
    levelId: input.levelId,
    seed: input.seed,
    answers,
    score,
    itemsPerSitting: input.items.length,
    passingScore: input.quiz.passingScore,
    passed: score >= input.quiz.passingScore,
    timedOut: input.timedOut,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    ...(input.language ? { language: input.language } : {}),
  };
};

const ITEM_TEXT_PATHS = ['question', 'options.*', 'explanation'];

const itemFingerprint = (item: Pick<QuizItemDraft, 'question' | 'options' | 'explanation'>) =>
  scenarioFingerprint(textsOf(item, ITEM_TEXT_PATHS));

const filipinoTexts = (fil: QuizItemFilipino): Record<string, string> => ({
  question: fil.question,
  explanation: fil.explanation,
  ...Object.fromEntries(fil.options.map((choice, index) => [`options.${index}`, choice])),
});

export type QuizFilipinoState = 'none' | 'incomplete' | 'stale' | 'draft' | 'reviewed';

/** Where an item's Filipino stands, as the editor's badge and the import's preview say it. */
export const quizFilipinoState = (item: Pick<QuizItemDraft, 'question' | 'options' | 'explanation' | 'fil'>): QuizFilipinoState => {
  if (!item.fil) return 'none';
  return (
    entryProblem(textsOf(item, ITEM_TEXT_PATHS), { source: item.fil.sourceText, status: item.fil.status, fil: filipinoTexts(item.fil) }) ??
    'reviewed'
  );
};

/** The same block whatever order its keys were stored in, with its fingerprint set aside. */
const filipinoContent = (fil: QuizItemFilipino | undefined): string => {
  if (!fil) return '';
  const { question, options, explanation, status, translatedBy, reviewedBy, reviewedOn, guide } = fil;
  return JSON.stringify([question, options, explanation, status, translatedBy ?? '', reviewedBy ?? '', reviewedOn ?? '', guide ?? '']);
};

export const sameFilipino = (a: QuizItemFilipino | undefined, b: QuizItemFilipino | undefined): boolean =>
  filipinoContent(a) === filipinoContent(b) && a?.sourceText === b?.sourceText;

/**
 * The block to save. Touching the Filipino or its review ties it to the English
 * as it stands now; changing only the English leaves the old fingerprint, which
 * is what makes it stale. A block with no Filipino in it is no block.
 */
export const settleFilipino = (
  draft: Pick<QuizItemDraft, 'question' | 'options' | 'explanation' | 'fil'>,
  before: QuizItemFilipino | undefined
): QuizItemFilipino | undefined => {
  const { fil } = draft;
  if (!fil || (!fil.question.trim() && !fil.explanation.trim() && fil.options.every(choice => !choice.trim()))) return undefined;
  const untouched = before && filipinoContent(fil) === filipinoContent(before);
  return { ...fil, sourceText: untouched ? before.sourceText : itemFingerprint(draft) };
};

/** Everything wrong with a block, in words an admin can act on (D8). Initials only: items are public. */
export const quizFilipinoProblems = (draft: Pick<QuizItemDraft, 'options' | 'fil'>): string[] => {
  const { fil } = draft;
  if (!fil) return [];
  const L = QUIZ_ITEM_LIMITS;
  const problems: string[] = [];
  if (fil.question.length > L.questionMax * 1.5) problems.push(`The Filipino question is over ${L.questionMax * 1.5} characters.`);
  if (fil.options.length !== draft.options.length) problems.push('The Filipino needs one choice for each English one.');
  if (fil.options.some(choice => choice.length > L.optionMax * 1.5)) problems.push(`A Filipino choice is over ${L.optionMax * 1.5} characters.`);
  if (fil.explanation.length > L.explanationMax * 1.5) problems.push(`The Filipino explanation is over ${L.explanationMax * 1.5} characters.`);
  if (fil.status === 'reviewed') {
    if (!fil.question.trim() || fil.options.some(choice => !choice.trim())) problems.push('Reviewed, with a Filipino field left blank.');
    if (!fil.translatedBy?.trim()) problems.push('Reviewed, with no translator named.');
    if (!fil.reviewedBy?.trim()) problems.push('Reviewed, with no reviewer named.');
    if (fil.reviewedBy?.trim() && fil.reviewedBy.trim().toLowerCase() === fil.translatedBy?.trim().toLowerCase()) {
      problems.push('Reviewed by its own translator.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fil.reviewedOn ?? '')) problems.push('The review date must be YYYY-MM-DD.');
    if (fil.guide !== STYLE_GUIDE_VERSION) problems.push(`The review must be against guide ${STYLE_GUIDE_VERSION}.`);
  }
  return problems;
};

/**
 * An item as this language shows it: the same id, revision and answer key, under
 * L3a's rules (all or nothing, a review goes stale when its English changes).
 */
export const localizeQuizItem = (item: QuizItemDoc, language: Language, options: LocalizeOptions): QuizItemDoc => {
  if (language === 'en' || !item.fil) return item;
  const { question, options: choices, explanation, sourceText, status, translatedBy, reviewedBy, reviewedOn, guide } = item.fil;
  const fil: Record<string, string> = { question, explanation };
  choices.forEach((choice, index) => {
    fil[`options.${index}`] = choice;
  });
  return applyEntry(item, ITEM_TEXT_PATHS, { source: sourceText, status, translatedBy, reviewedBy, reviewedOn, guide, fil }, options);
};

const isText = (value: unknown): value is string => typeof value === 'string';
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * An item as Firestore hands it back, or null when it is not one: the rules
 * check the shape on every write, so this only guards against a document
 * written outside them.
 */
export const readQuizItem = (id: string, data: Record<string, unknown>): QuizItemDoc | null => {
  const options = data.options;
  if (
    !isText(data.moduleId) || !isText(data.question) || !isText(data.source) ||
    !Array.isArray(options) || !options.every(isText) ||
    !isCount(data.correctIndex) || data.correctIndex >= options.length ||
    !COMPETENCIES.includes(data.competency as DrivingCompetency) ||
    !QUIZ_ITEM_USES.includes(data.use as QuizItemUse) ||
    typeof data.isActive !== 'boolean' || !isCount(data.revision)
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    moduleId: data.moduleId,
    question: data.question,
    options,
    correctIndex: data.correctIndex,
    explanation: isText(data.explanation) ? data.explanation : '',
    image: isText(data.image) ? data.image : '',
    competency: data.competency as DrivingCompetency,
    source: data.source,
    use: data.use as QuizItemUse,
    isActive: data.isActive,
    order: isCount(data.order) ? data.order : 0,
    revision: data.revision,
    createdAt: Number(data.createdAt ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
    updatedBy: isText(data.updatedBy) ? data.updatedBy : '',
    ...(data.fil && typeof data.fil === 'object' ? { fil: data.fil as QuizItemFilipino } : {}),
  };
};

export const readQuizModule = (data: Record<string, unknown> | null): QuizModuleDoc | null =>
  data && isText(data.moduleId) && typeof data.hasQuiz === 'boolean' && isCount(data.itemsPerSitting) && isCount(data.passingScore)
    ? {
        schemaVersion: 1,
        moduleId: data.moduleId,
        hasQuiz: data.hasQuiz,
        itemsPerSitting: data.itemsPerSitting,
        passingScore: data.passingScore,
        revision: isCount(data.revision) ? data.revision : 0,
        updatedAt: Number(data.updatedAt ?? 0),
        updatedBy: isText(data.updatedBy) ? data.updatedBy : '',
      }
    : null;
