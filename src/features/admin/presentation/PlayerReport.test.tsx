// @vitest-environment jsdom
/**
 * The player report on screen, driven by its own hook over an in-memory
 * report: the totals, the player search and detail, and the attempts' level
 * filter.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import { usePlayerReport } from '@/features/admin/application/usePlayerReport';
import type { AttemptRow, UserRow } from '@/features/admin/domain/adminReport';
import { levelName } from '@/features/admin/domain/playerReport';
import { PlayerReport } from './PlayerReport';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HOUR = 60 * 60_000;
const NOW = Date.now();

const user = (id: string, username: string, email: string): UserRow => ({
  id, username, email, createdAt: NOW - 100 * HOUR, totalScore: 0, longestStreak: 0, bestExamScore: 0,
});
const log = (timestamp: number, result: ActionLog['result']): ActionLog => ({ timestamp, action: 'brake', result, points: result === 'correct' ? 10 : -10, competency: 'pedestrians' });
const attempt = (userId: string, levelId: number, timestamp: number, finalScore: number, logs: ActionLog[] = []): AttemptRow => ({
  userId, levelId, timestamp, finalScore, logs,
  correctDecisions: logs.filter(entry => entry.result === 'correct').length,
  violations: logs.filter(entry => entry.result === 'violation').length,
});

const USERS = [user('u1', 'Joy', 'joy@example.test'), user('u2', 'P01', ''), user('u3', 'Ben', 'ben@example.test')];
const ATTEMPTS = [
  attempt('u1', 0, NOW - 5 * HOUR, 80, [log(NOW - 5 * HOUR - 10, 'correct'), log(NOW - 5 * HOUR - 5, 'violation')]),
  attempt('u1', 1, NOW - 4 * HOUR, 95),
  attempt('u2', 0, NOW - HOUR, 60),
];

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  provideAdminDependencies({
    report: {
      users: async () => USERS,
      attempts: async () => ATTEMPTS,
      examResults: async () => [{ id: 'e', userId: 'u3', score: 32, passed: true, wrongIds: [], timestamp: NOW - 2 * HOUR }],
      dailyResults: async () => [],
    },
  } as unknown as AdminDependencies);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const Harness = () => <PlayerReport report={usePlayerReport(true)} />;

const render = async () => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => root!.render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>));
  for (let i = 0; i < 5; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
  return host;
};

const text = (element: Element) => element.textContent ?? '';
const bodyRows = (view: HTMLElement) => [...view.querySelectorAll('[role="tabpanel"]:not([hidden]) tbody tr')];
const type = (input: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const openTab = (view: HTMLElement, label: string) =>
  act(() => {
    const trigger = [...view.querySelectorAll('[role="tab"]')].find(tab => text(tab) === label)!;
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });

describe('the player report', () => {
  it('totals every mode, and lists players with the most recently active first', async () => {
    const view = await render();
    // The Players tile: its label, its value, its hint.
    expect(text(view)).toContain('Players32 played Story Mode');
    expect(text(view)).toContain('Average score 78');
    expect(text(view)).toContain('1 passed');
    expect(bodyRows(view).map(row => text(row.querySelector('td')!))).toEqual(['P01Pilot pool account', 'Benben@example.test', 'Joyjoy@example.test']);
  });

  it('narrows the players by a search, and shows one player beside the list', async () => {
    const view = await render();
    type(view.querySelector<HTMLInputElement>('input[aria-label="Search players"]')!, 'joy');
    expect(bodyRows(view)).toHaveLength(1);
    expect(text(view)).toContain('Select a player');

    act(() => (bodyRows(view)[0] as HTMLElement).click());
    expect(text(view)).not.toContain('Select a player');
    expect(text(view)).toContain(levelName(1));
    expect(text(view)).toContain('Mistake');
    expect(text(view)).toContain('Level 0 · brake');

    act(() => view.querySelector<HTMLButtonElement>('button[aria-label="Close player"]')!.click());
    expect(text(view)).toContain('Select a player');
  });

  it('filters the Story attempts by level', async () => {
    const view = await render();
    openTab(view, 'Story attempts');
    expect(bodyRows(view)).toHaveLength(3);
    const select = view.querySelector<HTMLSelectElement>('select[aria-label="Level"]')!;
    act(() => {
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(bodyRows(view)).toHaveLength(1);
    expect(text(view)).toContain('Showing 1 of 1');
    expect(view.querySelector('button')?.textContent).not.toBe('Show more');
  });
});
