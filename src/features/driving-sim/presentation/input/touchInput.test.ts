import { describe, expect, it, vi } from 'vitest';
import { NO_INPUT } from '@/features/driving-sim/domain/world/InputState';
import { TouchInput } from './touchInput';

const only = (overrides: Partial<typeof NO_INPUT>) => ({ ...NO_INPUT, ...overrides });

describe('touch input', () => {
  it('maps each control to the input it drives', () => {
    for (const control of ['throttle', 'brake', 'left', 'right', 'horn'] as const) {
      const touch = new TouchInput();
      touch.press(1, control);
      expect(touch.read()).toEqual(only({ [control]: true }));
    }
  });

  it('holds a control for as long as the finger stays on it, as a held key', () => {
    const touch = new TouchInput();
    touch.press(1, 'brake');
    expect(touch.read().brake).toBe(true);
    expect(touch.read().brake).toBe(true);
    touch.lift(1);
    expect(touch.read()).toEqual(NO_INPUT);
  });

  it('takes several fingers at once: steer and brake together', () => {
    const touch = new TouchInput();
    touch.press(1, 'left');
    touch.press(2, 'brake');
    expect(touch.read()).toEqual(only({ left: true, brake: true }));
    touch.lift(1);
    expect(touch.read()).toEqual(only({ brake: true }));
  });

  it('follows a thumb that rocks from one control to the other without lifting', () => {
    const touch = new TouchInput();
    touch.press(1, 'left');
    expect(touch.read()).toEqual(only({ left: true }));
    touch.move(1, null);
    expect(touch.read()).toEqual(NO_INPUT);
    touch.move(1, 'right');
    expect(touch.read()).toEqual(only({ right: true }));
  });

  it('reports a tap that lands and lifts between two frames to the next frame, once', () => {
    const touch = new TouchInput();
    touch.press(1, 'throttle');
    touch.lift(1);
    expect(touch.read()).toEqual(only({ throttle: true }));
    expect(touch.read()).toEqual(NO_INPUT);
  });

  it('counts a finger put down between controls only once it reaches one', () => {
    const touch = new TouchInput();
    touch.press(1, null);
    expect(touch.read()).toEqual(NO_INPUT);
    touch.move(1, 'horn');
    expect(touch.read()).toEqual(only({ horn: true }));
  });

  describe('releasing the drive from a frozen panel', () => {
    it('ignores every finger that is down until it lifts', () => {
      const touch = new TouchInput();
      touch.press(1, 'brake');
      touch.press(2, 'left');
      touch.releaseHeld();
      expect(touch.read()).toEqual(NO_INPUT);
      expect(touch.holds('brake')).toBe(false);
      // Still down a moment later: still ignored.
      expect(touch.read()).toEqual(NO_INPUT);
    });

    it('keeps a held finger ignored when it slides onto another control', () => {
      const touch = new TouchInput();
      touch.press(1, 'left');
      touch.releaseHeld();
      touch.move(1, 'right');
      expect(touch.read()).toEqual(NO_INPUT);
    });

    it('drops a tap made while the panel was up', () => {
      const touch = new TouchInput();
      touch.press(1, 'throttle');
      touch.lift(1);
      touch.releaseHeld();
      expect(touch.read()).toEqual(NO_INPUT);
    });

    it('counts the same finger again once it is lifted and pressed again: a fresh press', () => {
      const touch = new TouchInput();
      touch.press(1, 'brake');
      touch.releaseHeld();
      touch.lift(1);
      touch.press(1, 'brake');
      expect(touch.read()).toEqual(only({ brake: true }));
    });

    it('counts a new finger at once, while the held one stays ignored', () => {
      const touch = new TouchInput();
      touch.press(1, 'brake');
      touch.releaseHeld();
      touch.press(2, 'left');
      expect(touch.read()).toEqual(only({ left: true }));
    });
  });

  it('lets go of everything when the page is hidden or the controls go away', () => {
    const touch = new TouchInput();
    touch.press(1, 'brake');
    touch.press(2, 'right');
    touch.liftAll();
    expect(touch.read()).toEqual(NO_INPUT);
    expect(touch.tracks(1)).toBe(false);
  });

  it('tells the pads when what they show may have changed', () => {
    const touch = new TouchInput();
    const listener = vi.fn();
    const unsubscribe = touch.subscribe(listener);
    const before = touch.getVersion();
    touch.press(1, 'left');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(touch.getVersion()).not.toBe(before);
    expect(touch.holds('left')).toBe(true);
    unsubscribe();
    touch.lift(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
