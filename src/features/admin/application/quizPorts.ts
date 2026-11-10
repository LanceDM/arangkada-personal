/**
 * The Short Quiz bank as the editor reaches it: every item of every
 * level, test items included, and each module's settings. Bound by this
 * feature's `composition.ts`.
 */
import type { QuizItemDoc, QuizModuleDoc } from '@/features/driving-sim';

export interface QuizBankSnapshot {
  items: QuizItemDoc[];
  modules: QuizModuleDoc[];
}

export interface QuizEditorRepository {
  loadAll(): Promise<QuizBankSnapshot>;
  /** One item at its next revision; the rules refuse a stale one. */
  saveItem(item: QuizItemDoc): Promise<void>;
  saveModule(settings: QuizModuleDoc): Promise<void>;
  /** An import's writes, in batches; each batch is all or nothing. */
  saveItems(items: readonly QuizItemDoc[]): Promise<void>;
}
