/**
 * The things a screen can ask Auth to do, over the bound gateway.
 *
 * Screens call these rather than the gateway, so the port stays an
 * implementation detail of the feature and no component imports infrastructure.
 */
import { authDeps } from './dependencies';
import type { Localized } from '@/shared/lib/localized';
import type { AuthUser } from '@/features/auth/domain/userProfile';
import {
  normalizeUsername,
  passwordProblem,
  studyIdentity,
  studySignInMessage,
  studySignUpMessage,
  usernameProblem,
} from '@/features/auth/domain/studyIdentity';

export const signIn = (email: string, password: string): Promise<AuthUser> =>
  authDeps().auth.signIn(email, password);

/** A refused study sign-in or sign-up, whose text the screen shows in the chosen language. */
export class StudyAuthError extends Error {
  readonly text: Localized;
  constructor(text: Localized) {
    super(text.en);
    this.text = text;
  }
}

/**
 * Signs a study participant in by their username. The username is
 * mapped to its identity here, so the screen handles only what was typed.
 */
export const signInStudyAccount = async (typedUsername: string, password: string): Promise<AuthUser> => {
  const username = normalizeUsername(typedUsername);
  if (!username) throw new StudyAuthError(studySignInMessage({ code: 'auth/invalid-credential' }));
  try {
    return await authDeps().auth.signIn(studyIdentity(username), password);
  } catch (error) {
    throw new StudyAuthError(studySignInMessage(error));
  }
};

/**
 * Creates a study account and signs it in. Enrolment, which gives it its
 * participant code, is the study's next write; until then it is an account
 * with no code.
 */
export const createStudyAccount = async (typedUsername: string, password: string): Promise<AuthUser> => {
  const refused = usernameProblem(typedUsername) ?? passwordProblem(password);
  if (refused) throw new StudyAuthError(refused);
  try {
    return await authDeps().auth.createStudyAccount(studyIdentity(normalizeUsername(typedUsername)!), password);
  } catch (error) {
    throw new StudyAuthError(studySignUpMessage(error));
  }
};

/** A study participant's new password, after their current one; every refusal in the screen's words. */
export const changeStudyPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const refused = passwordProblem(newPassword);
  if (refused) throw new StudyAuthError(refused);
  try {
    await authDeps().auth.changePassword(currentPassword, newPassword);
  } catch (error) {
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    throw new StudyAuthError(
      code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials'
        ? { en: 'Your current password is wrong.', fil: 'Mali ang kasalukuyang password.' }
        : studySignInMessage(error)
    );
  }
};

export const signInWithGoogle = (): Promise<AuthUser | null> =>
  authDeps().auth.signInWithGoogle();

export const signUp = (email: string, password: string, username: string): Promise<AuthUser> =>
  authDeps().auth.signUp(email, password, username);

export const signOut = (): Promise<void> => authDeps().auth.signOut();

export const requestPasswordReset = (email: string): Promise<void> =>
  authDeps().auth.requestPasswordReset(email);

export const confirmNewPassword = (oobCode: string, newPassword: string): Promise<void> =>
  authDeps().auth.confirmNewPassword(oobCode, newPassword);

