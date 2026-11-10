/**
 * The on-screen controls a finger is holding, as what the car is being asked
 * to do.
 *
 * The touch counterpart of the keyboard's key set, and held to the same rules:
 *
 * - **A held control is a held key.** Each finger is tracked on its own, by
 *   pointer id, and reports the control it is on now: a thumb rocking from
 *   left to right without lifting releases one and presses the other, which
 *   is a fresh press of the second - exactly what rolling from one arrow key
 *   to the other is.
 * - **Releasing the drive from a frozen panel takes back every finger that
 *   is down** (`releaseHeld`). Each stays ignored until it is lifted, so the
 *   drive resumes from a fresh press rather than a thumb that was resting on
 *   the brake while the panel was read. A finger put down afterwards counts at
 *   once - the keyboard's rule, per finger.
 * - **A tap is never lost between frames.** A finger that lands and lifts
 *   before a frame has read the controls is still reported to the next frame
 *   that does, once. A key pressed and released inside one frame is lost; a
 *   touch tap is shorter and less deliberate than a key press, and losing one
 *   would be the device grading the learner.
 *
 * No DOM here: the pads translate pointer events into these calls.
 */
import type { InputState } from '@/features/driving-sim/domain/world/InputState';
import { NO_INPUT } from '@/features/driving-sim/domain/world/InputState';

/** One on-screen control, named by the input it drives. */
export type TouchControl = keyof InputState;

interface Finger {
  /** The control under the finger now; null between controls. */
  control: TouchControl | null;
  /** Down when the drive was released, and not lifted since. */
  suppressed: boolean;
}

export class TouchInput {
  private readonly fingers = new Map<number, Finger>();
  /** Controls pressed since a frame last read them. */
  private readonly tapped = new Set<TouchControl>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  /** A finger lands, on `control` or between controls. */
  press(pointerId: number, control: TouchControl | null): void {
    this.fingers.set(pointerId, { control, suppressed: false });
    if (control) this.tapped.add(control);
    this.changed();
  }

  /** A finger that is down moves onto `control`, or off every control. */
  move(pointerId: number, control: TouchControl | null): void {
    const finger = this.fingers.get(pointerId);
    if (!finger || finger.control === control) return;
    finger.control = control;
    if (control && !finger.suppressed) this.tapped.add(control);
    this.changed();
  }

  /** A finger lifts, or the browser takes it away. */
  lift(pointerId: number): void {
    if (this.fingers.delete(pointerId)) this.changed();
  }

  /** Every finger is gone: the page was hidden, or the controls went away. */
  liftAll(): void {
    if (this.fingers.size === 0 && this.tapped.size === 0) return;
    this.fingers.clear();
    this.tapped.clear();
    this.changed();
  }

  /** The drive is resuming from a frozen panel: every finger down now is ignored until it lifts. */
  releaseHeld(): void {
    for (const finger of this.fingers.values()) finger.suppressed = true;
    this.tapped.clear();
    this.changed();
  }

  /** Whether `pointerId` is a finger this tracks. */
  tracks(pointerId: number): boolean {
    return this.fingers.has(pointerId);
  }

  /** Whether a finger that counts is on `control`, for the pad to show it pressed. */
  holds(control: TouchControl): boolean {
    for (const finger of this.fingers.values()) {
      if (!finger.suppressed && finger.control === control) return true;
    }
    return false;
  }

  /**
   * What the fingers ask of the car this frame. Called once per frame that
   * advances the world: it also hands over the taps made since the last call,
   * so it is a read that consumes.
   */
  read(): InputState {
    const input: InputState = { ...NO_INPUT };
    for (const finger of this.fingers.values()) {
      if (!finger.suppressed && finger.control) input[finger.control] = true;
    }
    for (const control of this.tapped) input[control] = true;
    this.tapped.clear();
    return input;
  }

  /** For `useSyncExternalStore`: notified whenever what `holds` answers may have changed. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** For `useSyncExternalStore`: changes whenever the fingers do. */
  getVersion = (): number => this.version;

  private changed() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
