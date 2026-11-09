// @vitest-environment jsdom
/**
 * The drive screen on a touch device: the on-screen controls are shown by what
 * the device can do, never by how wide it is, and the drive waits while the
 * device is held upright.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { provideDrivingSimDependencies } from '@/features/driving-sim/application/dependencies';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import GameScreen from './GameScreen';

vi.mock('@/features/auth', () => ({ useAuthSession: () => ({ isAdmin: false }) }));

provideDrivingSimDependencies({
  learnerHistory: { load: async () => ({ source: 'local', attempts: [] }) },
  storyAttempts: {
    save: async () => 'test-attempt',
    saveFsmTelemetry: async () => {},
    saveDecisionTelemetry: async () => {},
    saveRoutingTelemetry: async () => {},
  },
  signCoverage: { load: () => ({}), record: () => {} },
  briefingProgress: { load: () => ({}), save: () => {}, markLessonsRead: () => {} },
  quizBank: { load: async () => ({ items: [], settings: null }) },
  quizSittings: { save: async () => {} },
  routingMode: 'new',
  routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
  routingOverride: { load: () => 'assigned', save: () => {} },
  optimizedRouting: async () => {
    throw new Error('no drive here reads the routing table');
  },
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** A browser whose media queries answer as a device would. */
const device = ({ coarse, portrait }: { coarse: boolean; portrait: boolean }) =>
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('coarse') ? coarse : query.includes('portrait') ? portrait : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

describe('the drive screen on a touch device', () => {
  let container: HTMLDivElement;
  let root: Root;
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    // jsdom has no layout, so nothing to observe: the board stays at its default scale.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      recordingCanvasContext().ctx as unknown as RenderingContext
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const mount = () =>
    act(() =>
      root.render(<GameScreen level={LEVELS.find(level => level.id === 3)!} onComplete={vi.fn()} onExit={vi.fn()} />)
    );

  const pads = () => [...container.querySelectorAll<HTMLElement>('[data-control]')].map(el => el.dataset.control);

  it('shows the controls for a coarse pointer, whatever the width, and drops the key legend', () => {
    device({ coarse: true, portrait: false });
    mount();
    expect(container.querySelector('[data-input]')?.getAttribute('data-input')).toBe('touch');
    expect(pads().sort()).toEqual(['brake', 'left', 'right', 'throttle']);
    expect(container.textContent).not.toMatch(/Controls/);
    expect(frames.length).toBeGreaterThan(0);
  });

  it('shows no controls to a keyboard and mouse, and keeps the key legend', () => {
    device({ coarse: false, portrait: false });
    mount();
    expect(container.querySelector('[data-input]')?.getAttribute('data-input')).toBe('keys');
    expect(pads()).toEqual([]);
    expect(container.textContent).toMatch(/Controls/);
  });

  it('switches to the controls at the first touch on a device that did not report one', () => {
    device({ coarse: false, portrait: false });
    mount();
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    });
    expect(pads()).toHaveLength(4);
  });

  it('asks for the device to be turned, and does not drive, while it is upright', () => {
    device({ coarse: true, portrait: true });
    mount();
    expect(container.querySelector('[data-testid="rotate-device"]')).not.toBeNull();
    expect(frames).toHaveLength(0);
  });

  it('never asks a keyboard player to turn anything', () => {
    device({ coarse: false, portrait: true });
    mount();
    expect(container.querySelector('[data-testid="rotate-device"]')).toBeNull();
    expect(frames.length).toBeGreaterThan(0);
  });
});
