/**
 * Whether the signed-in participant has taken the initial exam (the study's
 * 60-item pre-test since 2026-11-10), for the main menu and the route guard.
 *
 * The exam gates every mode only while the study course is on (the New
 * switch). Developer builds and admins are never locked out, so the group can
 * test each mode; the lock still shows them what a participant would see.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { initialExamRequired, loadInitialExamStatus, type InitialExamStatus } from '@/features/driving-sim';

export interface InitialExamGate {
  /** Still finding out. */
  loading: boolean;
  /** The study course is on: the initial exam gates the other modes. */
  required: boolean;
  /** Signed in: only a signed-in participant's exam is saved. */
  signedIn: boolean;
  status: InitialExamStatus | null;
  /** The other modes are locked for this person now. */
  locked: boolean;
  /** Admin, developer build, or a signed-in account that is not a study account: shown the lock, never held by it. */
  bypass: boolean;
  /** A study participant's account (signed in by username): the one the pre-test is for. */
  participant: boolean;
  /** Could not read the status (offline): the modes stay locked and say so. */
  error: string | null;
  refresh: () => void;
}

export const useInitialExam = (): InitialExamGate => {
  const { user, isLoggedIn, isAdmin, loading: authLoading, studyAccount } = useAuthSession();
  const uid = isLoggedIn && user ? user.uid : null;
  const required = initialExamRequired();
  // The initial exam is the study's pre-test (2026-11-10), which only a study
  // account can sit: any other signed-in account is never held by it.
  const participant = uid !== null && studyAccount;
  const bypass = import.meta.env.DEV || isAdmin || (uid !== null && !studyAccount);
  const [status, setStatus] = useState<{ uid: string; value: InitialExamStatus } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!uid || !required) return;
    let cancelled = false;
    loadInitialExamStatus(uid)
      .then(value => {
        if (cancelled) return;
        setStatus({ uid, value });
        setError(null);
      })
      .catch(failure => {
        console.error('Could not read the initial exam status:', failure);
        if (!cancelled) setError('Could not check your initial exam. Check your connection and reload.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, required, nonce]);

  const mine = status && status.uid === uid ? status.value : null;
  const loading = required && (authLoading || (uid !== null && mine === null && error === null));
  const done = mine !== null && mine.done && (!mine.backgroundRequired || mine.backgroundDone);
  const locked = required && !bypass && !loading && !done;
  return { loading, required, signedIn: uid !== null, status: mine, locked, bypass, participant, error, refresh };
};
