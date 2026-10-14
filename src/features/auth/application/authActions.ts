/**
 * The things a screen can ask Auth to do, over the bound gateway.
 *
 * Screens call these rather than the gateway, so the port stays an
 * implementation detail of the feature and no component imports infrastructure.
 */
import { authDeps } from './dependencies';
import type { AuthUser } from '@/features/auth/domain/userProfile';

export const signIn = (email: string, password: string): Promise<AuthUser> =>
  authDeps().auth.signIn(email, password);

export const signInWithGoogle = (): Promise<AuthUser | null> =>
  authDeps().auth.signInWithGoogle();

export const signUp = (email: string, password: string, username: string): Promise<AuthUser> =>
  authDeps().auth.signUp(email, password, username);

export const signOut = (): Promise<void> => authDeps().auth.signOut();

export const requestPasswordReset = (email: string): Promise<void> =>
  authDeps().auth.requestPasswordReset(email);

export const confirmNewPassword = (oobCode: string, newPassword: string): Promise<void> =>
  authDeps().auth.confirmNewPassword(oobCode, newPassword);

export const verifyEmailCode = (oobCode: string): Promise<void> =>
  authDeps().auth.verifyEmailCode(oobCode);
