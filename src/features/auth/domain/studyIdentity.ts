/**
 * The study's participants, who sign in with a username and a password
 * rather than an email.
 *
 * Firebase's password sign-in needs an address, so a username stands for a
 * synthetic one on a reserved domain: `.invalid` can never be registered, so
 * no person owns it and no mail is ever delivered there. The address exists
 * only between this module and Firebase: no screen shows it and no field asks
 * for it. `firestore.rules` recognises a study account by the same domain.
 *
 * Every message is in English and Filipino, and the screen shows the one
 * the participant chose; the Filipino is the team's to check.
 */
import type { Localized } from '@/shared/lib/localized';

export const STUDY_IDENTITY_DOMAIN = 'study.arangkada.invalid';

export const USERNAME_MIN = 4;
export const USERNAME_MAX = 20;

/**
 * 15 at least: NIST SP 800-63B-4 (2025) for a password used alone. Up to
 * 128, past the 64 it asks verifiers to accept. No rule on which characters.
 */
export const STUDY_PASSWORD_MIN = 15;
export const STUDY_PASSWORD_MAX = 128;

const USERNAME = new RegExp(`^[a-z][a-z0-9_]{${USERNAME_MIN - 1},${USERNAME_MAX - 1}}$`);

/** The username as typed, trimmed and lower-cased, or null when it is not one. */
export const normalizeUsername = (typed: string): string | null => {
  const username = typed.trim().toLowerCase();
  return USERNAME.test(username) ? username : null;
};

export const studyIdentity = (username: string): string => `${username}@${STUDY_IDENTITY_DOMAIN}`;

/** Whether a signed-in identity is a study account's. */
export const isStudyIdentity = (email: string | null | undefined): boolean => {
  const suffix = `@${STUDY_IDENTITY_DOMAIN}`;
  if (!email || !email.endsWith(suffix)) return false;
  return normalizeUsername(email.slice(0, -suffix.length)) === email.slice(0, -suffix.length);
};

/** The username a study identity stands for, or null for any other address. */
export const studyUsernameOf = (email: string | null | undefined): string | null =>
  email && isStudyIdentity(email) ? email.slice(0, -`@${STUDY_IDENTITY_DOMAIN}`.length) : null;

export const USERNAME_RULE: Localized = { en: `${USERNAME_MIN}–${USERNAME_MAX} letters, digits or _, starting with a letter`, fil: `${USERNAME_MIN}–${USERNAME_MAX} na titik, numero o _, nagsisimula sa titik` };

/** Why the screen refuses a username before trying it, or null. */
export const usernameProblem = (typed: string): Localized | null =>
  normalizeUsername(typed) ? null : { en: `Username: ${USERNAME_RULE.en}.`, fil: `Username: ${USERNAME_RULE.fil}.` };

/** Why the screen refuses a new password before trying it, or null. */
export const passwordProblem = (password: string): Localized | null => {
  if (password.length < STUDY_PASSWORD_MIN) {
    return { en: `Use at least ${STUDY_PASSWORD_MIN} characters. A few words make a strong one.`, fil: `Gumamit ng hindi bababa sa ${STUDY_PASSWORD_MIN} na character. Ilang salita ang matibay na password.` };
  }
  if (password.length > STUDY_PASSWORD_MAX) {
    return { en: `Use at most ${STUDY_PASSWORD_MAX} characters.`, fil: `Hanggang ${STUDY_PASSWORD_MAX} na character lamang.` };
  }
  return null;
};

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;

const OFFLINE: Localized = { en: 'No internet connection. Try again.', fil: 'Walang koneksyon sa internet. Subukan ulit.' };

/**
 * What the sign-in screen says when a sign-in fails. Firebase's own text is
 * never shown: it names the identity behind the username.
 */
export const studySignInMessage = (error: unknown): Localized => {
  switch (codeOf(error)) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return { en: 'Wrong username or password.', fil: 'Mali ang username o password.' };
    case 'auth/user-disabled':
      return { en: 'This account can no longer sign in. Ask the team for help.', fil: 'Hindi na magagamit ang account na ito. Humingi ng tulong sa team.' };
    case 'auth/too-many-requests':
      return { en: 'Too many tries. Wait a few minutes.', fil: 'Masyadong maraming subok. Maghintay ng ilang minuto.' };
    case 'auth/network-request-failed':
      return OFFLINE;
    default:
      return { en: 'Could not sign in. Try again.', fil: 'Hindi makapasok. Subukan ulit.' };
  }
};

/** What the sign-up screen says when the account cannot be created. */
export const studySignUpMessage = (error: unknown): Localized => {
  switch (codeOf(error)) {
    case 'auth/email-already-in-use':
      return { en: 'That username is taken. Choose another.', fil: 'May gumagamit na ng username na iyan. Pumili ng iba.' };
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return passwordProblem('') ?? { en: 'Choose a longer password.', fil: 'Pumili ng mas mahabang password.' };
    case 'auth/too-many-requests':
      return { en: 'Too many tries. Wait a few minutes.', fil: 'Masyadong maraming subok. Maghintay ng ilang minuto.' };
    case 'auth/network-request-failed':
      return OFFLINE;
    default:
      return { en: 'Could not create the account. Try again.', fil: 'Hindi magawa ang account. Subukan ulit.' };
  }
};
