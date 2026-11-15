/** One account's course reset, and its past resets (domain/progressReset.ts). */
import { useCallback, useEffect, useState } from 'react';
import { adminDeps } from './dependencies';
import { resetRefusal, type ProgressResetRecord, type ResetTarget } from '@/features/admin/domain/progressReset';

export type SavedReset = ProgressResetRecord & { resetId: string };

export const useProgressReset = (target: ResetTarget) => {
  const repo = adminDeps().progressReset;
  const [history, setHistory] = useState<SavedReset[] | null>(null);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!repo) return;
    let cancelled = false;
    Promise.all([repo.history(target.uid), repo.isEnrolled(target.uid)])
      .then(([past, isEnrolled]) => {
        if (cancelled) return;
        setHistory(past);
        setEnrolled(isEnrolled);
      })
      .catch(failure => !cancelled && setError(failure instanceof Error ? failure.message : String(failure)));
    return () => {
      cancelled = true;
    };
  }, [repo, target.uid, nonce]);

  const refusal = enrolled === null ? null : resetRefusal(target, enrolled);

  const reset = useCallback(
    async (admin: { uid: string; email: string | null }, note: string): Promise<SavedReset> => {
      if (!repo) throw new Error('Resetting is not available here.');
      // Checked again at the moment of the reset, not only when the panel opened.
      const refused = resetRefusal(target, await repo.isEnrolled(target.uid));
      if (refused) throw new Error(refused);
      const saved = await repo.reset(target.uid, admin, note);
      setNonce(n => n + 1);
      return saved;
    },
    [repo, target]
  );

  return { wired: !!repo, history, refusal, checking: !!repo && enrolled === null && !error, error, reset };
};
