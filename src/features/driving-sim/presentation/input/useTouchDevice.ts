import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Whether this device is driven by touch: the on-screen controls are shown by
 * what the device can do, never by how wide its screen is. An iPad is as wide
 * as a laptop and a phone on its side is wider than a tablet on its end.
 *
 * Asked of the device at mount, and settled for good by the first touch: a
 * browser that reports a fine pointer but is then touched is a touch device.
 * A touchscreen laptop gets the controls and keeps its keyboard.
 */
const reportsTouch = (): boolean =>
  typeof window !== 'undefined' &&
  (Boolean(window.matchMedia?.('(any-pointer: coarse)').matches) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));

export const useTouchDevice = (): boolean => {
  const [touch, setTouch] = useState(reportsTouch);

  useEffect(() => {
    if (touch) return;
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onPointer, { capture: true });
  }, [touch]);

  return touch;
};

const PORTRAIT = '(orientation: portrait)';

const portraitQuery = () => (typeof window === 'undefined' ? undefined : window.matchMedia?.(PORTRAIT));

const subscribePortrait = (onChange: () => void) => {
  const media = portraitQuery();
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};

/** Whether the screen is taller than it is wide. False wherever there is no browser to ask. */
export const usePortrait = (): boolean =>
  useSyncExternalStore(
    subscribePortrait,
    () => portraitQuery()?.matches ?? false,
    () => false
  );
