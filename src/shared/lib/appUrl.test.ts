import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl } from './appUrl';

describe('appUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the router path unchanged at the default base', () => {
    expect(import.meta.env.BASE_URL).toBe('/');
    expect(appUrl('/play/story')).toBe('/play/story');
    expect(appUrl('/admin/pilot')).toBe('/admin/pilot');
    expect(appUrl('/')).toBe('/');
  });

  it('puts the route under a sub-path base', () => {
    vi.stubEnv('BASE_URL', '/some-base/');
    expect(appUrl('/play/story')).toBe('/some-base/play/story');
    expect(appUrl('/admin/pilot')).toBe('/some-base/admin/pilot');
    expect(appUrl('/')).toBe('/some-base/');
  });
});
