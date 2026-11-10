import type { DrivingCompetency } from '@/domain/learner/competency';
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
import { getCompetencyLabel } from '@/domain/learner/profile';
import { driveState } from '@/domain/routing/routingTypes';
import { cursorFrontierLevel, LEVELS, type LevelRecommendation, type RoutingCursor } from '@/features/driving-sim';
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
    const course: LevelMapCourse = { frontierLevelId: 4, certified: false, openAll: false, replays: true, loading: false, onContinue: vi.fn() };
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

  it('once the tutorial is passed, replays it and puts Level 1 next', () => {
    const passedTutorial: RoutingCursor = { state: driveState(0), outcome: 'passed', seq: 0, decisionsSpent: 0, pending: null };
    const onSelect = vi.fn();
    const course: LevelMapCourse = {
      frontierLevelId: cursorFrontierLevel(passedTutorial), certified: false, openAll: false, replays: true, loading: false, onContinue: vi.fn(),
    };
    const buttons = levelButtons(render(<LevelMap onSelectLevel={onSelect} course={course} />));
    expect(buttons.get(1)!.disabled).toBe(false);
    expect(buttons.get(1)!.textContent).toContain('NEXT');
    expect(buttons.get(0)!.textContent).not.toContain('NEXT');

    act(() => buttons.get(0)!.click());
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(course.onContinue).not.toHaveBeenCalled();
  });

  it('opens every level once certified, or for a developer or admin', () => {
    for (const course of [
      { frontierLevelId: null, certified: true, openAll: false, replays: true, loading: false, onContinue: vi.fn() },
      { frontierLevelId: 1, certified: false, openAll: true, replays: true, loading: false, onContinue: vi.fn() },
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
        course={{ note: { en: 'Continue to the next step of your course.' }, onContinue }}
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

describe('the results screen after the tutorial', () => {
  const tutorial = LEVELS.find(entry => entry.id === 0)!;
  const step = (timestamp: number, competency: DrivingCompetency, result: 'correct' | 'violation' = 'correct') => ({
    timestamp, action: 'brake', result, points: 10, competency, expectedAction: 'brake',
  });
  const run: LevelResult = {
    levelId: 0, score: 60, stars: 1, completed: true, violations: 1, correctActions: 4,
    logs: [step(1, 'speed_control'), step(2, 'hazard_awareness'), step(3, 'right_of_way', 'violation')],
    competencyScores: { speed_control: 80, hazard_awareness: 90, right_of_way: 40 },
  };
  const practice = { action: 'practice', recommendedLevelId: 3, competency: 'right_of_way' } as unknown as LevelRecommendation;

  it('names no skill and suggests no practice, though its steps carry competencies', () => {
    const container = render(
      <LevelComplete
        result={run} level={tutorial} onNext={vi.fn()} onRetry={vi.fn()} onMenu={vi.fn()} hasNextLevel
        recommendation={practice} onPracticeRecommended={vi.fn()}
      />
    );
    const text = container.textContent ?? '';
    const skills = Object.keys(run.competencyScores!).map(getCompetencyLabel);
    for (const label of ['Skill Breakdown', 'Focus Area', 'Strongest Skill', ...skills]) {
      expect(text, label).not.toContain(label);
    }
    expect(buttonText(container).join('|')).not.toContain('PRACTICE');
    expect(buttonText(container).join('|')).toContain('NEXT LEVEL');
  });

  it('still names them on every other level', () => {
    const level = LEVELS.find(entry => entry.id === 3)!;
    const container = render(
      <LevelComplete result={{ ...run, levelId: 3 }} level={level} onNext={vi.fn()} onRetry={vi.fn()} onMenu={vi.fn()} hasNextLevel />
    );
    expect(container.textContent).toContain('Skill Breakdown');
    expect(container.textContent).toContain(getCompetencyLabel('right_of_way'));
  });
});
