/**
 * What Auth needs from the outside world, stated as interfaces.
 *
 * The application and presentation layers depend only on these. The Firebase
 * implementations live in `../infrastructure` and are bound by `composition.ts`,
 * which `app/dependencies` is the only caller of — so no screen and no hook
 * names the SDK, and `AuthUser` rather than Firebase's `User` is what crosses
 * the boundary.
 */
import type { Language } from '@/shared/lib/localized';
import type { AuthUser, UserProfile } from '@/features/auth/domain/userProfile';

export interface AuthGateway {
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Resolves to null when a blocked popup fell back to a full-page redirect. */
  signInWithGoogle(): Promise<AuthUser | null>;
  signUp(email: string, password: string, username: string): Promise<AuthUser>;
  /**
   * Creates a study account on its synthetic identity and its
   * profile, with no email and nothing sent to the address.
   */
  createStudyAccount(identity: string, password: string): Promise<AuthUser>;
  /** Changes the signed-in account's password, after confirming its current one. */
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  confirmNewPassword(oobCode: string, newPassword: string): Promise<void>;
  /**
   * Finishes a sign-in that left the page for a full-screen redirect, on the
   * load that follows it. Resolves to null when no redirect was pending.
   */
  completeRedirectSignIn(): Promise<AuthUser | null>;
  /** Calls back on every sign-in and sign-out. Returns an unsubscribe. */
  observeUser(onChange: (user: AuthUser | null) => void): () => void;
}

/** The `users/{uid}` account document. Auth creates it; every feature reads it. */
export interface UserProfileRepository {
  get(uid: string): Promise<UserProfile | null>;
  /** Merges the account's chosen language into its profile. */
  saveLanguage(uid: string, language: Language): Promise<void>;
}

/** The language chosen on this device, before any sign-in and for a guest. */
export interface DeviceLanguageRepository {
  load(): Language | null;
  save(language: Language): void;
}
