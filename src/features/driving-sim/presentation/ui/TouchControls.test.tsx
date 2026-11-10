// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_INPUT } from '@/features/driving-sim/domain/world/InputState';
import { TouchInput, type TouchControl } from '@/features/driving-sim/presentation/input/touchInput';
import { PedalPad, SteeringPad } from './TouchControls';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * Lays the buttons out in a row, 100px apart, since jsdom has no layout: the
 * pads find the control under a moving finger by the buttons' own boxes.
 */
const layOut = (container: HTMLElement) => {
  const order: TouchControl[] = ['left', 'right', 'throttle', 'brake'];
  for (const button of container.querySelectorAll<HTMLElement>('[data-control]')) {
    const left = order.indexOf(button.dataset.control as TouchControl) * 100;
    button.getBoundingClientRect = () => ({ left, right: left + 80, top: 0, bottom: 80, x: left, y: 0, width: 80, height: 80, toJSON: () => ({}) });
  }
};

/** The centre of a control's box, in the layout above. */
const at = (control: TouchControl) => ({
  clientX: ['left', 'right', 'throttle', 'brake'].indexOf(control) * 100 + 40,
  clientY: 40,
});

const pointer = (type: string, target: Element, pointerId: number, point: { clientX: number; clientY: number }) =>
  act(() => {
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', button: 0, ...point })
    );
  });

describe('the touch controls', () => {
  let container: HTMLDivElement;
  let root: Root;
  let input: TouchInput;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    input = new TouchInput();
    act(() =>
      root.render(
        <>
          <SteeringPad input={input} />
          <PedalPad input={input} />
        </>
      )
    );
    layOut(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = (control: TouchControl) => container.querySelector<HTMLElement>(`[data-control="${control}"]`)!;

  it('drives the input each control names', () => {
    for (const control of ['left', 'right', 'throttle', 'brake'] as const) {
      pointer('pointerdown', button(control), 1, at(control));
      expect(input.read()).toEqual({ ...NO_INPUT, [control]: true });
      pointer('pointerup', button(control), 1, at(control));
      expect(input.read()).toEqual(NO_INPUT);
    }
  });

  it('has no horn: the horn is the keyboard H alone', () => {
    const controls = [...container.querySelectorAll<HTMLElement>('[data-control]')].map(el => el.dataset.control);
    expect(controls.sort()).toEqual(['brake', 'left', 'right', 'throttle']);
  });

  it('takes two thumbs at once, and shows each control pressed', () => {
    pointer('pointerdown', button('left'), 1, at('left'));
    pointer('pointerdown', button('brake'), 2, at('brake'));
    expect(input.read()).toEqual({ ...NO_INPUT, left: true, brake: true });
    expect(button('left').getAttribute('aria-pressed')).toBe('true');
    expect(button('brake').getAttribute('aria-pressed')).toBe('true');
    expect(button('right').getAttribute('aria-pressed')).toBe('false');
  });

  it('follows a thumb that slides from one control to the other', () => {
    pointer('pointerdown', button('left'), 1, at('left'));
    expect(input.read()).toEqual({ ...NO_INPUT, left: true });
    pointer('pointermove', button('left'), 1, at('right'));
    expect(input.read()).toEqual({ ...NO_INPUT, right: true });
    pointer('pointermove', button('left'), 1, { clientX: 1000, clientY: 1000 });
    expect(input.read()).toEqual(NO_INPUT);
  });

  it('lets go when the browser cancels the touch', () => {
    pointer('pointerdown', button('right'), 1, at('right'));
    expect(input.read()).toEqual({ ...NO_INPUT, right: true });
    pointer('pointercancel', button('right'), 1, at('right'));
    expect(input.read()).toEqual(NO_INPUT);
  });

  it('lets go of everything when the page is hidden', () => {
    pointer('pointerdown', button('brake'), 1, at('brake'));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    visibility.mockRestore();
    expect(input.read()).toEqual(NO_INPUT);
  });

  it('keeps a finger held through a released briefing ignored until it lifts', () => {
    pointer('pointerdown', button('brake'), 1, at('brake'));
    act(() => input.releaseHeld());
    expect(input.read()).toEqual(NO_INPUT);
    expect(button('brake').getAttribute('aria-pressed')).toBe('false');
    pointer('pointerup', button('brake'), 1, at('brake'));
    pointer('pointerdown', button('brake'), 1, at('brake'));
    expect(input.read()).toEqual({ ...NO_INPUT, brake: true });
  });

  it('still takes the press where the browser refuses to capture the finger', () => {
    const capture = vi.fn(() => {
      throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
    });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { value: capture, configurable: true });
    try {
      pointer('pointerdown', button('brake'), 7, at('brake'));
      expect(capture).toHaveBeenCalled();
      expect(input.read()).toEqual({ ...NO_INPUT, brake: true });
    } finally {
      delete (HTMLElement.prototype as { setPointerCapture?: unknown }).setPointerCapture;
    }
  });

  it('opens no menu on a long press', () => {
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      button('brake').dispatchEvent(menu);
    });
    expect(menu.defaultPrevented).toBe(true);
  });
});
