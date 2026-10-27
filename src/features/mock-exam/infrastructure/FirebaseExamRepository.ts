import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { ExamRepository } from '@/features/mock-exam/application/ports';
import type { ExamAttempt, RemoteExamQuestion } from '@/features/mock-exam/domain/examAttempt';

/**
 * The authored question bank, when there is one. An empty result is normal and
 * means the caller should fall back to the local bank.
 */
const getExamQuestions = async (): Promise<RemoteExamQuestion[]> => {
  const snap = await getDocs(collection(db, 'exam_questions'));
  return snap.docs
    .map(d => d.data() as RemoteExamQuestion)
    .filter(q => q.isActive !== false)
    .sort((a, b) => a.id - b.id);
};

const saveExamAttempt = async (uid: string, attempt: ExamAttempt) => {
  await addDoc(collection(db, 'users', uid, 'examAttempts'), attempt);
};

/**
 * Mock Exam's denormalized copy of the best score on the account document, for
 * the admin report. Merged so the fields Progression and Daily Challenge own
 * are untouched, and read back rather than taken from the cached session
 * profile so a second sitting in the same tab compares against the real high
 * score instead of whatever was current at sign-in.
 */
const getBestExamScore = async (uid: string): Promise<number> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ((snap.data() as { bestExamScore?: number }).bestExamScore ?? 0) : 0;
};

const saveBestExamScore = async (uid: string, bestExamScore: number) => {
  await setDoc(doc(db, 'users', uid), { bestExamScore }, { merge: true });
};

export const firebaseExamRepository: ExamRepository = {
  getQuestions: getExamQuestions,
  saveAttempt: saveExamAttempt,
  getBestScore: getBestExamScore,
  saveBestScore: saveBestExamScore,
};
