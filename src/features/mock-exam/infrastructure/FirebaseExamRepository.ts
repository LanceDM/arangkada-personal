import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { readQuizItem, servedItems, type QuizItemDoc } from '@/features/driving-sim';
import type { ExamRepository } from '@/features/mock-exam/application/ports';
import type { ExamAttempt } from '@/features/mock-exam/domain/examAttempt';
import { lawPartOf, type ExamQuestion } from '@/features/mock-exam/domain/examItems';

/** A served quiz item as an exam item; null when its module names no level. */
const toExamQuestion = (item: QuizItemDoc): ExamQuestion | null => {
  const level = Number(/(\d+)$/.exec(item.moduleId)?.[1]);
  if (!Number.isInteger(level)) return null;
  return {
    id: item.id,
    question: item.question,
    choices: item.options,
    correctIndex: item.correctIndex,
    level,
    lawCitation: lawPartOf(item.source),
    ...(item.image ? { image: item.image } : {}),
  };
};

/**
 * The served question bank's quiz items: the same items the short quizzes
 * draw from. Test items (`use == 'test'`) are never read here.
 */
const getExamQuestions = async (): Promise<ExamQuestion[]> => {
  const snap = await getDocs(query(collection(db, 'quiz_items'), where('use', '==', 'quiz')));
  const items = snap.docs.map(d => readQuizItem(d.id, d.data())).filter((item): item is QuizItemDoc => item !== null);
  return servedItems(items)
    .map(toExamQuestion)
    .filter((item): item is ExamQuestion => item !== null);
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
