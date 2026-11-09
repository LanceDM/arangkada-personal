/**
 * The player's language: chosen on the device before any sign-in,
 * and kept on the account once there is one.
 *
 * The account's choice wins when it has one, and is copied to the device, so
 * signing in on a new phone shows the language chosen before. An account with
 * none takes the device's, once per sign-in: that is how the choice a
 * participant makes on the first screen of joining reaches their account.
 * A later choice, in Settings or on a study screen, is saved to both, and
 * the profile read at sign-in never undoes it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANGUAGE, type Language } from '@/shared/lib/localized';
import type { LanguageChoice } from '@/shared/i18n/useText';
import { authDeps } from './dependencies';
import { useAuthSession } from './useAuthSession';

export const useLanguagePreference = (): LanguageChoice => {
  const { user, profile, profileLoaded, loading } = useAuthSession();
  const uid = user?.uid ?? null;
  const [device, setDevice] = useState<Language | null>(() => authDeps().deviceLanguage.load());
  // A choice made while signed in, for that account: it outranks the profile
  // as it was read at sign-in, which does not hear of it.
  const [madeFor, setMadeFor] = useState<{ uid: string; language: Language } | null>(null);
  // The account whose language was settled with the device's.
  const settled = useRef<string | null>(null);

  const account = !loading && uid && profileLoaded ? (madeFor?.uid === uid ? madeFor.language : profile?.language ?? null) : null;
  const language = account ?? device ?? DEFAULT_LANGUAGE;

  useEffect(() => {
    // Only once this account's own document is read: before that, `profile`
    // is the previous account's, and the device's choice would overwrite
    // the account's.
    if (loading || !uid || !profileLoaded || settled.current === uid) return;
    settled.current = uid;
    const { deviceLanguage, userProfiles } = authDeps();
    if (profile?.language) deviceLanguage.save(profile.language);
    else if (device) void userProfiles.saveLanguage(uid, device).catch(() => {});
  }, [loading, uid, profile, profileLoaded, device]);

  const choose = useCallback(
    (next: Language) => {
      const { deviceLanguage, userProfiles } = authDeps();
      deviceLanguage.save(next);
      setDevice(next);
      if (uid) {
        setMadeFor({ uid, language: next });
        void userProfiles.saveLanguage(uid, next).catch(() => {});
      }
    },
    [uid]
  );

  return useMemo(() => ({ language, chosen: account !== null || device !== null, choose }), [language, account, device, choose]);
};
