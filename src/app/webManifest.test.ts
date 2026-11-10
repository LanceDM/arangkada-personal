import { describe, expect, it } from 'vitest';
import manifestSource from '../../public/manifest.webmanifest?raw';

/**
 * The manifest is copied as it is, so nothing adds the build's base to it.
 * Its URLs are resolved against the manifest's own address, which is what
 * keeps them inside the app wherever it is served.
 */
const manifest = JSON.parse(manifestSource) as {
  start_url: string;
  scope: string;
  icons: { src: string }[];
};

const resolve = (manifestUrl: string, member: string) => new URL(member, manifestUrl).pathname;

describe('web manifest', () => {
  const urls = [manifest.start_url, manifest.scope, ...manifest.icons.map(icon => icon.src)];

  it('gives every URL relative to the manifest', () => {
    for (const url of urls) expect(url, url).not.toMatch(/^(\/|[a-z]+:)/i);
  });

  it('opens Story Mode inside its scope, at the root and under a sub-path', () => {
    for (const base of ['/', '/some-base/']) {
      const at = `https://example.test${base}manifest.webmanifest`;
      expect(resolve(at, manifest.start_url)).toBe(`${base}play/story`);
      expect(resolve(at, manifest.scope)).toBe(base);
      for (const icon of manifest.icons) expect(resolve(at, icon.src)).toMatch(new RegExp(`^${base}icons/`));
    }
  });
});
