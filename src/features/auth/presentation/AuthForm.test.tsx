// @vitest-environment jsdom
/**
 * The main sign-in panel (2026-11-18): log in by username or email with no
 * agreement to tick; sign up by username (email optional) only after agreeing;
 * Google asks for the agreement only when it has just made the account.
 */
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TERMS_REQUIRED, TERMS_VERSION } from '@/features/auth/domain/terms';
import { provideAuthDependencies, type AuthDependencies } from '@/features/auth/application/dependencies';
import AuthForm from './AuthForm';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const user = { uid: 'u1', email: 'juan@example.com', emailVerified: true, isAdmin: false };
const wrong = Object.assign(new Error('wrong'), { code: 'auth/invalid-credential' });
const signIn = vi.fn<(identity: string, password: string) => Promise<typeof user>>(async () => user);
const signUp = vi.fn(async () => user);
const createUsernameAccount = vi.fn(async () => user);
const signInWithGoogle = vi.fn(async () => user);
const signOut = vi.fn(async () => {});
const requestPasswordReset = vi.fn(async () => {});
const saveTermsAcceptance = vi.fn(async () => {});
const getProfile = vi.fn(async () => ({ termsVersion: TERMS_VERSION }) as unknown);

let root: Root;
let host: HTMLDivElement;
const onSuccess = vi.fn();

const mount = async (view: 'login' | 'register') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<StrictMode><AuthForm defaultView={view} onSuccess={onSuccess} /></StrictMode>));
};
const type = (id: string, value: string) =>
  act(() => {
    const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const press = (label: string) =>
  act(async () => {
    [...host.querySelectorAll('button')].find(b => b.textContent?.includes(label))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
const tick = () => act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());

beforeEach(() => {
  vi.clearAllMocks();
  provideAuthDependencies({
    auth: { signIn, signUp, createUsernameAccount, signInWithGoogle, signOut, requestPasswordReset },
    userProfiles: { saveTermsAcceptance, get: getProfile },
  } as unknown as AuthDependencies);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('logging in', () => {
  it('asks for no agreement, and signs in by email', async () => {
    await mount('login');
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    await type('auth-login', 'Juan@Example.com');
    await type('auth-password', 'secret123');
    await press('LOG IN');
    expect(signIn).toHaveBeenCalledWith('juan@example.com', 'secret123');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('signs in by username, as a regular account and then as a study account', async () => {
    signIn.mockRejectedValueOnce(wrong);
    await mount('login');
    await type('auth-login', 'JuanDriver');
    await type('auth-password', 'secret123');
    await press('LOG IN');
    expect(signIn.mock.calls.map(call => call[0])).toEqual(['juandriver@user.arangkada.invalid', 'juandriver@study.arangkada.invalid']);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('says only that the details are wrong, never which identity it tried', async () => {
    signIn.mockRejectedValue(wrong);
    await mount('login');
    await type('auth-login', 'juandriver');
    await type('auth-password', 'nope-nope');
    await press('LOG IN');
    expect(host.textContent).toContain('Wrong username, email or password.');
    expect(host.textContent).not.toContain('invalid');
    expect(onSuccess).not.toHaveBeenCalled();
    signIn.mockReset();
  });

  it('sends a reset link only for an email, and says the same whether it has an account', async () => {
    await mount('login');
    await press('Forgot your password?');
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(host.textContent).toContain('ask an admin');
    await type('auth-login', 'juan@example.com');
    await press('Forgot your password?');
    expect(requestPasswordReset).toHaveBeenCalledWith('juan@example.com');
    expect(host.textContent).toContain('If juan@example.com has an account');
  });
});

describe('signing up', () => {
  it('makes no account until the Terms and Data Use are agreed to', async () => {
    await mount('register');
    await type('auth-username', 'JuanDriver');
    await type('auth-password', 'secret123');
    await press('CREATE ACCOUNT');
    expect(createUsernameAccount).not.toHaveBeenCalled();
    expect(host.textContent).toContain(TERMS_REQUIRED);

    await tick();
    await press('CREATE ACCOUNT');
    expect(createUsernameAccount).toHaveBeenCalledWith('juandriver@user.arangkada.invalid', 'secret123', 'juandriver');
    expect(saveTermsAcceptance).toHaveBeenCalledWith('u1', TERMS_VERSION, expect.any(Number));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('makes an email account when an email is given', async () => {
    await mount('register');
    await type('auth-username', 'juandriver');
    await type('auth-email', 'juan@example.com');
    await type('auth-password', 'secret123');
    await tick();
    await press('CREATE ACCOUNT');
    expect(signUp).toHaveBeenCalledWith('juan@example.com', 'secret123', 'juandriver');
    expect(createUsernameAccount).not.toHaveBeenCalled();
  });

  it('refuses a short password or a bad username before trying', async () => {
    await mount('register');
    await type('auth-username', 'jd');
    await type('auth-password', 'secret123');
    await tick();
    await press('CREATE ACCOUNT');
    expect(host.textContent).toContain('Username:');
    await type('auth-username', 'juandriver');
    await type('auth-password', 'short');
    await press('CREATE ACCOUNT');
    expect(host.textContent).toContain('at least 8');
    expect(createUsernameAccount).not.toHaveBeenCalled();
  });

  it('asks for the agreement before Google, and shows the text on request', async () => {
    await mount('register');
    await press('Continue with Google');
    expect(signInWithGoogle).not.toHaveBeenCalled();
    await press('Read the Terms and Data Use');
    expect(host.textContent).toContain('What we collect');
    await tick();
    await press('Continue with Google');
    expect(saveTermsAcceptance).toHaveBeenCalledWith('u1', TERMS_VERSION, expect.any(Number));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('still signs the account in when the record cannot be written', async () => {
    saveTermsAcceptance.mockRejectedValueOnce(new Error('offline'));
    await mount('register');
    await type('auth-username', 'juandriver');
    await type('auth-password', 'secret123');
    await tick();
    await press('CREATE ACCOUNT');
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('Google from the log-in tab', () => {
  it('lets a returning account straight in', async () => {
    await mount('login');
    await press('Continue with Google');
    expect(onSuccess).toHaveBeenCalled();
    expect(saveTermsAcceptance).not.toHaveBeenCalled();
  });

  it('asks a brand-new account to agree before it continues', async () => {
    getProfile.mockResolvedValueOnce(null);
    await mount('login');
    await press('Continue with Google');
    expect(onSuccess).not.toHaveBeenCalled();
    await press('AGREE AND CONTINUE');
    expect(saveTermsAcceptance).not.toHaveBeenCalled();
    await tick();
    await press('AGREE AND CONTINUE');
    expect(saveTermsAcceptance).toHaveBeenCalledWith('u1', TERMS_VERSION, expect.any(Number));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('signs a new account back out when it does not agree', async () => {
    getProfile.mockResolvedValueOnce({});
    await mount('login');
    await press('Continue with Google');
    await press("Don't agree");
    expect(signOut).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
