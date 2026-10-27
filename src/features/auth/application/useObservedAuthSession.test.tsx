// @vitest-environment jsdom
/**
 * The sign-in state settles even when the account's profile cannot be read.
 *
 * Everything that waits for sign-in to finish reads `loading`, Story Mode's
 * course among it. A profile read that failed - offline, or the local
 * emulators not up yet - used to leave it true for good, and Story Mode said
 * "Loading your course..." until the page was reloaded.
 */
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, UserProfile } from '@/features/auth/domain/userProfile';
import type { AuthSession } from './authSession';
import { provideAuthDependencies } from './dependencies';
import type { AuthGateway } from './ports';
import { useObservedAuthSession } from './useObservedAuthSession';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SIGNED_IN: AuthUser = { uid: 'player-1', email: 'player@example.com', emailVerified: true, isAdmin: false };

/** A gateway that reports `user` once, the way a session restored on load does. */
const gatewayReporting = (user: AuthUser | null): AuthGateway =>
  ({
    completeRedirectSignIn: async () => null,
    observeUser: onChange => {
      void Promise.resolve().then(() => onChange(user));
      return () => {};
    },
  }) as AuthGateway;

const observe = async (gateway: AuthGateway, get: (uid: string) => Promise<UserProfile | null>) => {
  provideAuthDependencies({ auth: gateway, userProfiles: { get } });
  const seen: { session: AuthSession | null } = { session: null };
  const Probe = () => {
    const session = useObservedAuthSession();
    useEffect(() => {
      seen.session = session;
    });
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(<Probe />);
  });
  // Let the profile read settle, whichever way it goes.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  roots.push(root);
  return seen.session!;
};

const roots: Array<ReturnType<typeof createRoot>> = [];
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  vi.restoreAllMocks();
});

describe('the observed sign-in state', () => {
  it('settles with the profile it read', async () => {
    const profile = { username: 'Player' } as UserProfile;
    const session = await observe(gatewayReporting(SIGNED_IN), async () => profile);
    expect(session).toMatchObject({ loading: false, isLoggedIn: true, profile });
  });

  it('settles signed in, with no profile, when the profile cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = await observe(gatewayReporting(SIGNED_IN), () =>
      Promise.reject(new Error('Failed to get document because the client is offline.'))
    );
    expect(session).toMatchObject({ loading: false, isLoggedIn: true, profile: null });
    expect(error).toHaveBeenCalled();
  });

  it('settles signed out without reading a profile', async () => {
    const get = vi.fn(async () => null);
    const session = await observe(gatewayReporting(null), get);
    expect(session).toMatchObject({ loading: false, isLoggedIn: false, profile: null });
    expect(get).not.toHaveBeenCalled();
  });
});
