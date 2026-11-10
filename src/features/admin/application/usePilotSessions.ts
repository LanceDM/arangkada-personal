/**
 * The Participants page's data: every enrolled participant's progress
 *, followed live, and the clock "last active" is read against,
 * ticked once a minute.
 */
import { useEffect, useMemo, useState } from 'react';
import { pilotRows, type PilotAccountProgress, type PilotRow } from '@/features/admin/domain/pilotProgress';
import { adminDeps } from './dependencies';

const TICK_MS = 60_000;

export interface PilotSessions {
  rows: PilotRow[];
  loading: boolean;
  error: string | null;
  now: number;
}

export const usePilotSessions = (enabled: boolean): PilotSessions => {
  const [accounts, setAccounts] = useState<PilotAccountProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    // Subscribed again by every setup, so a Strict Mode replay follows the registry afresh.
    return adminDeps().pilotPool.watch(
      next => {
        setAccounts(next);
        setError(null);
      },
      message => setError(message)
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [enabled]);

  const rows = useMemo(() => pilotRows(accounts ?? []), [accounts]);

  return { rows, loading: enabled && accounts === null && error === null, error, now };
};
