/**
 * Regular accounts (the team, admins, anyone outside the study) signing in with
 * a username or an email, and a password (2026-11-18).
 *
 * Firebase's password sign-in needs an address. An account made with a
 * username alone stands for a synthetic one on a reserved domain, as a study
 * account does on its own: `.invalid` can never be registered, so no mail is
 * ever sent there and no screen shows it. An account made with an email signs
 * in with that email.
 *
 * Signing in, a typed value with an `@` is an email; anything else is a
 * username, tried as a regular account and then as a study account, so a
 * participant who uses the main sign-in still gets in.
 */
import type { Localized } from '@/shared/lib/localized';
import { normalizeUsername, studyIdentity, STUDY_IDENTITY_DOMAIN } from './studyIdentity';

export const ACCOUNT_IDENTITY_DOMAIN = 'user.arangkada.invalid';

/** At least 8: Firebase accepts 6, which is too few for an account that holds study data. */
export const ACCOUNT_PASSWORD_MIN = 8;
export const ACCOUNT_PASSWORD_MAX = 128;

export const accountIdentity = (username: string): string => `${username}@${ACCOUNT_IDENTITY_DOMAIN}`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether a typed value is meant as an email rather than a username. */
export const looksLikeEmail = (typed: string): boolean => typed.includes('@');

/** The identities a typed username or email may sign in as, in the order to try them. */
export const signInCandidates = (typed: string): string[] => {
  const value = typed.trim();
  if (!value) return [];
  if (looksLikeEmail(value)) return [value.toLowerCase()];
  const username = normalizeUsername(value);
  return username ? [accountIdentity(username), studyIdentity(username)] : [];
};

/** The username behind a synthetic identity, or null for a real email. */
export const usernameOfIdentity = (email: string | null | undefined): string | null => {
  if (!email) return null;
  for (const domain of [ACCOUNT_IDENTITY_DOMAIN, STUDY_IDENTITY_DOMAIN]) {
    const suffix = `@${domain}`;
    if (email.endsWith(suffix)) return email.slice(0, -suffix.length);
  }
  return null;
};

/** Why a typed optional email is refused, or null (an empty one is fine). */
export const emailProblem = (typed: string): Localized | null => {
  const value = typed.trim();
  if (!value || EMAIL.test(value)) return null;
  return { en: 'That email does not look right.', fil: 'Mukhang mali ang email na iyan.' };
};

/** Why a new password is refused, or null. */
export const accountPasswordProblem = (password: string): Localized | null => {
  if (password.length < ACCOUNT_PASSWORD_MIN) {
    return { en: `Use at least ${ACCOUNT_PASSWORD_MIN} characters.`, fil: `Gumamit ng hindi bababa sa ${ACCOUNT_PASSWORD_MIN} na character.` };
  }
  if (password.length > ACCOUNT_PASSWORD_MAX) {
    return { en: `Use at most ${ACCOUNT_PASSWORD_MAX} characters.`, fil: `Hanggang ${ACCOUNT_PASSWORD_MAX} na character lamang.` };
  }
  return null;
};

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;

/** Whether a failed sign-in means only "not this identity, or not this password". */
export const isWrongCredentials = (error: unknown): boolean =>
  ['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(
    String(codeOf(error))
  );

const OFFLINE: Localized = { en: 'No internet connection. Try again.', fil: 'Walang koneksyon sa internet. Subukan ulit.' };
const TOO_MANY: Localized = { en: 'Too many tries. Wait a few minutes.', fil: 'Masyadong maraming subok. Maghintay ng ilang minuto.' };

/** What the sign-in form says when a sign-in fails. Firebase's own text is never shown. */
export const accountSignInMessage = (error: unknown): Localized => {
  if (isWrongCredentials(error)) return { en: 'Wrong username, email or password.', fil: 'Mali ang username, email o password.' };
  switch (codeOf(error)) {
    case 'auth/user-disabled':
      return { en: 'This account can no longer sign in. Ask the team for help.', fil: 'Hindi na magagamit ang account na ito. Humingi ng tulong sa team.' };
    case 'auth/too-many-requests':
      return TOO_MANY;
    case 'auth/network-request-failed':
      return OFFLINE;
    default:
      return { en: 'Could not sign in. Try again.', fil: 'Hindi makapasok. Subukan ulit.' };
  }
};

/** What the sign-up form says when the account cannot be made. */
export const accountSignUpMessage = (error: unknown, withEmail: boolean): Localized => {
  switch (codeOf(error)) {
    case 'auth/email-already-in-use':
      return withEmail
        ? { en: 'That email already has an account. Log in instead.', fil: 'May account na ang email na iyan. Mag-login na lang.' }
        : { en: 'That username is taken. Choose another.', fil: 'May gumagamit na ng username na iyan. Pumili ng iba.' };
    case 'auth/invalid-email':
      return { en: 'That email does not look right.', fil: 'Mukhang mali ang email na iyan.' };
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return accountPasswordProblem('')!;
    case 'auth/operation-not-allowed':
      return { en: 'Password accounts are switched off. Ask the team.', fil: 'Naka-off ang password na account. Itanong sa team.' };
    case 'auth/too-many-requests':
      return TOO_MANY;
    case 'auth/network-request-failed':
      return OFFLINE;
    default:
      return { en: 'Could not create the account. Try again.', fil: 'Hindi magawa ang account. Subukan ulit.' };
  }
};
