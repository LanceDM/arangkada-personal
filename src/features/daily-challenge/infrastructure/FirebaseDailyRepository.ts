import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { DailyRemoteRepository } from '@/features/daily-challenge/application/ports';
import type {
  DailyAttempt,
  DailyStreakSummary,
} from '@/features/daily-challenge/domain/dailyAttempt';

const getDailyStreak = async (uid: string): Promise<DailyStreakSummary | null> => {
  const snap = await getDoc(doc(db, 'users', uid, 'dailyStreak', 'summary'));
  return snap.exists() ? (snap.data() as DailyStreakSummary) : null;
};

const saveDailyStreak = async (uid: string, streak: DailyStreakSummary) => {
  await setDoc(doc(db, 'users', uid, 'dailyStreak', 'summary'), streak);
};

const saveDailyAttempt = async (uid: string, attempt: DailyAttempt) => {
  await addDoc(collection(db, 'users', uid, 'dailyAttempts'), attempt);
};

const getMyDailyAttempts = async (uid: string): Promise<DailyAttempt[]> => {
  const snap = await getDocs(collection(db, 'users', uid, 'dailyAttempts'));
  return snap.docs.map(d => d.data() as DailyAttempt);
};

/**
 * Daily Challenge's denormalized copy of the best streak on the account
 * document, for the admin report. Merged so the fields Progression and Mock
 * Exam own are untouched.
 */
const saveLongestStreak = async (uid: string, longestStreak: number) => {
  await setDoc(doc(db, 'users', uid), { longestStreak }, { merge: true });
};

export const firebaseDailyRepository: DailyRemoteRepository = {
  getStreak: getDailyStreak,
  saveStreak: saveDailyStreak,
  saveAttempt: saveDailyAttempt,
  myAttempts: getMyDailyAttempts,
  saveLongestStreak,
};
