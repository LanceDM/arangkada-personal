import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { readQuizItem, readQuizModule } from '@/features/driving-sim/domain/scenario/quizBank';
import type { QuizBankRepository, QuizSittingRepository } from '@/features/driving-sim/application/ports';
import type { QuizItemDoc } from '@/features/driving-sim/domain/scenario/quizBank';

/**
 * `quiz_items` and `quiz_modules`. The query names `use == 'quiz'`
 * because the rules let a player read only quiz items, and a list query is
 * allowed only when its filters prove that of every result.
 */
export const firebaseQuizBankRepository: QuizBankRepository = {
  async load(moduleId) {
    const [itemsSnap, settingsSnap] = await Promise.all([
      getDocs(query(collection(db, 'quiz_items'), where('moduleId', '==', moduleId), where('use', '==', 'quiz'))),
      getDoc(doc(db, 'quiz_modules', moduleId)),
    ]);
    const items = itemsSnap.docs
      .map(d => readQuizItem(d.id, d.data()))
      .filter((item): item is QuizItemDoc => item !== null);
    return { items, settings: readQuizModule(settingsSnap.exists() ? settingsSnap.data() : null) };
  },
  // The course's short quiz draws by competency across modules (2026-11-10).
  async loadAll() {
    const snap = await getDocs(query(collection(db, 'quiz_items'), where('use', '==', 'quiz')));
    return snap.docs
      .map(d => readQuizItem(d.id, d.data()))
      .filter((item): item is QuizItemDoc => item !== null);
  },
};

export const firebaseQuizSittingRepository: QuizSittingRepository = {
  async save(uid, sitting) {
    await addDoc(collection(db, 'users', uid, 'quizSittings'), sitting);
  },
};
