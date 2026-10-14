/**
 * The signed-in session: the Firebase user, the account document behind it, and
 * the two questions every screen actually asks ("is anyone signed in", "is this
 * an admin"). Held in one context so the profile is fetched once per session
 * rather than per consumer.
 */
import { createContext } from 'react';
import type { AuthUser, UserProfile } from '@/features/auth/domain/userProfile';

export interface AuthSession {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

export const AuthSessionContext = createContext<AuthSession>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isLoggedIn: false,
});
