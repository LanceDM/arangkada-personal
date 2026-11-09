import { collection, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { readQuizItem, readQuizModule, type QuizItemDoc, type QuizModuleDoc } from '@/features/driving-sim';
import type { QuizEditorRepository } from '@/features/admin/application/quizPorts';

/** Firestore's limit is 500 writes a batch; each item is one. */
const BATCH_SIZE = 400;

/**
 * `quiz_items` and `quiz_modules`, read and written with an admin's sign-in.
 * Every write is a whole document: the rules check it whole, and its revision
 * against the stored one, so nothing here merges.
 */
export const firebaseQuizEditorRepository: QuizEditorRepository = {
  async loadAll() {
    const [itemsSnap, modulesSnap] = await Promise.all([
      getDocs(collection(db, 'quiz_items')),
      getDocs(collection(db, 'quiz_modules')),
    ]);
    return {
      items: itemsSnap.docs
        .map(d => readQuizItem(d.id, d.data()))
        .filter((item): item is QuizItemDoc => item !== null),
      modules: modulesSnap.docs
        .map(d => readQuizModule(d.data()))
        .filter((settings): settings is QuizModuleDoc => settings !== null),
    };
  },

  async saveItem(item) {
    await setDoc(doc(db, 'quiz_items', item.id), item);
  },

  async saveModule(settings) {
    await setDoc(doc(db, 'quiz_modules', settings.moduleId), settings);
  },

  async saveItems(items) {
    for (let start = 0; start < items.length; start += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const item of items.slice(start, start + BATCH_SIZE)) batch.set(doc(db, 'quiz_items', item.id), item);
      await batch.commit();
    }
  },
};
