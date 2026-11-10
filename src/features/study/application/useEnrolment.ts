import { useCallback, useEffect, useState } from 'react';
import type { EnrolmentDoc } from '@/domain/study/studyRecords';
import { studyDeps } from './dependencies';

export type EnrolmentState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'enrolled'; enrolment: EnrolmentDoc }
  | { status: 'not-enrolled' }
  | { status: 'error' };

/**
 * The signed-in account's enrolment: its participant code, read once per
 * account. `none` when nobody is signed in. `enrolled` is what a page hands
 * on, so a code is never shown or written before it has been read.
 */
export const useEnrolment = (uid: string | null): EnrolmentState & { reload: () => void; enrolled: (enrolment: EnrolmentDoc) => void } => {
  const [read, setRead] = useState<{ uid: string; state: EnrolmentState } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    studyDeps()
      .registry.enrolmentOf(uid)
      .then(enrolment => {
        if (!cancelled) setRead({ uid, state: enrolment ? { status: 'enrolled', enrolment } : { status: 'not-enrolled' } });
      })
      .catch(failure => {
        console.error('Failed to read the enrolment:', failure);
        if (!cancelled) setRead({ uid, state: { status: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  const reload = useCallback(() => {
    setRead(null);
    setAttempt(n => n + 1);
  }, []);
  const enrolled = useCallback((enrolment: EnrolmentDoc) => uid && setRead({ uid, state: { status: 'enrolled', enrolment } }), [uid]);

  const state: EnrolmentState = !uid ? { status: 'none' } : read?.uid === uid ? read.state : { status: 'loading' };
  return { ...state, reload, enrolled };
};
