/**
 * The Short Quiz editor's state: the whole bank, read once and again
 * after every write, and the writes themselves. Every write is checked here
 * first and again by the rules, which also refuse one made over a copy
 * someone else has since saved.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_ITEMS_PER_SITTING,
  DEFAULT_PASSING_SCORE,
  QUIZ_ITEM_ID_PATTERN,
  quizItemProblems,
  quizModuleProblems,
  servedItems,
  type QuizItemDoc,
  type QuizItemDraft,
  type QuizModuleDoc,
} from '@/features/driving-sim';
import { planImport, readQuestionSheet, type ImportRow } from '@/features/admin/domain/quizImport';
import { adminDeps } from './dependencies';
import type { QuizBankSnapshot } from './quizPorts';

export type QuizBankLoad =
  | { status: 'loading' }
  | { status: 'ready'; bank: QuizBankSnapshot }
  | { status: 'error'; error: string };

export type QuizModuleSettings = Pick<QuizModuleDoc, 'hasQuiz' | 'itemsPerSitting' | 'passingScore'>;

const DEFAULT_SETTINGS: QuizModuleSettings = {
  hasQuiz: true,
  itemsPerSitting: DEFAULT_ITEMS_PER_SITTING,
  passingScore: DEFAULT_PASSING_SCORE,
};

/** A module's settings as saved, or the defaults a module without a document plays. */
export const settingsOf = (bank: QuizBankSnapshot, moduleId: string): QuizModuleSettings & { saved: QuizModuleDoc | null } => {
  const saved = bank.modules.find(settings => settings.moduleId === moduleId) ?? null;
  return { ...(saved ?? DEFAULT_SETTINGS), saved };
};

export const itemsOf = (bank: QuizBankSnapshot, moduleId: string): QuizItemDoc[] =>
  bank.items.filter(item => item.moduleId === moduleId).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

/** The level number an Item ID names: `L3-RS-01` → 3. */
const levelOfId = (id: string) => Number(/^L(\d+)-/.exec(id)?.[1] ?? NaN);

/** Problems with a new item's ID, against the bank and the level it is added to. */
export const newItemIdProblems = (bank: QuizBankSnapshot, id: string, levelId: number): string[] => {
  if (!QUIZ_ITEM_ID_PATTERN.test(id)) return ['The Item ID is not like L1-DL-01.'];
  if (levelOfId(id) !== levelId) return [`The Item ID must start with L${levelId}-.`];
  if (bank.items.some(item => item.id === id)) return [`${id} already exists.`];
  return [];
};

/**
 * Switching an item off is refused when it would leave the level unable to
 * reach its pass mark. A level with no quiz on purpose takes no check.
 */
export const switchOffProblem = (bank: QuizBankSnapshot, item: QuizItemDoc): string | null => {
  const settings = settingsOf(bank, item.moduleId);
  if (!settings.hasQuiz || !item.isActive || item.use !== 'quiz') return null;
  const left = servedItems(itemsOf(bank, item.moduleId)).length - 1;
  return left < settings.passingScore
    ? `Switching this off leaves ${left} quiz items, under the pass mark of ${settings.passingScore}. Lower the pass mark first.`
    : null;
};

const isRefusal = (error: unknown) => error instanceof Error && /permission/i.test(error.message);
const detailOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * A refused read is not a stale save: the rules refuse an admin's read only
 * where they do not grant it, which is a project whose deployed rules predate
 * the editable quiz bank, or an account whose sign-in carries no admin claim.
 */
const readMessageOf = (error: unknown) =>
  isRefusal(error)
    ? "Firestore refused the read. Either this project's deployed rules do not have quiz_items yet (deploy firestore.rules, or test on the emulators with npm run dev:emulator), or this sign-in has no admin claim (sign out and in again after grantAdmin)."
    : detailOf(error);

const saveMessageOf = (error: unknown) =>
  isRefusal(error)
    ? 'Firestore refused the save. Someone may have changed this since it was read: reload and try again.'
    : detailOf(error);

export const useQuizEditor = (uid: string | null) => {
  const [load, setLoad] = useState<QuizBankLoad>({ status: 'loading' });
  const [reads, setReads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    adminDeps()
      .quizEditor.loadAll()
      .then(bank => {
        if (!cancelled) setLoad({ status: 'ready', bank });
      })
      .catch(error => {
        if (!cancelled) setLoad({ status: 'error', error: readMessageOf(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [reads]);

  const reload = useCallback(() => setReads(n => n + 1), []);

  /** Writes and then re-reads, so what the page shows is what is stored. Resolves to an error, or null. */
  const write = useCallback(
    async (save: () => Promise<void>): Promise<string | null> => {
      try {
        await save();
        return null;
      } catch (error) {
        return saveMessageOf(error);
      } finally {
        reload();
      }
    },
    [reload]
  );

  const saveItem = useCallback(
    async (id: string, draft: QuizItemDraft, before: QuizItemDoc | null): Promise<string | null> => {
      if (!uid) return 'Sign in as an admin to save.';
      const problems = quizItemProblems(draft);
      if (problems.length) return problems.join(' ');
      const now = Date.now();
      const item: QuizItemDoc = {
        schemaVersion: 1,
        id,
        ...draft,
        revision: before ? before.revision + 1 : 1,
        createdAt: before?.createdAt ?? now,
        updatedAt: now,
        updatedBy: uid,
      };
      return write(() => adminDeps().quizEditor.saveItem(item));
    },
    [uid, write]
  );

  const saveSettings = useCallback(
    async (moduleId: string, settings: QuizModuleSettings): Promise<string | null> => {
      if (!uid || load.status !== 'ready') return 'Sign in as an admin to save.';
      const problems = quizModuleProblems(settings, servedItems(itemsOf(load.bank, moduleId)).length);
      if (problems.length) return problems.join(' ');
      const { saved } = settingsOf(load.bank, moduleId);
      return write(() =>
        adminDeps().quizEditor.saveModule({
          schemaVersion: 1,
          moduleId,
          ...settings,
          revision: saved ? saved.revision + 1 : 1,
          updatedAt: Date.now(),
          updatedBy: uid,
        })
      );
    },
    [uid, load, write]
  );

  const planSheet = useCallback(
    (csv: string): { rows: ImportRow[]; problems: string[] } | null => {
      if (!uid || load.status !== 'ready') return null;
      const sheet = readQuestionSheet(csv);
      return { rows: planImport(sheet, load.bank.items, { uid, now: Date.now() }), problems: sheet.problems };
    },
    [uid, load]
  );

  const runImport = useCallback(
    (rows: readonly ImportRow[]): Promise<string | null> => {
      const writes = rows.flatMap(row => (row.write ? [row.write] : []));
      return write(() => adminDeps().quizEditor.saveItems(writes));
    },
    [write]
  );

  return { load, reload, saveItem, saveSettings, planSheet, runImport };
};
