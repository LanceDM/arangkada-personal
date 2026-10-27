// @vitest-environment jsdom
/**
 * The stage every level's on-foot decisions are made on, and the keyboard that
 * has to work there.
 *
 * One component serves three stages — Level 2's and Level 10's pre-drive
 * garages, and Level 9's crash scene — so the hierarchy and the keyboard are
 * asserted against all of them rather than against the one that was redesigned.
 * The point panel used to be a two-column grid whose answers sat at 12px beside
 * a diagram; it is one column now, and the question is the largest thing on it.
 */
import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import GarageStage from './GarageStage';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { GarageHotspot, GarageStage as GarageStageData } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/**
 * Every pre-drive garage in the game.
 *
 * Only the garages. A crash scene is no longer this component with different
 * words — it has its own screen, and its own tests beside it — so sweeping it
 * through here would be testing a path production does not take.
 */
const STAGES: Array<{ where: string; stage: GarageStageData }> = LEVELS.flatMap(level =>
  level.garage ? [{ where: `L${level.id} garage`, stage: level.garage }] : []
);

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // The stage measures its own slot to scale the diagram, and paints that
  // diagram on a canvas. jsdom has neither, and neither is what is under test
  // here — the questions, the answers and the keyboard are.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  // The op recorder the render golden already uses stands in for the 2D
  // context jsdom does not have.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    recordingCanvasContext().ctx as unknown as RenderingContext
  );
});

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

const mount = (
  stage: GarageStageData,
  onAnswer: (spot: GarageHotspot, action: string) => void = () => {},
  seed = 0
) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <GarageStage
        garage={stage}
        levelName="Test stage"
        score={0}
        choiceSeed={seed}
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

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });

/** Opens the first point from the checklist, the way a keyboard user can. */
const openFirstPoint = (host: HTMLElement, stage: GarageStageData) => {
  const entry = [...host.querySelectorAll('button')].find(button =>
    button.textContent?.includes(stage.hotspots[0].label)
  )!;
  act(() => {
    entry.click();
  });
};

describe('every stage in the game', () => {
  it('is something the roster actually contains', () => {
    // Two of them. Level 9's pre-drive stage was removed and its crash scene
    // moved to `CrashResponseStage`, so this count is the assertion that the
    // file is testing what it thinks it is.
    expect(STAGES.map(entry => entry.where)).toEqual(['L2 garage', 'L10 garage']);
  });

  it('opens each point with its first answer focused', () => {
    for (const { where, stage } of STAGES) {
      const host = mount(stage);
      openFirstPoint(host, stage);
      const first = [...host.querySelectorAll('button')].find(button =>
        button.textContent?.includes(stage.hotspots[0].choices[0].label)
      );
      expect(document.activeElement, where).toBe(first);
      cleanup?.();
      cleanup = null;
    }
  });

  it('takes an answer by its number key', () => {
    for (const { where, stage } of STAGES) {
      const answered: string[] = [];
      const host = mount(stage, (_spot, action) => answered.push(action));
      openFirstPoint(host, stage);
      press('2');
      expect(answered, where).toEqual([stage.hotspots[0].choices[1].action]);
      cleanup?.();
      cleanup = null;
    }
  });

  it('ignores a number key with no answer behind it', () => {
    for (const { where, stage } of STAGES) {
      const answered: string[] = [];
      const host = mount(stage, (_spot, action) => answered.push(action));
      openFirstPoint(host, stage);
      press('9');
      expect(answered, where).toEqual([]);
      cleanup?.();
      cleanup = null;
    }
  });

  it('keeps Tab inside the open point', () => {
    for (const { where, stage } of STAGES) {
      const host = mount(stage);
      openFirstPoint(host, stage);
      const dialog = host.querySelector('[role="dialog"]')!;
      const buttons = [...dialog.querySelectorAll('button')];
      buttons[buttons.length - 1].focus();
      press('Tab');
      expect(dialog.contains(document.activeElement), where).toBe(true);
      cleanup?.();
      cleanup = null;
    }
  });

  it('shows the question, the observation and the answers, and nothing else', () => {
    // No verdict text and no law citation while the question is still open:
    // the stage reports its outcome through the same result card the road does.
    for (const { where, stage } of STAGES) {
      const spot = stage.hotspots[0];
      const host = mount(stage);
      openFirstPoint(host, stage);
      const dialog = host.querySelector('[role="dialog"]')!;
      expect(dialog.textContent, where).toContain(spot.question);
      expect(dialog.textContent, where).toContain(spot.observation);
      for (const choice of spot.choices) {
        expect(dialog.textContent, `${where} ${choice.label}`).toContain(choice.label);
      }
      expect(dialog.textContent, where).not.toContain(spot.rewardMessage);
      expect(dialog.textContent, where).not.toContain(spot.penaltyMessage);
      if (spot.lawCitation) expect(dialog.textContent, where).not.toContain(spot.lawCitation);
      cleanup?.();
      cleanup = null;
    }
  });
});

describe('the crash scene', () => {
  it('is not this component any more', () => {
    // It was `GarageStage` with two label strings swapped, which a playtest
    // fairly called a renamed inspection. Its screen, its markers and its
    // hierarchy are `CrashResponseStage`'s now; what the two still share is the
    // panel one point is answered in.
    const aftermath = LEVELS.find(level => level.id === 9)!.aftermath!;
    expect(aftermath.scene).toBe('crash_scene');
    expect(STAGES.some(entry => entry.stage === aftermath)).toBe(false);
  });
});
