// @vitest-environment jsdom
/**
 * The ladder and the results screen under the Legacy / New switch.
 * Without a course they are today's screens: every level open, and Next,
 * Retry and the suggestion after a run. With one, the routing FSM's: Continue,
 * levels passed open as replays, the rest locked, and no Retry.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { LevelResult } from '@/domain/learner/attempt';
import { LEVELS } from '@/features/driving-sim';
import LevelMap, { type LevelMapCourse } from './LevelMap';
import LevelComplete from './LevelComplete';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const render = (element: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{element}</MemoryRouter>));
  return host;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** The ladder's level buttons, by level id. */
const levelButtons = (container: HTMLElement) =>
  new Map(
    [...container.querySelectorAll('p')]
      .filter(label => /^LEVEL \d+$/.test(label.textContent ?? ''))
      .map(label => {
        // The label sits in the row's info card; the node button is the row's own.
        const row = label.parentElement!.parentElement!;
        return [Number(label.textContent!.replace('LEVEL ', '')), row.querySelector(':scope > button') as HTMLButtonElement];
      })
  );

const buttonText = (container: HTMLElement) => [...container.querySelectorAll('button')].map(b => b.textContent ?? '');

describe('the ladder', () => {
  it('in Legacy keeps every level open, and offers no Continue', () => {
    const onSelect = vi.fn();
    const container = render(<LevelMap onSelectLevel={onSelect} />);
    const buttons = levelButtons(container);
    expect(buttons.size).toBe(LEVELS.length);
    for (const button of buttons.values()) expect(button.disabled).toBe(false);
    expect(buttonText(container).some(text => text.includes('CONTINUE COURSE'))).toBe(false);
    act(() => buttons.get(7)!.click());
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('in a New group offers Continue, opens the levels passed as replays, and locks those ahead', () => {
    const onSelect = vi.fn();
    const course: LevelMapCourse = { frontierLevelId: 4, certified: false, openAll: false, loading: false, onContinue: vi.fn() };
    const container = render(<LevelMap onSelectLevel={onSelect} course={course} />);
    const buttons = levelButtons(container);
    for (const [levelId, button] of buttons) expect(button.disabled).toBe(levelId > 4);

    act(() => buttons.get(2)!.click());
    expect(onSelect).toHaveBeenCalledWith(2);
    act(() => buttons.get(4)!.click());
    expect(course.onContinue).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledTimes(1);

    const next = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('CONTINUE COURSE'))!;
    act(() => next.click());
    expect(course.onContinue).toHaveBeenCalledTimes(2);
  });

  it('opens every level once certified, or for a developer or admin', () => {
    for (const course of [
      { frontierLevelId: null, certified: true, openAll: false, loading: false, onContinue: vi.fn() },
      { frontierLevelId: 1, certified: false, openAll: true, loading: false, onContinue: vi.fn() },
    ]) {
      const container = render(<LevelMap onSelectLevel={vi.fn()} course={course} />);
      for (const button of levelButtons(container).values()) expect(button.disabled).toBe(false);
      act(() => root?.unmount());
      host?.remove();
    }
  });
});

describe('the results screen', () => {
  const level = LEVELS.find(entry => entry.id === 3)!;
  const passed: LevelResult = {
    levelId: 3, score: level.requiredScore + 10, stars: 2, completed: true, violations: 0, correctActions: 5, logs: [],
  };

  it('in Legacy offers Next, Retry and the map', () => {
    const container = render(
      <LevelComplete result={passed} level={level} onNext={vi.fn()} onRetry={vi.fn()} onMenu={vi.fn()} hasNextLevel />
    );
    const text = buttonText(container).join('|');
    expect(text).toContain('NEXT LEVEL');
    expect(text).toContain('RETRY');
    expect(text).not.toContain('CONTINUE');
  });

  it("in a New group offers the routing FSM's Continue and the map, and nothing else", () => {
    const onContinue = vi.fn();
    const container = render(
      <LevelComplete
        result={passed} level={level} onNext={vi.fn()} onRetry={vi.fn()} onMenu={vi.fn()} hasNextLevel
        course={{ note: 'Continue to the next step of your course.', onContinue }}
      />
    );
    const text = buttonText(container).join('|');
    expect(text).toContain('CONTINUE');
    expect(text).toContain('Back to Map');
    expect(text).not.toContain('NEXT LEVEL');
    expect(text).not.toContain('RETRY');
    expect(container.textContent).toContain('Continue to the next step of your course.');
    act(() => [...container.querySelectorAll('button')].find(b => b.textContent?.includes('CONTINUE'))!.click());
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
