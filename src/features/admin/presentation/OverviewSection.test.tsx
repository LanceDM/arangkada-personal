// @vitest-environment jsdom
/**
 * The Overview: who has joined, where the study's participants stand, and
 * the records' health, as its view models give them.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PilotOverview } from '@/features/admin/domain/pilotOverview';
import { HEALTH_CHECKS, type RecordHealth } from '@/features/admin/domain/recordHealth';
import { AdminShell } from './AdminShell';
import { OverviewSection, type OverviewRecords } from './OverviewSection';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const render = (node: React.ReactNode, path = '/admin') => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>));
  return host;
};

const OVERVIEW: PilotOverview = {
  participants: 5,
  cohorts: { study: 5, dryrun: 2, test: 1 },
  study: { enrolledToday: 1, inCourse: 3, activeNow: 1, done: 1, withdrawn: 0 },
  stages: [
    { stage: 'consent', participants: 1 },
    { stage: 'levels', participants: 3 },
    { stage: 'done', participants: 1 },
  ],
  places: [
    { place: 'Not in the course yet', participants: 2 },
    { place: 'Level 2', participants: 3 },
  ],
};

const check = (id: string) => HEALTH_CHECKS.find(entry => entry.id === id)!;

const records = (health: RecordHealth | null, over: Partial<OverviewRecords> = {}): OverviewRecords => ({
  health,
  loading: false,
  progress: null,
  error: null,
  readAt: health ? Date.UTC(2026, 9, 22, 6, 30) : null,
  refresh: vi.fn(),
  ...over,
});

const text = (view: HTMLElement) => view.textContent ?? '';

describe('the Overview', () => {
  it("counts the study's participants, the other cohorts apart, and where they stand, all together", () => {
    const view = render(<OverviewSection overview={OVERVIEW} poolLoading={false} poolError={null} records={records(null)} />);
    expect(text(view)).toContain('Study participants5');
    expect(text(view)).toContain('2 dry run, 1 test accounts apart');
    expect(text(view)).toContain("All 5 of the study's participants, at the stage their own home shows them.");
    expect([...view.querySelectorAll('li')].map(item => item.textContent)).toEqual([
      'Consent1', 'Levels 1–113', 'Done1', 'Not in the course yet2', 'Level 23',
    ]);
  });

  it('lists each check that found something with its accounts, and says so when none did', () => {
    const health: RecordHealth = {
      accountsRead: 9,
      attemptsRead: 40,
      issues: [{ ...check('missing-fsm-record'), codes: ['P02', 'P07'] }],
      pending: [{ code: 'P03', attempts: 1 }],
      unreadable: [],
    };
    const view = render(<OverviewSection overview={OVERVIEW} poolLoading={false} poolError={null} records={records(health)} />);
    expect(text(view)).toContain('9 accounts, 40 attempts');
    expect(text(view)).toContain('missing-fsm-record');
    expect(text(view)).toContain('P02, P07');
    expect(text(view)).toContain('P03 (1)');
    expect(text(view)).not.toContain('Every record is there');

    act(() => root!.unmount());
    host!.remove();
    const clean = render(
      <OverviewSection overview={OVERVIEW} poolLoading={false} poolError={null} records={records({ ...health, issues: [], pending: [] })} />
    );
    expect(text(clean)).toContain('Every record is there, and no check found anything.');
  });

  it('refreshes the records on request, and shows how far a read has got', () => {
    const refresh = vi.fn();
    const view = render(
      <OverviewSection overview={OVERVIEW} poolLoading={false} poolError={null} records={records(null, { refresh, loading: true, progress: { done: 3, total: 9 } })} />
    );
    expect(text(view)).toContain('Reading accounts: 3 of 9');
    const button = [...view.querySelectorAll('button')].find(candidate => candidate.textContent?.includes('Refresh records'))!;
    expect(button.disabled).toBe(true);

    act(() => root!.unmount());
    host!.remove();
    const idle = render(<OverviewSection overview={OVERVIEW} poolLoading={false} poolError={null} records={records(null, { refresh })} />);
    act(() => [...idle.querySelectorAll('button')].find(candidate => candidate.textContent?.includes('Refresh records'))!.click());
    expect(refresh).toHaveBeenCalledOnce();
  });
});

describe('the admin frame', () => {
  it('links every section, and marks the one open', () => {
    const view = render(
      <AdminShell userEmail="dev@example.com" onSignOut={() => {}}>
        <p>section</p>
      </AdminShell>,
      '/admin/pilot'
    );
    const links = [...view.querySelectorAll('nav a')];
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Overview', '/admin'],
      ['Participants', '/admin/pilot'],
      ['Replay', '/admin/replay'],
      ['Course flow', '/admin/routing'],
      ['Q-learning', '/admin/q-learning'],
      ['BKT & export', '/admin/course'],
      ['Model evaluation', '/admin/evaluation'],
      ['IRT', '/admin/irt'],
      ['Player report', '/admin/report'],
      ['Quiz items', '/admin/quiz'],
      ['Scenarios', '/admin/scenarios'],
      ['Test mode', '/admin/test-mode'],
    ]);
    expect(links.filter(link => link.getAttribute('aria-current') === 'page').map(link => link.textContent)).toEqual(['Participants']);
    expect(text(view)).toContain('section');
  });
});
