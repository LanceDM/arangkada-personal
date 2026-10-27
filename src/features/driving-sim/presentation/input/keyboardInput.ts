/**
 * The keys the driver is holding, as what the car is being asked to do.
 *
 * The simulation never sees a keyboard: it takes an `InputState`, so a touch
 * control, a replay or a test can drive it exactly as a keyboard does.
 */
import type { InputState } from '@/features/driving-sim/application/session/DrivingSession';

const held = (keys: ReadonlySet<string>, ...names: string[]) => names.some(name => keys.has(name));

export const readInput = (keys: ReadonlySet<string>): InputState => ({
  throttle: held(keys, 'ArrowUp', 'w', 'W'),
  brake: held(keys, 'ArrowDown', 's', 'S', ' '),
  left: held(keys, 'ArrowLeft', 'a', 'A'),
  right: held(keys, 'ArrowRight', 'd', 'D'),
  horn: held(keys, 'h', 'H'),
});
