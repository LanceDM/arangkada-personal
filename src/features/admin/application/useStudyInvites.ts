/** The admin's Invites panel: every invite, followed live, and creating and closing one. */
import { useCallback, useEffect, useState } from 'react';
import type { StudyCohort } from '@/domain/study/participantCode';
import type { InviteEntry } from './pilotPorts';
import { adminDeps } from './dependencies';

export interface StudyInvites {
  invites: InviteEntry[];
  loading: boolean;
  error: string | null;
  create: (cohort: StudyCohort) => Promise<string>;
  close: (code: string) => Promise<void>;
}

export const useStudyInvites = (enabled: boolean): StudyInvites => {
  const [invites, setInvites] = useState<InviteEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return adminDeps().invites.watch(
      next => {
        setInvites([...next].sort((a, b) => b.createdAt - a.createdAt));
        setError(null);
      },
      message => setError(message)
    );
  }, [enabled]);

  const create = useCallback((cohort: StudyCohort) => adminDeps().invites.create(cohort), []);
  const close = useCallback((code: string) => adminDeps().invites.close(code), []);

  return { invites: invites ?? [], loading: enabled && invites === null && error === null, error, create, close };
};
