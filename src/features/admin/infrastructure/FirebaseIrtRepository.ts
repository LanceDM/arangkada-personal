import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { IRT_REPORT_PATH } from '@/domain/assessment/irtReport';
import { isStudyCohort } from '@/domain/study/participantCode';
import { readQuizItem, type QuizItemDoc } from '@/features/driving-sim';
import type { IrtRepository } from '@/features/admin/application/irtPorts';

const dataAt = async (path: string): Promise<unknown> => {
  const snap = await getDoc(doc(db, path));
  return snap.exists() ? snap.data() : null;
};

/**
 * The IRT section's documents, read with an admin's sign-in. The report and
 * the design are written by the developers' scripts alone; the only write
 * here is a review sheet, whole.
 */
export const firebaseIrtRepository: IrtRepository = {
  report: () => dataAt(IRT_REPORT_PATH),
  design: () => dataAt('test_designs/post'),

  async testItems() {
    const snap = await getDocs(query(collection(db, 'quiz_items'), where('use', '==', 'test')));
    return snap.docs.map(d => readQuizItem(d.id, d.data())).filter((item): item is QuizItemDoc => item !== null);
  },

  async participantTests() {
    const registry = (await getDocs(collection(db, 'participants'))).docs.flatMap(d => {
      const data = d.data() as { code?: string; cohort?: unknown; uid?: string };
      return data.uid && isStudyCohort(data.cohort) ? [{ code: data.code ?? d.id, cohort: data.cohort, uid: data.uid }] : [];
    });
    return Promise.all(registry.map(async ({ code, cohort, uid }) => {
      const [preStatus, postStatus, preSitting, postSitting] = await Promise.all([
        dataAt(`users/${uid}/testStatus/pre`),
        dataAt(`users/${uid}/testStatus/post`),
        dataAt(`users/${uid}/testSittings/pre`),
        dataAt(`users/${uid}/testSittings/post`),
      ]);
      return { code, cohort, preStatus, postStatus, preSitting, postSitting };
    }));
  },

  async reviews() {
    const [tagging, experts] = await Promise.all([dataAt('item_reviews/tagging'), dataAt('item_reviews/experts')]);
    return { tagging, experts };
  },

  async saveReview(kind, review) {
    await setDoc(doc(db, 'item_reviews', kind), review);
  },
};
