/**
 * The Overview's data: the pool followed live, as the Pilot page follows it,
 * and the records read once per tab.
 */
import { useMemo } from 'react';
import { pilotOverview } from '@/features/admin/domain/pilotOverview';
import { recordHealth } from '@/features/admin/domain/recordHealth';
import { usePilotRecords } from './usePilotRecords';
import { usePilotSessions } from './usePilotSessions';

export const useAdminOverview = (enabled: boolean) => {
  const sessions = usePilotSessions(enabled);
  const records = usePilotRecords(enabled);
  const overview = useMemo(() => pilotOverview(sessions.rows, sessions.now), [sessions.rows, sessions.now]);
  const health = useMemo(() => (records.snapshot ? recordHealth(records.snapshot.accounts) : null), [records.snapshot]);
  const { refresh } = records;

  return {
    overview,
    poolLoading: sessions.loading,
    poolError: sessions.error,
    records: {
      health,
      loading: records.loading,
      progress: records.progress,
      error: records.error,
      readAt: records.snapshot?.readAt ?? null,
      refresh: () => void refresh(),
    },
  };
};
