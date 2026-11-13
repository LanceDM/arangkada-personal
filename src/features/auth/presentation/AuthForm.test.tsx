// @vitest-environment jsdom
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
const signUp = vi.fn(async () => user);
const signInWithGoogle = vi.fn(async () => user);
const saveTermsAcceptance = vi.fn(async () => {});

let root: Root;
let host: HTMLDivElement;
const onSuccess = vi.fn();

const mount = async (view: 'login' | 'register') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<StrictMode><AuthForm defaultView={view} onSuccess={onSuccess} /></StrictMode>));
};
const type = (placeholder: string, value: string) =>
  act(() => {
    const input = host.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const press = (label: string) =>
  act(async () => {
    [...host.querySelectorAll('button')].find(b => b.textContent?.includes(label))!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
const tick = () => act(() => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
const fill = async () => {
  await type('JuanDriver', 'juan');
  await type('juan@example.com', 'juan@example.com');
  await type('••••••••', 'secret123');
};

beforeEach(() => {
  vi.clearAllMocks();
  provideAuthDependencies({ auth: { signUp, signInWithGoogle }, userProfiles: { saveTermsAcceptance } } as unknown as AuthDependencies);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the sign-up form', () => {
  it('makes no account until the Terms and Data Use are agreed to', async () => {
    await mount('register');
    await fill();
    await press('GUMAWA NG ACCOUNT');
    expect(signUp).not.toHaveBeenCalled();
    expect(host.textContent).toContain(TERMS_REQUIRED);

    await tick();
    await press('GUMAWA NG ACCOUNT');
    expect(signUp).toHaveBeenCalledWith('juan@example.com', 'secret123', 'juan');
    expect(saveTermsAcceptance).toHaveBeenCalledWith('u1', TERMS_VERSION, expect.any(Number));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('asks for the same agreement before Google, and shows the text on request', async () => {
    await mount('login');
    await press('Continue with Google');
    expect(signInWithGoogle).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('What we collect');
    await press('Read the Terms and Data Use');
    expect(host.textContent).toContain('What we collect');
    expect(host.textContent).not.toMatch(/thesis/i);

    await tick();
    await press('Continue with Google');
    expect(signInWithGoogle).toHaveBeenCalled();
    expect(saveTermsAcceptance).toHaveBeenCalledWith('u1', TERMS_VERSION, expect.any(Number));
  });

  it('still signs the account in when the record cannot be written', async () => {
    saveTermsAcceptance.mockRejectedValueOnce(new Error('offline'));
    await mount('register');
    await fill();
    await tick();
    await press('GUMAWA NG ACCOUNT');
    expect(onSuccess).toHaveBeenCalled();
  });
});
