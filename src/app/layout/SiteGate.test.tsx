// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { SiteGate } from './SiteGate';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let session = { isAdmin: false, isLoggedIn: false };
vi.mock('@/features/auth', () => ({
  useAuthSession: () => session,
  useAuthModal: () => ({ open: () => {} }),
}));

interface SiteStatus {
  suspended: boolean;
  message: string;
  updatedAt: number;
  updatedBy: string;
}
vi.mock('@/features/admin', () => ({ useSiteStatus: () => ({ status: current, loading: false, error: null }) }));

let current: SiteStatus = { suspended: false, message: '', updatedAt: 0, updatedBy: '' };
let host: HTMLDivElement;
let root: Root;

const render = async (path: string) => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SiteGate>
          <p>the app</p>
        </SiteGate>
      </MemoryRouter>
    )
  );
  return host.textContent ?? '';
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  session = { isAdmin: false, isLoggedIn: false };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the site suspension', () => {
  it('lets everyone in while the site is open', async () => {
    current = { suspended: false, message: '', updatedAt: 0, updatedBy: '' };
    expect(await render('/play')).toContain('the app');
  });

  it('shows players the paused screen with the admin message while suspended', async () => {
    current = { suspended: true, message: 'Wait for the facilitator.', updatedAt: 1, updatedBy: 'a' };
    const text = await render('/play/story');
    expect(text).toContain('Arangkada is paused');
    expect(text).toContain('Wait for the facilitator.');
    expect(text).not.toContain('the app');
  });

  it('keeps the admin area and admins working while suspended', async () => {
    current = { suspended: true, message: '', updatedAt: 1, updatedBy: 'a' };
    expect(await render('/admin')).toContain('the app');
    session = { isAdmin: true, isLoggedIn: true };
    expect(await render('/play')).toContain('the app');
  });
});
