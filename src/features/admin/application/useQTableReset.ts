/** Resetting the shared Q-table, and its past resets (domain/qTableReset.ts). */
import { useCallback, useEffect, useState } from 'react';
import { adminDeps } from './dependencies';
import type { QTableResetRecord } from '@/features/admin/domain/qTableReset';

export type SavedQTableReset = QTableResetRecord & { resetId: string };

export const useQTableReset = () => {
  const repo = adminDeps().qTableReset;
  const [history, setHistory] = useState<SavedQTableReset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    repo
      .history()
      .then(past => !cancelled && setHistory(past))
      .catch(failure => !cancelled && setError(failure instanceof Error ? failure.message : String(failure)));
    return () => {
      cancelled = true;
    };
  }, [repo, nonce]);

  const reset = useCallback(
    async (admin: { uid: string; email: string | null }, note: string): Promise<SavedQTableReset> => {
      if (!repo) throw new Error('Resetting is not available here.');
      const saved = await repo.reset(admin, note);
      setNonce(n => n + 1);
      return saved;
    },
    [repo]
  );

  const reload = useCallback(() => setNonce(n => n + 1), []);

  return { wired: !!repo, history, error, reset, reload };
};
