/**
 * The four cross-user collections the admin report runs on.
 *
 * Each is fetched independently and each may fail on its own: a project whose
 * rules allow `users` but not `attempts` should still show what it can, with
 * the refusal named rather than a blank screen. That is why the failures are
 * collected per collection instead of one query rejecting the lot.
 */
import { useQuery } from '@tanstack/react-query';
import type {
  AdminCollectionErrors,
  AttemptRow,
  DailyRow,
  ExamRow,
  StudyData,
  UserRow,
} from '@/features/admin/domain/adminReport';
import { adminDeps } from './dependencies';

interface AdminData {
  users: UserRow[];
  attempts: AttemptRow[];
  examResults: ExamRow[];
  dailyResults: DailyRow[];
  study: StudyData;
  collectionErrors: AdminCollectionErrors;
}

const EMPTY: AdminData = {
  users: [],
  attempts: [],
  examResults: [],
  dailyResults: [],
  study: { courseLogs: [], sittings: [], backgrounds: [], sharedQTable: null },
  collectionErrors: {},
};

/** Runs one collection's read, returning its rows or recording why it failed. */
const attempt = async <T>(
  key: string,
  read: () => Promise<T[]>,
  errors: AdminCollectionErrors
): Promise<T[]> => {
  try {
    return await read();
  } catch (error) {
    errors[key] = error instanceof Error ? error.message : `Unable to load ${key}.`;
    return [];
  }
};

const loadAdminData = async (): Promise<AdminData> => {
  const { report } = adminDeps();
  const collectionErrors: AdminCollectionErrors = {};

  const [users, attempts, examResults, dailyResults, courseLogs, sittings, backgrounds, sharedQTable] = await Promise.all([
    attempt('users', report.users, collectionErrors),
    attempt('attempts', report.attempts, collectionErrors),
    attempt('examAttempts', report.examResults, collectionErrors),
    attempt('dailyAttempts', report.dailyResults, collectionErrors),
    attempt('courseLog', report.courseLogs, collectionErrors),
    attempt('assessmentSittings', report.sittings, collectionErrors),
    attempt('study', report.backgrounds, collectionErrors),
    attempt('policy/competencyQ', async () => [await report.sharedQTable()], collectionErrors).then(rows => rows[0] ?? null),
  ]);

  return { users, attempts, examResults, dailyResults, study: { courseLogs, sittings, backgrounds, sharedQTable }, collectionErrors };
};

export const useAdminData = (enabled: boolean) => {
  const { data = EMPTY, isFetching, refetch } = useQuery({
    queryKey: ['admin-report'],
    queryFn: loadAdminData,
    enabled,
    // The report is a snapshot an admin refreshes deliberately, not a live
    // feed: refetching it on every window focus would re-read four collection
    // groups for nothing.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const failed = Object.keys(data.collectionErrors).length > 0;

  return {
    users: data.users,
    attempts: data.attempts,
    examResults: data.examResults,
    dailyResults: data.dailyResults,
    study: data.study,
    isLoading: isFetching,
    loadError: failed
      ? 'Some Firebase collections could not be loaded. Check the collection messages below.'
      : null,
    collectionErrors: data.collectionErrors,
    loadAdminData: refetch,
  };
};
