/**
 * One Q-table and its newest update-log entries, kept live: Firestore calls
 * back on every change, so the dashboard redraws about a second after a
 * player's decision or reward lands. Which table is the caller's (2026-11-19);
 * what was read for another table is never shown for this one.
 */
import { useEffect, useState } from 'react';
import type { LiveQTable, QUpdateRow } from '@/features/admin/domain/adminReport';
import type { QTableId } from '@/domain/competencyRouting/qTables';
import { adminDeps } from './dependencies';

interface Seen {
  tableId: QTableId;
  table: LiveQTable | null;
  updates: QUpdateRow[];
  error: string | null;
}

export const useLiveQTable = (enabled: boolean, tableId: QTableId = 'study', feedSize = 20) => {
  const [seen, setSeen] = useState<Seen | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const { live } = adminDeps();
    const patch = (change: Partial<Seen>) =>
      setSeen(previous => ({ ...(previous?.tableId === tableId ? previous : { tableId, table: null, updates: [], error: null }), ...change }));
    const fail = (failure: Error) => patch({ error: failure.message });
    const stopTable = live.watchTable(tableId, table => patch({ table }), fail);
    const stopUpdates = live.watchUpdates(tableId, feedSize, updates => patch({ updates }), fail);
    return () => {
      stopTable();
      stopUpdates();
    };
  }, [enabled, tableId, feedSize]);

  const mine = seen?.tableId === tableId ? seen : null;
  return { table: mine?.table ?? null, updates: mine?.updates ?? [], error: mine?.error ?? null };
};
