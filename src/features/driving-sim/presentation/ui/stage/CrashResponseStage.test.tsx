// @vitest-environment jsdom
/**
 * The crash scene, as its own experience rather than a renamed inspection.
 *
 * A playtest called the screen this replaces "a renamed garage inspection", and
 * it was: `GarageStage` with `scene: 'crash_scene'` swapped two label strings
 * and one canvas function, and everything a player reads stayed an inspection —
 * a readiness checklist, numbered dots on a diagram, and a button that counted
 * points off a list.
 *
 * So these assert the things that are actually different, and the things the
 * old screen could not do at all: a single immediate objective, markers that
 * say what they are about, and a scene a keyboard can work through.
 */
import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import CrashResponseStage from './CrashResponseStage';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { GarageHotspot } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const stage = LEVELS.find(level => level.id === 9)!.aftermath!;

let matchesReducedMotion = false;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduced-motion') ? matchesReducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    recordingCanvasContext().ctx as unknown as RenderingContext
  );
});

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  matchesReducedMotion = false;
});

const mount = (onAnswer: (spot: GarageHotspot, action: string) => void = () => {}) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <CrashResponseStage
        stage={stage}
        levelName="Emergencies And Road Crashes"
        score={0}
        choiceSeed={0}
        onAnswer={onAnswer}
        onComplete={() => {}}
        onExit={() => {}}
      />
    );
  });
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
};

/** The markers standing on the picture, in document order. */
const markers = (host: HTMLElement) =>
  [...host.querySelectorAll('button')].filter(button =>
    stage.hotspots.some(spot => button.getAttribute('aria-label')?.includes(spot.label))
  );

describe('what the crash scene is, and is not', () => {
  it('never calls itself an inspection', () => {
    const host = mount();
    const text = host.textContent ?? '';
    expect(text).toContain('Crash response');
    for (const inspectionWord of ['Pre-Drive', 'Readiness Checklist', 'Inspect all', 'Start Engine']) {
      expect(text, `still says "${inspectionWord}"`).not.toContain(inspectionWord);
    }
  });

  it('carries one immediate objective rather than a checklist to work down', () => {
    // The single primary instruction. The remaining steps exist, but quietly.
    const host = mount();
    expect(host.textContent).toContain('Do this now');
    expect(host.textContent).toContain(stage.hotspots[0].objective);
  });

  it('moves the objective on as the scene is dealt with', () => {
    const host = mount();
    expect(host.textContent).toContain(stage.hotspots[0].objective);

    // Answer the first point, and the objective becomes the second.
    act(() => markers(host)[0].click());
    const dialog = host.querySelector('[role="dialog"]')!;
    act(() => (dialog.querySelectorAll('button')[0] as HTMLButtonElement).click());

    expect(host.textContent).not.toContain(stage.hotspots[0].objective);
    expect(host.textContent).toContain(stage.hotspots[1].objective);
  });

  it('will not let the mission finish while anything is unresolved', () => {
    const host = mount();
    const finish = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.includes('of 4 done')
    )!;
    expect(finish.hasAttribute('disabled')).toBe(true);
  });
});

describe('the markers on the scene', () => {
  it('stands one on each point, and says what each is about', () => {
    // Not numbers. "The second dot" is not something a person standing in front
    // of a burning car can act on.
    const host = mount();
    expect(markers(host)).toHaveLength(stage.hotspots.length);
    const labels = markers(host).map(button => button.getAttribute('aria-label'));
    expect(labels.join(' | ')).toContain('Fire risk');
    expect(labels.join(' | ')).toContain('Vehicle in water');
    expect(labels.join(' | ')).toContain('Injured person');
    expect(labels.join(' | ')).toContain('Reporting duty');
  });

  it('is reachable and operable by keyboard, which a canvas dot never was', () => {
    // The whole reason the markers are DOM over the picture rather than drawn
    // into it: a dot painted on a canvas cannot be focused or read out.
    const host = mount();
    const first = markers(host)[0];
    act(() => first.focus());
    expect(document.activeElement).toBe(first);
    expect(first.tagName).toBe('BUTTON');
  });

  it('marks the next one to deal with, in words as well as in color', () => {
    const host = mount();
    const next = markers(host)[0].getAttribute('aria-label') ?? '';
    expect(next).toContain('deal with this next');
    expect(markers(host)[1].getAttribute('aria-label')).not.toContain('deal with this next');
  });

  it('reports how a point came out, once it has been answered', () => {
    const host = mount();
    act(() => markers(host)[0].click());
    const dialog = host.querySelector('[role="dialog"]')!;
    // Seed 0 is the authored order, so the first button is the right answer.
    act(() => (dialog.querySelectorAll('button')[0] as HTMLButtonElement).click());
    expect(markers(host)[0].getAttribute('aria-label')).toContain('handled correctly');
    expect(markers(host)[0].hasAttribute('disabled')).toBe(true);
  });

  it('reports a wrong answer just as plainly', () => {
    const host = mount();
    act(() => markers(host)[0].click());
    const dialog = host.querySelector('[role="dialog"]')!;
    act(() => (dialog.querySelectorAll('button')[1] as HTMLButtonElement).click());
    expect(markers(host)[0].getAttribute('aria-label')).toContain('handled wrongly');
  });

  it('opens the point it stands on', () => {
    const host = mount();
    act(() => markers(host)[1].click());
    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(stage.hotspots[1].question);
  });
});

describe('motion', () => {
  it('drops the attention pulse for a viewer who asked for less of it', () => {
    matchesReducedMotion = true;
    const host = mount();
    expect(host.querySelectorAll('.animate-ping')).toHaveLength(0);
    // And the marker still says which one is next, without the movement.
    expect(markers(host)[0].getAttribute('aria-label')).toContain('deal with this next');
  });

  it('pulses the next marker when motion is welcome', () => {
    matchesReducedMotion = false;
    const host = mount();
    expect(host.querySelectorAll('.animate-ping').length).toBeGreaterThan(0);
  });
});

describe('the answer it commits', () => {
  it('reports the point and the action back to the host', () => {
    const answered: Array<{ id: string; action: string }> = [];
    const host = mount((spot, action) => answered.push({ id: spot.id, action }));
    act(() => markers(host)[2].click());
    const dialog = host.querySelector('[role="dialog"]')!;
    act(() => (dialog.querySelectorAll('button')[0] as HTMLButtonElement).click());
    expect(answered).toEqual([
      { id: stage.hotspots[2].id, action: stage.hotspots[2].choices[0].action },
    ]);
  });
});
