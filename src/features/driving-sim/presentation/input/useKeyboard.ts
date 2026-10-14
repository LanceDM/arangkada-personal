import { useCallback, useEffect, useRef, RefObject } from 'react';

export interface KeyboardControl {
  /**
   * Drops every key that is held right now, and ignores each of them until it
   * has actually been released and pressed again.
   *
   * Called when the drive is released from a frozen panel. A key the player was
   * leaning on while reading is still physically down, and the browser keeps
   * auto-repeating its `keydown`, so simply clearing the set puts it straight
   * back: without this, resuming applied whatever was held as if it had just
   * been pressed, and the car lurched the moment the panel closed. Suppressing
   * until the real `keyup` means the drive always resumes from a fresh press.
   */
  releaseHeldKeys: () => void;
}

export const useKeyboard = (keysRef: RefObject<Set<string>>): KeyboardControl => {
  // Keys that were down when the drive was last released and have not been let
  // go since. Auto-repeat re-fires `keydown` for them, so they are filtered on
  // the way in rather than cleared once.
  const suppressedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const suppressed = suppressedRef.current;
    // Both sets are captured at setup rather than read through the ref in the
    // cleanup: the drive owns one `Set` for its whole life, so this is the same
    // object either way, and reading it here is what the ref-in-cleanup rule
    // asks for.
    const keys = keysRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!suppressed.has(e.key)) keys?.add(e.key);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      suppressed.delete(e.key);
      keys?.delete(e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      // Restored by the next setup, never latched: Strict Mode replays this
      // effect setup -> cleanup -> setup, and a suppression list that survived
      // the replay would silently swallow the player's first real press.
      suppressed.clear();
      keys?.clear();
    };
  }, [keysRef]);

  const releaseHeldKeys = useCallback(() => {
    const keys = keysRef.current;
    if (!keys) return;
    for (const key of keys) suppressedRef.current.add(key);
    keys.clear();
  }, [keysRef]);

  return { releaseHeldKeys };
};
