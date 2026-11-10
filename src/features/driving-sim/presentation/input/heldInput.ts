/**
 * What the driver is asking the car to do this frame, from every control they
 * have: the keyboard and, on a touch screen, the on-screen pads.
 *
 * The two are simply added together, input by input. With no finger down the
 * result is exactly what the keyboard alone reads, so a keyboard drive is
 * unchanged by the pads existing.
 */
import type { InputState } from '@/features/driving-sim/domain/world/InputState';
import { readInput } from './keyboardInput';
import type { TouchInput } from './touchInput';

/** Which controls the car was actually driven with, over a drive. */
export interface InputUsage {
  keyboard: boolean;
  touch: boolean;
}

export const unusedInput = (): InputUsage => ({ keyboard: false, touch: false });

const anyHeld = (input: InputState) =>
  input.throttle || input.brake || input.left || input.right || input.horn;

/**
 * The frame's input. Called once per frame that advances the world, because
 * reading the pads hands over their taps.
 */
export const readHeldInput = (
  keys: ReadonlySet<string>,
  touch: TouchInput | undefined,
  usage: InputUsage
): InputState => {
  const fromKeys = readInput(keys);
  if (anyHeld(fromKeys)) usage.keyboard = true;
  if (!touch) return fromKeys;

  const fromTouch = touch.read();
  if (!anyHeld(fromTouch)) return fromKeys;
  usage.touch = true;
  return {
    throttle: fromKeys.throttle || fromTouch.throttle,
    brake: fromKeys.brake || fromTouch.brake,
    left: fromKeys.left || fromTouch.left,
    right: fromKeys.right || fromTouch.right,
    horn: fromKeys.horn || fromTouch.horn,
  };
};

/** How the record names the controls a drive used. */
export const describeUsage = (usage: InputUsage): 'keyboard' | 'touch' | 'both' | 'none' =>
  usage.keyboard && usage.touch ? 'both' : usage.touch ? 'touch' : usage.keyboard ? 'keyboard' : 'none';
