import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { ProgressRepository } from '@/features/progression/application/ports';
import type { UserProgressSummary } from '@/features/progression/domain/progressSummary';

const getProgressSummary = async (uid: string): Promise<UserProgressSummary | null> => {
  const snap = await getDoc(doc(db, 'users', uid, 'progress', 'summary'));
  return snap.exists() ? (snap.data() as UserProgressSummary) : null;
};

const saveProgressSummary = async (uid: string, summary: UserProgressSummary) => {
  await setDoc(doc(db, 'users', uid, 'progress', 'summary'), summary);
};

/**
 * Progression's denormalized copy of the running total on the account document,
 * so the admin report can list every player without reading each one's summary.
 * Merged, never overwritten: the other two denormalized fields belong to Daily
 * Challenge and Mock Exam, which write them through their own repositories.
 */
const saveTotalScore = async (uid: string, totalScore: number) => {
  await setDoc(doc(db, 'users', uid), { totalScore }, { merge: true });
};

export const firebaseProgressRepository: ProgressRepository = {
  getSummary: getProgressSummary,
  saveSummary: saveProgressSummary,
  saveTotalScore,
};
