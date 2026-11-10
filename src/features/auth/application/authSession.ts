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
  /**
   * The account document for the user signed in now has been read (and may
   * be null: a study account before enrolment writes it). False between a
   * sign-in and that read, while `profile` is still the previous one's.
   */
  profileLoaded: boolean;
  loading: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  /**
   * The account is a study participant's, signed in by username.
   * Known from the identity alone, before anything is read: its participant
   * code is the study's to read. A study account never takes a guest's
   * progress and never gets admin test mode.
   */
  studyAccount: boolean;
}

export const AuthSessionContext = createContext<AuthSession>({
  user: null,
  profile: null,
  profileLoaded: false,
  loading: true,
  isAdmin: false,
  isLoggedIn: false,
  studyAccount: false,
});
