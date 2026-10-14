/**
 * What Auth needs from the outside world, stated as interfaces.
 *
 * The application and presentation layers depend only on these. The Firebase
 * implementations live in `../infrastructure` and are bound by `composition.ts`,
 * which `app/dependencies` is the only caller of — so no screen and no hook
 * names the SDK, and `AuthUser` rather than Firebase's `User` is what crosses
 * the boundary.
 */
import type { AuthUser, UserProfile } from '@/features/auth/domain/userProfile';

export interface AuthGateway {
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Resolves to null when a blocked popup fell back to a full-page redirect. */
  signInWithGoogle(): Promise<AuthUser | null>;
  signUp(email: string, password: string, username: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  confirmNewPassword(oobCode: string, newPassword: string): Promise<void>;
  verifyEmailCode(oobCode: string): Promise<void>;
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
}
