import { useSyncExternalStore } from 'react';

/**
 * Whether this viewer has asked the system for less motion.
 *
 * Live rather than read once: the setting can change while the app is open, and
 * a drive that keeps pulsing because the preference was sampled at mount is the
 * same failure as not honouring it at all.
 *
 * Defaults to `false` where there is no browser to ask — a server render, a
 * node test — so the animated presentation is what you get unless the viewer
 * has actually asked otherwise.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

/** `undefined` wherever there is no browser: a server render, a node test. */
const query = () =>
  typeof window === 'undefined' ? undefined : window.matchMedia?.(QUERY);

const subscribe = (onChange: () => void) => {
  const media = query();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};

/**
 * Read straight from the media query every render rather than mirrored into
 * state: the preference is somebody else's, so React subscribes to it and
 * reads it, and there is no copy of it here to fall out of date.
 */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false
  );
