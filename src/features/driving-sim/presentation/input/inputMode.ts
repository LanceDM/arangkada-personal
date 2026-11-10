/**
 * Which controls the screen should name: the keyboard's keys, or the
 * on-screen touch controls.
 *
 * Words only. What a scenario shows at each support level is decided by
 * `scenarioSupport` and is the same on both; this changes how a key the screen
 * already shows is drawn - `↓ S Space` on a keyboard, `↓` beside the brake
 * button a thumb is resting on.
 */
import { createContext, useContext } from 'react';

export type InputMode = 'keys' | 'touch';

export const InputModeContext = createContext<InputMode>('keys');

export const useInputMode = (): InputMode => useContext(InputModeContext);

/** What each key the screen names is called on the touch controls; keys with no control there are dropped. */
const TOUCH_NAMES: Record<string, string> = {
  '↑': '↑',
  W: '↑',
  '↓': '↓',
  S: '↓',
  Space: '↓',
  '←': '←',
  A: '←',
  '→': '→',
  D: '→',
};

/** The keys to draw for `keys`, in the controls the player is using. */
export const shownKeys = (keys: readonly string[], mode: InputMode): string[] => {
  if (mode === 'keys') return [...keys];
  const named = keys.map(key => TOUCH_NAMES[key]).filter((name): name is string => Boolean(name));
  return [...new Set(named)];
};

/** The line under a question's answers. */
export const answerHint = (mode: InputMode): string =>
  mode === 'touch' ? 'Tap an answer' : 'Click an answer, or press its number key';
