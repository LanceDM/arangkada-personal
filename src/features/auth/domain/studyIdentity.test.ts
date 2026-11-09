import { describe, expect, it } from 'vitest';
import {
  isStudyIdentity,
  normalizeUsername,
  passwordProblem,
  STUDY_IDENTITY_DOMAIN,
  studyIdentity,
  studySignInMessage,
  studySignUpMessage,
  studyUsernameOf,
  usernameProblem,
} from './studyIdentity';

describe('study usernames', () => {
  it('are 4–20 lower-case letters, digits or _, starting with a letter, read as typed', () => {
    expect(normalizeUsername('  Juan_2026 ')).toBe('juan_2026');
    expect(normalizeUsername('abcd')).toBe('abcd');
    expect(normalizeUsername('a'.repeat(20))).toBe('a'.repeat(20));
    for (const typed of ['abc', 'a'.repeat(21), '2fast', '_juan', 'juan dela', 'juan.d', 'juan@x.ph', 'ñino', '']) {
      expect(normalizeUsername(typed)).toBeNull();
      expect(usernameProblem(typed)?.en).toMatch(/^Username:/);
      expect(usernameProblem(typed)?.fil).toMatch(/^Username:/);
    }
    expect(usernameProblem('juan_2026')).toBeNull();
  });

  it('stand for an identity on the reserved domain, and only those are study accounts', () => {
    expect(studyIdentity('juan_2026')).toBe(`juan_2026@${STUDY_IDENTITY_DOMAIN}`);
    expect(STUDY_IDENTITY_DOMAIN.endsWith('.invalid')).toBe(true);
    expect(isStudyIdentity(studyIdentity('juan_2026'))).toBe(true);
    for (const email of ['juan@example.com', `Juan@${STUDY_IDENTITY_DOMAIN}`, `ab@${STUDY_IDENTITY_DOMAIN}`, 'p01@pilot.arangkada.invalid', null, undefined]) {
      expect(isStudyIdentity(email)).toBe(false);
      expect(studyUsernameOf(email)).toBeNull();
    }
    expect(studyUsernameOf(studyIdentity('juan_2026'))).toBe('juan_2026');
  });
});

describe('study passwords', () => {
  it('are at least 15 characters and at most 128, of any kind', () => {
    expect(passwordProblem('x'.repeat(14))?.en).toMatch(/at least 15/);
    expect(passwordProblem('tatlong maliit na baboy')).toBeNull();
    expect(passwordProblem('x'.repeat(128))).toBeNull();
    expect(passwordProblem('x'.repeat(129))?.en).toMatch(/at most 128/);
  });
});

describe("the screens' messages", () => {
  it('never pass on Firebase text, which names the identity', () => {
    const errors = ['auth/invalid-credential', 'auth/user-disabled', 'auth/too-many-requests', 'auth/network-request-failed', 'auth/other', undefined]
      .map(code => ({ code, message: `Firebase: juan@${STUDY_IDENTITY_DOMAIN}` }));
    for (const error of errors) {
      expect(JSON.stringify(studySignInMessage(error))).not.toContain(STUDY_IDENTITY_DOMAIN);
      expect(JSON.stringify(studySignUpMessage(error))).not.toContain(STUDY_IDENTITY_DOMAIN);
    }
  });

  it('say a username is taken, and a wrong sign-in in both languages', () => {
    expect(studySignUpMessage({ code: 'auth/email-already-in-use' }).en).toMatch(/taken/);
    expect(studySignUpMessage({ code: 'auth/email-already-in-use' }).fil).toMatch(/username/);
    expect(studySignInMessage({ code: 'auth/invalid-credential' })).toEqual({ en: 'Wrong username or password.', fil: 'Mali ang username o password.' });
  });
});
