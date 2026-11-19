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
    const now = Date.now();
    if (!bank || now - bank.at > BANK_FOR_MS) {
      const at = now;
      const loading = getDocs(query(collection(db, 'quiz_items'), where('use', '==', 'quiz'))).then(snap =>
        snap.docs.map(d => readQuizItem(d.id, d.data())).filter((item): item is QuizItemDoc => item !== null)
      );
      bank = { at, loading };
      // A failed read is not kept: the next quiz reads again.
      loading.catch(() => {
        if (bank?.loading === loading) bank = null;
      });
    }
    return bank.loading;
  },
};

/**
 * The whole bank, read once and kept for a while (2026-11-18). Every short quiz
 * and every retake used to read all ~300 items again, which was most of a
 * player's Firestore reads. The bank changes only when an admin edits it; a
 * page reload, or this window running out, reads it fresh, and each sitting
 * still records the revision of every item it asked.
 */
const BANK_FOR_MS = 30 * 60_000;
let bank: { at: number; loading: Promise<QuizItemDoc[]> } | null = null;

export const firebaseQuizSittingRepository: QuizSittingRepository = {
  async save(uid, sitting) {
    await addDoc(collection(db, 'users', uid, 'quizSittings'), sitting);
  },
};
