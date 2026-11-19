/** Resetting one Q-table, and its past resets (domain/qTableReset.ts). */
import { useCallback, useEffect, useState } from 'react';
import { adminDeps } from './dependencies';
import type { QTableResetRecord, QTableStart } from '@/features/admin/domain/qTableReset';
import type { QTableId } from '@/domain/competencyRouting/qTables';

export type SavedQTableReset = QTableResetRecord & { resetId: string };

export const useQTableReset = (tableId: QTableId = 'study') => {
  const repo = adminDeps().qTableReset;
  // Each answer is kept with the table it is for, so a switch of table never shows the last one's.
  const [read, setRead] = useState<{ tableId: QTableId; history: SavedQTableReset[] | null; error: string | null } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    repo
      .history(tableId)
      .then(past => !cancelled && setRead({ tableId, history: past, error: null }))
      .catch(failure => !cancelled && setRead({ tableId, history: null, error: failure instanceof Error ? failure.message : String(failure) }));
    return () => {
      cancelled = true;
    };
  }, [repo, tableId, nonce]);

  const reset = useCallback(
    async (admin: { uid: string; email: string | null }, note: string, start: QTableStart = 'empty'): Promise<SavedQTableReset> => {
      if (!repo) throw new Error('Resetting is not available here.');
      const saved = await repo.reset(tableId, admin, note, start);
      setNonce(n => n + 1);
      return saved;
    },
    [repo, tableId]
  );

  const reload = useCallback(() => setNonce(n => n + 1), []);
  const mine = read?.tableId === tableId ? read : null;

  return { wired: !!repo, history: mine?.history ?? null, error: mine?.error ?? null, reset, reload };
};
