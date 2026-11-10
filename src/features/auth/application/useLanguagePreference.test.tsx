// @vitest-environment jsdom
/**
 * Where the chosen language is kept: on the device before any
 * sign-in, on the account once there is one, the account's winning.
 */
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Language } from '@/shared/lib/localized';
import type { LanguageChoice } from '@/shared/i18n/useText';
import type { UserProfile } from '@/features/auth/domain/userProfile';
import { AuthSessionContext, type AuthSession } from './authSession';
import { provideAuthDependencies, type AuthDependencies } from './dependencies';
import { useLanguagePreference } from './useLanguagePreference';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let device: Language | null = null;
const box: { seen: LanguageChoice | null } = { seen: null };
const saveLanguage = vi.fn(async () => {});

beforeEach(() => {
  device = null;
  saveLanguage.mockClear();
  provideAuthDependencies({
    auth: {} as AuthDependencies['auth'],
    userProfiles: { get: async () => null, saveLanguage },
    deviceLanguage: { load: () => device, save: language => void (device = language) },
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const session = (uid: string | null, language?: Language, profileLoaded = true): AuthSession => ({
  user: uid ? { uid, email: null, emailVerified: false, isAdmin: false } : null,
  profile: uid && profileLoaded ? ({ username: 'P-0001', ...(language ? { language } : {}) } as UserProfile) : null,
  profileLoaded,
  loading: false,
  isAdmin: false,
  isLoggedIn: uid !== null,
  studyAccount: uid !== null,
});

const Probe = ({ onValue }: { onValue: (value: LanguageChoice) => void }) => {
  const value = useLanguagePreference();
  useEffect(() => onValue(value));
  return null;
};

const show = (value: AuthSession) => {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() =>
    root!.render(
      <AuthSessionContext.Provider value={value}>
        <Probe onValue={value => void (box.seen = value)} />
      </AuthSessionContext.Provider>
    )
  );
};

describe("the player's language", () => {
  it('is English, not yet chosen, on a new device', () => {
    show(session(null));
    expect(box.seen).toMatchObject({ language: 'en', chosen: false });
  });

  it('keeps a guest’s choice on the device alone', () => {
    show(session(null));
    act(() => box.seen!.choose('fil'));
    expect(box.seen).toMatchObject({ language: 'fil', chosen: true });
    expect(device).toBe('fil');
    expect(saveLanguage).not.toHaveBeenCalled();
  });

  it('gives an account with no language the one chosen on the device, once', () => {
    device = 'fil';
    show(session(null));
    show(session('u1'));
    show(session('u1'));
    expect(saveLanguage).toHaveBeenCalledTimes(1);
    expect(saveLanguage).toHaveBeenCalledWith('u1', 'fil');
    expect(box.seen!.language).toBe('fil');
  });

  it("takes the account's language over the device's, and copies it there", () => {
    device = 'en';
    show(session('u1', 'fil'));
    expect(box.seen).toMatchObject({ language: 'fil', chosen: true });
    expect(device).toBe('fil');
    expect(saveLanguage).not.toHaveBeenCalled();
  });

  it('waits for the account document after a sign-in, so the device never overwrites the account', () => {
    device = 'en';
    show(session(null));
    show(session('u1', undefined, false));
    expect(saveLanguage).not.toHaveBeenCalled();
    expect(box.seen!.language).toBe('en');
    show(session('u1', 'fil'));
    expect(saveLanguage).not.toHaveBeenCalled();
    expect(box.seen!.language).toBe('fil');
    expect(device).toBe('fil');
  });

  it('saves a later choice to the account and the device, and the profile read at sign-in does not undo it', () => {
    show(session('u1', 'fil'));
    act(() => box.seen!.choose('en'));
    show(session('u1', 'fil'));
    expect(box.seen!.language).toBe('en');
    expect(device).toBe('en');
    expect(saveLanguage).toHaveBeenCalledWith('u1', 'en');
  });
});
