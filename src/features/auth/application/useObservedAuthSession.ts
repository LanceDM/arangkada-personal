import { useEffect, useState } from 'react';
import type { AuthUser, UserProfile } from '@/features/auth/domain/userProfile';
import { authDeps } from './dependencies';
import type { AuthSession } from './authSession';

/** Follows the bound gateway's sign-in state and pairs it with the account document. */
export const useObservedAuthSession = (): AuthSession => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { auth, userProfiles } = authDeps();
    // Guards the profile fetch, which resolves after this effect may have been
    // torn down — Strict Mode replays it, and a stale resolution would
    // otherwise overwrite the live subscription's state.
    let subscribed = true;

    // A Google sign-in whose popup was blocked finished by navigating away;
    // this is the load it comes back on, and the result has to be claimed
    // before it is discarded. Resolves to null on every ordinary load.
    void auth.completeRedirectSignIn().catch(() => {});

    const unsubscribe = auth.observeUser(async nextUser => {
      if (!subscribed) return;
      setUser(nextUser);
      // A profile that cannot be read - offline, or the emulators not up yet -
      // still settles the session. Everything that waits on `loading` would
      // otherwise wait for good; each Firestore read after it reports its own
      // failure.
      const nextProfile = nextUser
        ? await userProfiles.get(nextUser.uid).catch(error => {
            console.error('Failed to load the account profile:', error);
            return null;
          })
        : null;
      if (!subscribed) return;
      setProfile(nextProfile);
      setLoading(false);
    });

    return () => {
      subscribed = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    profile,
    loading,
    isAdmin: user?.isAdmin ?? false,
    isLoggedIn: Boolean(user),
  };
};
