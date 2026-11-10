/**
 * The shared Q-table and its newest update-log entries, kept live: Firestore
 * calls back on every change, so the dashboard redraws about a second after a
 * participant's decision or reward lands.
 */
import { useEffect, useState } from 'react';
import type { LiveQTable, QUpdateRow } from '@/features/admin/domain/adminReport';
import { adminDeps } from './dependencies';

export const useLiveQTable = (enabled: boolean, feedSize = 20) => {
  const [table, setTable] = useState<LiveQTable | null>(null);
  const [updates, setUpdates] = useState<QUpdateRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const { live } = adminDeps();
    const fail = (failure: Error) => setError(failure.message);
    const stopTable = live.watchTable(setTable, fail);
    const stopUpdates = live.watchUpdates(feedSize, setUpdates, fail);
    return () => {
      stopTable();
      stopUpdates();
    };
  }, [enabled, feedSize]);

  return { table, updates, error };
};
