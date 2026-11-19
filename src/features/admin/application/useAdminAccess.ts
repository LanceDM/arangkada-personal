/** Admin access, followed live: the roster, and granting or revoking from the admin page (2026-11-18). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminRoster, type AdminRosterRow, type PageAdminEntry, type RoleGrantRecord } from '@/features/admin/domain/adminAccess';
import { adminDeps } from './dependencies';

export interface AdminAccess {
  /** False when no repository is bound (tests): the panels say so. */
  wired: boolean;
  roster: AdminRosterRow[] | null;
  error: string | null;
  grant: (target: { uid: string; email: string | null; name: string | null }, reason: string, by: { uid: string; email: string | null }) => Promise<void>;
  revoke: (target: { uid: string; email: string | null }, reason: string, by: { uid: string; email: string | null }) => Promise<void>;
}

export const useAdminAccess = (enabled: boolean): AdminAccess => {
  const repository = adminDeps().adminAccess;
  const [state, setState] = useState<{ entries: PageAdminEntry[]; grants: RoleGrantRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !repository) return;
    return repository.watch(
      next => {
        setState(next);
        setError(null);
      },
      setError
    );
  }, [enabled, repository]);

  const roster = useMemo(() => (state ? adminRoster(state.entries, state.grants) : null), [state]);

  const grant = useCallback<AdminAccess['grant']>(
    async (target, reason, by) => {
      if (!repository) throw new Error('Granting admin access is not available here.');
      await repository.grant(target, reason, by);
    },
    [repository]
  );
  const revoke = useCallback<AdminAccess['revoke']>(
    async (target, reason, by) => {
      if (!repository) throw new Error('Removing admin access is not available here.');
      await repository.revoke(target, reason, by);
    },
    [repository]
  );

  return { wired: !!repository, roster, error, grant, revoke };
};
