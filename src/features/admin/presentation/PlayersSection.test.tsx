// @vitest-environment jsdom
/**
 * Admin > Players over in-memory repositories: the accounts are read on open,
 * and one account's records only when the admin opens it. Nothing is written.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { CourseLogsRepository } from '@/features/admin/application/courseLogsPorts';
import type { AdminReportRepository } from '@/features/admin/application/ports';
import { PlayersSection } from './PlayersSection';
import { flush, mount, repository, text, unmount, view } from './routingSections.fixture';

const reads: string[] = [];
const report = {
  users: async () => (reads.push('users'), [{ id: 'u1', username: 'P01', email: '', createdAt: 5, totalScore: 0, longestStreak: 0, bestExamScore: 0 }]),
} as unknown as AdminReportRepository;
const logs = {
  bktUpdates: async (uid: string) => (reads.push(`bkt/${uid}`), [{ uid, userSeq: 1, competency: 'driver_legality', source: 'drive', correct: true, pAfter: 0.62, levelAfter: 2 }]),
  courseLog: async (uid: string) => (
    reads.push(`course/${uid}`),
    [{ kind: 'drive', levelId: 1, phase: 'DRIVE(1)', verdicts: [], decisions: [], rewards: [], timestamp: 1000 }]
  ),
} as unknown as CourseLogsRepository;

const Harness = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PlayersSection enabled />
  </QueryClientProvider>
);

beforeEach(() => {
  reads.length = 0;
  provideAdminDependencies({ report, pilotRecords: repository, courseLogs: logs } as unknown as AdminDependencies);
});
afterEach(unmount);

describe('the players page', () => {
  it('lists every account, named by code where enrolled, and reads no one\'s records until opened', async () => {
    await mount(<Harness />);
    expect(text()).toContain('P01');
    expect(text()).toContain('E01B');
    expect(reads).toEqual(['users']);
  });

  it('opens one account: its course step, its BKT now and its history', async () => {
    await mount(<Harness />);
    const button = [...view().querySelectorAll('button')].find(b => b.textContent?.startsWith('P01'))!;
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await flush();
    expect(reads).toEqual(['users', 'course/u1', 'bkt/u1']);
    expect(text()).toContain('DRIVE(1)');
    expect(text()).toContain('0.620');
    expect(text()).toContain('Drive saved: Level');
  });
});
