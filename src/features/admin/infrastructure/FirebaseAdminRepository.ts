/**
 * Cross-user reads for the admin report.
 *
 * Every query here is a `collectionGroup` over subcollections other features
 * own, so `userId` is reconstructed from each document's parent path rather
 * than stored redundantly on the document.
 */
import { collection, collectionGroup, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { AdminReportRepository } from '@/features/admin/application/ports';
import type {
  AttemptRow,
  BackgroundRow,
  CourseLogRow,
  DailyRow,
  ExamRow,
  SharedQTableRow,
  SittingRow,
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
      ...(data.session ? { session: data.session } : {}),
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

const getAdminCourseLogs = async (): Promise<CourseLogRow[]> => {
  const snap = await getDocs(collectionGroup(db, 'courseLog'));
  return snap.docs
    .map(d => ({ ...(d.data() as Omit<CourseLogRow, 'userId'>), userId: ownerIdOf(d.ref) }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const getAdminSittings = async (): Promise<SittingRow[]> => {
  const snap = await getDocs(collectionGroup(db, 'assessmentSittings'));
  return snap.docs
    .map(d => {
      // `ability` (the Rasch estimate) is left behind: IRT is out of the export for now.
      const data = d.data() as Omit<SittingRow, 'userId'>;
      return {
        userId: ownerIdOf(d.ref),
        kind: data.kind,
        levelId: data.levelId ?? null,
        attempt: data.attempt ?? null,
        answers: data.answers ?? [],
        timestamp: data.timestamp,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);
};

const getAdminBackgrounds = async (): Promise<BackgroundRow[]> => {
  const snap = await getDocs(collectionGroup(db, 'study'));
  return snap.docs
    .filter(d => d.id === 'background')
    .map(d => {
      const data = d.data() as Omit<BackgroundRow, 'userId'>;
      return { userId: ownerIdOf(d.ref), formVersion: data.formVersion, answers: data.answers, timestamp: data.timestamp };
    });
};

const getSharedQTable = async (): Promise<SharedQTableRow | null> => {
  const snap = await getDoc(doc(db, 'policy', 'competencyQ'));
  if (!snap.exists()) return null;
  const data = snap.data() as SharedQTableRow;
  return { table: data.table ?? {}, updates: Number(data.updates ?? 0), updatedAt: Number(data.updatedAt ?? 0) };
};

export const firebaseAdminReportRepository: AdminReportRepository = {
  users: getAdminUsers,
  attempts: getAdminAttempts,
  examResults: getAdminExamResults,
  dailyResults: getAdminDailyResults,
  courseLogs: getAdminCourseLogs,
  sittings: getAdminSittings,
  backgrounds: getAdminBackgrounds,
  sharedQTable: getSharedQTable,
};
