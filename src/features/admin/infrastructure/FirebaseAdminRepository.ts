/**
 * Cross-user reads for the admin report.
 *
 * Every query here is a `collectionGroup` over subcollections other features
 * own, so `userId` is reconstructed from each document's parent path rather
 * than stored redundantly on the document.
 */
import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { AdminReportRepository } from '@/features/admin/application/ports';
import type {
  AttemptRow,
  DailyRow,
  ExamRow,
  UserRow,
} from '@/features/admin/domain/adminReport';

const ownerIdOf = (ref: { parent: { parent: { id: string } | null } }) => ref.parent.parent!.id;

const getAdminUsers = async (): Promise<UserRow[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<UserRow, 'id'>) }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
};

const getAdminAttempts = async (): Promise<AttemptRow[]> => {
  const snap = await getDocs(query(collectionGroup(db, 'attempts'), orderBy('timestamp', 'desc')));
  return snap.docs.map(d => {
    const data = d.data() as Omit<AttemptRow, 'userId'>;
    return {
      userId: ownerIdOf(d.ref),
      levelId: data.levelId,
      timestamp: data.timestamp,
      finalScore: data.finalScore,
      violations: data.violations,
      correctDecisions: data.correctDecisions,
      logs: data.logs,
    };
  });
};

const getAdminExamResults = async (): Promise<ExamRow[]> => {
  const snap = await getDocs(query(collectionGroup(db, 'examAttempts'), orderBy('timestamp', 'desc')));
  return snap.docs.map((d, index) => {
    const data = d.data() as Omit<ExamRow, 'id' | 'userId'>;
    const userId = ownerIdOf(d.ref);
    return { id: `${userId}-${data.timestamp}-${index}`, userId, ...data };
  });
};

const getAdminDailyResults = async (): Promise<DailyRow[]> => {
  const snap = await getDocs(collectionGroup(db, 'dailyAttempts'));
  return snap.docs.map((d, index) => {
    const data = d.data() as { scenarioId: string; correct: boolean; date: string };
    const userId = ownerIdOf(d.ref);
    return {
      id: `${userId}-${data.date}-${index}`,
      userId,
      scenarioId: data.scenarioId,
      correct: data.correct,
      date: data.date,
    };
  });
};

export const firebaseAdminReportRepository: AdminReportRepository = {
  users: getAdminUsers,
  attempts: getAdminAttempts,
  examResults: getAdminExamResults,
  dailyResults: getAdminDailyResults,
};
