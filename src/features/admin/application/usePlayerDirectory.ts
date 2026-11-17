/**
 * Admin > Players: every account (the profiles and the study registry), read
 * once when the page opens; and one account's course log, BKT update log and
 * saved attempts, read only when the admin opens that account. Nothing is
 * written.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EVIDENCE_BKT_MODEL } from '@/domain/learner/mastery/evidenceBKT';
import { courseLogRowOf, playerBkt, playerCourseRows, type CourseLogRow } from '@/features/admin/domain/courseAdmin';
import { directoryAttemptOf, directoryPlayers, playerHistory } from '@/features/admin/domain/playerDirectory';
import { adminDeps } from './dependencies';

const message = (error: unknown) => (error instanceof Error ? error.message : error ? String(error) : null);

export const usePlayerDirectory = (enabled: boolean) => {
  const query = useQuery({
    queryKey: ['admin-player-directory'],
    queryFn: async () => {
      const { report, pilotRecords } = adminDeps();
      const [users, pool] = await Promise.all([report.users(), pilotRecords.pool()]);
      return directoryPlayers(users, pool);
    },
    enabled,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  return {
    players: query.data ?? [],
    loading: query.isFetching,
    error: message(query.error),
    refresh: () => void query.refetch(),
  };
};

export const usePlayerRecords = (uid: string | null, label: string) => {
  const query = useQuery({
    queryKey: ['admin-player-records', uid],
    queryFn: async () => {
      const { courseLogs, pilotRecords } = adminDeps();
      const [course, bkt, attempts] = await Promise.all([
        courseLogs.courseLog(uid!),
        courseLogs.bktUpdates(uid!),
        pilotRecords.attemptsFrom(uid!, null),
      ]);
      const rows = course.map(data => courseLogRowOf(uid!, data)).filter((row): row is CourseLogRow => row !== null);
      return { rows, unread: course.length - rows.length, bkt, attempts: attempts.map(a => directoryAttemptOf(a.id, a.savedAt, a.data)) };
    },
    enabled: uid !== null,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const derived = useMemo(() => {
    if (!query.data || !uid) return null;
    const named = () => label;
    const { rows, unread, bkt, attempts } = query.data;
    return {
      standing: playerCourseRows(rows, named)[0] ?? null,
      bkt: playerBkt(bkt, named, EVIDENCE_BKT_MODEL.pInit)[0] ?? null,
      courseLog: [...rows].sort((a, b) => b.timestamp - a.timestamp),
      history: playerHistory(attempts, rows),
      drives: attempts.length,
      unread,
    };
  }, [query.data, uid, label]);
  return { records: derived, loading: query.isFetching, error: message(query.error), refresh: () => void query.refetch() };
};
