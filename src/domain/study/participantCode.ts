/**
 * Who a study record is about: a pseudonymous code the app assigns at
 * enrolment, never a name, a username or an email.
 *
 * - A cohort is the invite's: `study` (the participants the thesis reports),
 *   `dryrun` (the dry run that fits the study's parameters) or `test` (the
 *   developers' own checks). Its code's letter says which.
 * - A code is the cohort's letter, a dash and the enrolment's number padded
 *   to four digits: P-0001, D-0001, T-0001. `firestore.rules` builds the same
 *   string from the cohort's counter, so the two must agree.
 * - An invite is ten characters of Crockford's base 32, which has no I, L, O
 *   or U, so nothing typed can be misread as another character.
 */

export const STUDY_COHORTS = ['study', 'dryrun', 'test'] as const;
export type StudyCohort = (typeof STUDY_COHORTS)[number];

export const COHORT_LETTER: Record<StudyCohort, 'P' | 'D' | 'T'> = { study: 'P', dryrun: 'D', test: 'T' };

/** The largest number four digits hold: the rules pad to four and no further. */
export const MAX_ENROLMENTS_PER_COHORT = 9999;

export const isStudyCohort = (value: unknown): value is StudyCohort => STUDY_COHORTS.includes(value as StudyCohort);

export const participantCode = (cohort: StudyCohort, n: number): string => {
  if (!Number.isInteger(n) || n < 1 || n > MAX_ENROLMENTS_PER_COHORT) {
    throw new RangeError(`An enrolment number is 1–${MAX_ENROLMENTS_PER_COHORT}, not ${n}`);
  }
  return `${COHORT_LETTER[cohort]}-${String(n).padStart(4, '0')}`;
};

const CODE = /^([PDT])-(\d{4})$/;

/** A participant's code in its one written form, of any cohort; never 0000. */
export const isParticipantCode = (code: string | null | undefined): code is string => {
  const match = code ? CODE.exec(code) : null;
  return match !== null && Number(match[2]) >= 1;
};

/**
 * The code of an account that is not a study account (2026-11-10): the
 * reviewer is for everyone, so every account sits the pre-test and the
 * post-test, under `U-` and its account id. Pseudonymous like a participant's
 * code; `firestore.rules` builds the same string from the signed-in uid.
 */
export const openAccessCode = (uid: string): string => `U-${uid}`;

const OPEN_CODE = /^U-[A-Za-z0-9]{1,30}$/;

export const isOpenAccessCode = (code: string | null | undefined): code is string => !!code && OPEN_CODE.test(code);

export const cohortOfCode = (code: string): StudyCohort | null => {
  if (!isParticipantCode(code)) return null;
  return STUDY_COHORTS.find(cohort => COHORT_LETTER[cohort] === code[0]) ?? null;
};

/** Codes in enrolment order, cohort by cohort. */
export const compareParticipantCodes = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true });

// ── Invites ──────────────────────────────────────────────────────────────

export const INVITE_CODE_LENGTH = 10;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * The invite as typed, in its one written form, or null when it cannot be
 * one: any case, spaces and dashes dropped, and the letters Crockford reads
 * as digits (I and L as 1, O as 0) read the same way.
 */
export const normalizeInviteCode = (typed: string): string | null => {
  const code = typed
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  if (code.length !== INVITE_CODE_LENGTH) return null;
  return [...code].every(char => CROCKFORD.includes(char)) ? code : null;
};

/** A fresh invite from `randomByte`, which must be uniform over 0–255 (the caller's crypto). */
export const newInviteCode = (randomByte: () => number): string =>
  Array.from({ length: INVITE_CODE_LENGTH }, () => CROCKFORD[randomByte() & 31]).join('');

/** An invite shown in two halves, as it is easiest to read out. */
export const formatInviteCode = (code: string): string => `${code.slice(0, 5)}-${code.slice(5)}`;
