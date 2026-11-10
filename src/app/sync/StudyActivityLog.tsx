/**
 * The app-wide part of the study log, for a signed-in participant:
 *
 * - `session_started` once per sign-in per app load (device, language, screen);
 * - `ui_action` `signed_in` / `signed_up` when someone signs in during this load
 *   (a session restored on load is the session_started itself);
 * - `page_viewed` for every screen, not only Story Mode;
 * - `app_error` for any error the app did not catch.
 *
 * Signing out is logged where it happens (Header, Settings, Admin), because
 * once signed out nothing more can be written for the participant.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthSession } from '@/features/auth';
import { logStudyEvent, logUiAction } from '@/features/driving-sim';

/** An account made within this long before its first sign-in counts as signing up. */
const SIGN_UP_WINDOW_MS = 2 * 60 * 1000;

export const StudyActivityLog = () => {
  const { user, profile, loading, isLoggedIn } = useAuthSession();
  const uid = isLoggedIn && user ? user.uid : null;
  const { pathname, search } = useLocation();

  // undefined until the first session is known: a restored session is not a sign-in.
  const seen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (loading) return;
    const before = seen.current;
    seen.current = uid;
    if (!uid || uid === before) return;
    void logStudyEvent(uid, {
      type: 'session_started',
      payload: {
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        language: typeof navigator === 'undefined' ? null : navigator.language,
        screen: typeof window === 'undefined' ? null : { width: window.screen?.width ?? null, height: window.screen?.height ?? null, dpr: window.devicePixelRatio ?? null },
        viewport: typeof window === 'undefined' ? null : { width: window.innerWidth, height: window.innerHeight },
        restored: before === undefined,
      },
    });
    if (before !== undefined) {
      const newAccount = profile?.createdAt !== undefined && Date.now() - profile.createdAt < SIGN_UP_WINDOW_MS;
      void logUiAction(uid, newAccount ? 'signed_up' : 'signed_in');
    }
  }, [uid, loading, profile?.createdAt]);

  useEffect(() => {
    if (uid) void logStudyEvent(uid, { type: 'page_viewed', payload: { path: pathname, search: search || null } });
  }, [uid, pathname, search]);

  useEffect(() => {
    if (!uid) return;
    const report = (kind: string, message: string, stack: string | null) =>
      void logStudyEvent(uid, {
        type: 'app_error',
        payload: { kind, message: message.slice(0, 500), stack: stack ? stack.slice(0, 2_000) : null, path: window.location.pathname },
      });
    const onError = (event: ErrorEvent) => report('error', event.message ?? String(event.error), event.error instanceof Error ? event.error.stack ?? null : null);
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report('unhandled_rejection', reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack ?? null : null);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [uid]);

  return null;
};
