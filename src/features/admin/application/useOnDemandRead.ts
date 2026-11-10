/**
 * One attempt's records read when it is opened, and held only while it is.
 *
 * Opening another attempt replaces what was read and leaving the section drops
 * it: nothing goes into a store or a query cache. The read is kept as a promise
 * against the attempt it is for, so a Strict Mode replay of the effect joins
 * it rather than reading the documents twice.
 */
import { useEffect, useRef, useState } from 'react';
import type { FsmReplay } from '@/features/admin/domain/replayTimeline';

/** The opened attempt's FSM log, as the section shows it. */
export type FsmLogState =
  | { status: 'loading' }
  | { status: 'ready'; replay: FsmReplay }
  /** No FSM record beside the attempt: the records read found none. */
  | { status: 'missing' }
  | { status: 'error'; error: string };

export type OnDemandRead<T> = { status: 'loading' } | { status: 'done'; value: T } | { status: 'error'; error: string };

/**
 * `read` must be stable (a module-level function): the read is keyed by the
 * account and the attempt alone. Null where no attempt is to be read.
 */
export const useOnDemandRead = <T>(
  uid: string | null,
  attemptId: string | null,
  read: (uid: string, attemptId: string) => Promise<T>
): OnDemandRead<T> | null => {
  const key = uid && attemptId ? `${uid}/${attemptId}` : null;
  const reading = useRef<{ key: string; promise: Promise<OnDemandRead<T>> } | null>(null);
  const [result, setResult] = useState<{ key: string; state: OnDemandRead<T> } | null>(null);

  useEffect(() => {
    if (!key || !uid || !attemptId) {
      reading.current = null;
      return;
    }
    if (reading.current?.key !== key) {
      const promise = read(uid, attemptId).then(
        (value): OnDemandRead<T> => ({ status: 'done', value }),
        (cause: unknown): OnDemandRead<T> => ({ status: 'error', error: cause instanceof Error ? cause.message : String(cause) })
      );
      reading.current = { key, promise };
    }
    let current = true;
    void reading.current.promise.then(state => {
      if (current) setResult({ key, state });
    });
    return () => {
      current = false;
    };
  }, [key, uid, attemptId, read]);

  if (!key) return null;
  return result?.key === key ? result.state : { status: 'loading' };
};
