/**
 * The admin's course views (Course flow, Q-learning, BKT): the report's course
 * logs, sittings and drives, with each player named by their study code
 * where they have one.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { decisionRows, playerCourseRows, playerMastery, stateActionStats } from '@/features/admin/domain/courseAdmin';
import { adminDeps } from './dependencies';
import { useAdminData } from './useAdminData';
import { useBktSets } from './useBktSets';
import { useQTableReset } from './useQTableReset';

export const useCourseAdmin = (enabled: boolean) => {
  const report = useAdminData(enabled);
  const participants = useQuery({
    queryKey: ['admin-participants'],
    queryFn: () => adminDeps().records.participants(),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const codes = useMemo(() => new Map((participants.data ?? []).map(p => [p.uid, p.code])), [participants.data]);
  const bkt = useBktSets(enabled);
  const { courseLogs, sittings } = report.study;

  const players = useMemo(() => playerCourseRows(courseLogs, codes, report.users), [courseLogs, codes, report.users]);
  // The table's last reset: what it has earned is counted from there.
  const resets = useQTableReset();
  const lastReset = useMemo(() => Math.max(0, ...(resets.history ?? []).map(record => record.at)), [resets.history]);
  const stats = useMemo(() => stateActionStats(courseLogs, lastReset), [courseLogs, lastReset]);
  const decisions = useMemo(() => decisionRows(courseLogs, codes, report.users), [courseLogs, codes, report.users]);
  const mastery = useMemo(
    // Each player replayed with the value set they run on.
    () => playerMastery(report.attempts, sittings, codes, report.users, undefined, bkt.modelOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.attempts, sittings, codes, report.users, bkt.models, bkt.playerSets, bkt.state]
  );

  return {
    players,
    stats,
    decisions,
    mastery,
    courseLogs,
    bkt,
    users: report.users,
    codes,
    loading: report.isLoading || participants.isFetching,
    loadedAt: report.loadedAt,
    error: report.loadError ?? (participants.error instanceof Error ? participants.error.message : null),
    collectionErrors: report.collectionErrors,
    refresh: () => {
      resets.reload();
      void report.loadAdminData();
      void participants.refetch();
      void bkt.refresh();
    },
  };
};

export type CourseAdmin = ReturnType<typeof useCourseAdmin>;
