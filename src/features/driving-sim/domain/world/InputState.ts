/**
 * What the driver is asking the car to do this frame.
 *
 * The simulation never sees a keyboard. A touch control, a replay or a test
 * drives it exactly as a keyboard does, which is what lets a drive be recorded
 * and replayed frame for frame.
 */
export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  horn: boolean;
}

export const NO_INPUT: InputState = {
  throttle: false,
  brake: false,
  left: false,
  right: false,
  horn: false,
};
