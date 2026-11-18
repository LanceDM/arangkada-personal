/**
 * The things a screen can ask Auth to do, over the bound gateway.
 *
 * Screens call these rather than the gateway, so the port stays an
 * implementation detail of the feature and no component imports infrastructure.
 */
import { authDeps } from './dependencies';
import type { Localized } from '@/shared/lib/localized';
import type { AuthUser } from '@/features/auth/domain/userProfile';
import { TERMS_VERSION } from '@/features/auth/domain/terms';
import {
  normalizeUsername,
  passwordProblem,
  studyIdentity,
  studySignInMessage,
  studySignUpMessage,
  usernameProblem,
} from '@/features/auth/domain/studyIdentity';
import {
  accountIdentity,
  accountPasswordProblem,
  accountSignInMessage,
  accountSignUpMessage,
  emailProblem,
  isWrongCredentials,
  signInCandidates,
} from '@/features/auth/domain/accountIdentity';

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

/** A refused sign-in or sign-up on the main form, whose text the form shows in the chosen language. */
export class AccountAuthError extends Error {
  readonly text: Localized;
  constructor(text: Localized) {
    super(text.en);
    this.text = text;
  }
}

/**
 * Signs in with a username or an email and a password (2026-11-18). A username
 * is tried as a regular account, then as a study account; only "wrong
 * identity or password" moves on to the next, any other failure is reported.
 */
export const signInWithLogin = async (typed: string, password: string): Promise<AuthUser> => {
  const candidates = signInCandidates(typed);
  if (candidates.length === 0 || !password) throw new AccountAuthError(accountSignInMessage({ code: 'auth/invalid-credential' }));
  let last: unknown = null;
  for (const identity of candidates) {
    try {
      return await authDeps().auth.signIn(identity, password);
    } catch (error) {
      last = error;
      if (!isWrongCredentials(error)) break;
    }
  }
  throw new AccountAuthError(accountSignInMessage(last));
};

export interface NewAccount {
  username: string;
  /** Optional: with one, the account signs in with it and can reset its password. */
  email: string;
  password: string;
}

/** Makes a regular account from the sign-up form, every refusal in the form's words. */
export const createAccount = async ({ username: typedUsername, email: typedEmail, password }: NewAccount): Promise<AuthUser> => {
  const email = typedEmail.trim().toLowerCase();
  const refused = usernameProblem(typedUsername) ?? emailProblem(email) ?? accountPasswordProblem(password);
  if (refused) throw new AccountAuthError(refused);
  const username = normalizeUsername(typedUsername)!;
  try {
    return email
      ? await authDeps().auth.signUp(email, password, username)
      : await authDeps().auth.createUsernameAccount(accountIdentity(username), password, username);
  } catch (error) {
    throw new AccountAuthError(accountSignUpMessage(error, email !== ''));
  }
};

/**
 * Whether the account still has to agree to the Terms and Data Use: a Google
 * sign-in that has just made the account. An unreadable profile counts as
 * agreed, so a failed read never blocks a returning player.
 */
export const needsTermsAcceptance = async (uid: string): Promise<boolean> => {
  try {
    const profile = await authDeps().userProfiles.get(uid);
    return !profile?.termsVersion;
  } catch {
    return false;
  }
};

export const signInWithGoogle = (): Promise<AuthUser | null> =>
  authDeps().auth.signInWithGoogle();

export const signUp = (email: string, password: string, username: string): Promise<AuthUser> =>
  authDeps().auth.signUp(email, password, username);

/**
 * Records that the account agreed to the Terms and Data Use. The form does not
 * let an account be made without the tick; this is the record of it. Best
 * effort, so a failed write never blocks the sign-in that just succeeded.
 */
export const recordTermsAcceptance = async (uid: string): Promise<void> => {
  try {
    await authDeps().userProfiles.saveTermsAcceptance(uid, TERMS_VERSION, Date.now());
  } catch {
    // The account exists and the tick was required; the record can be written at a later sign-in.
  }
};

export const signOut = (): Promise<void> => authDeps().auth.signOut();

export const requestPasswordReset = (email: string): Promise<void> =>
  authDeps().auth.requestPasswordReset(email);

export const confirmNewPassword = (oobCode: string, newPassword: string): Promise<void> =>
  authDeps().auth.confirmNewPassword(oobCode, newPassword);

