/**
 * Whether the site is open to players, kept live. A read that fails (no
 * network, rules not deployed yet) reads as open: suspending is an admin's
 * deliberate act, never something a hiccup should do to a participant.
 */
import { useEffect, useState } from 'react';
import { SITE_OPEN, type SiteStatus } from '@/features/admin/domain/siteStatus';
import { adminDeps } from './dependencies';

export const useSiteStatus = () => {
  // Unwired (tests), the site is open from the start.
  const [status, setStatus] = useState<SiteStatus | null>(() => (adminDeps().site ? null : SITE_OPEN));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const site = adminDeps().site;
    if (!site) return;
    return site.watch(
      next => {
        setStatus(next);
        setError(null);
      },
      failure => {
        setError(failure.message);
        setStatus(current => current ?? SITE_OPEN);
      }
    );
  }, []);
  return { status, loading: status === null, error };
};

/** Suspends or reopens the site, as the signed-in admin. */
export const setSiteStatus = async (uid: string, suspended: boolean, message: string): Promise<void> => {
  const site = adminDeps().site;
  if (!site) throw new Error('Site status is not wired.');
  await site.set({ suspended, message }, uid);
};
