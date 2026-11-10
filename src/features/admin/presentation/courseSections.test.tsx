// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { CourseFlowSection } from './CourseFlowSection';
import { QLearningSection } from './QLearningSection';
import { mount, pressTab, text, unmount, view } from './adminSections.fixture';

provideAdminDependencies({
  live: { watchTable: (on: (t: null) => void) => (on(null), () => {}), watchUpdates: (_: number, on: (r: []) => void) => (on([]), () => {}) },
} as unknown as AdminDependencies);

const course = (over: Partial<CourseAdmin> = {}): CourseAdmin => ({
  players: [
    {
      uid: 'u1', label: 'U-1', entries: 2, lastPhase: 'REPEAT(1)', lastLevel: 1, lastAt: 3000, endReason: null, decisions: 3, rewards: 1,
      standing: [{ competency: 'driver_legality', attempts: 2, lastAction: 'practice', status: 'open', lastCorrect: 1, lastTotal: 3 }],
    },
  ],
  stats: [],
  decisions: [],
  mastery: [],
  courseLogs: [],
  loading: false,
  loadedAt: 1,
  error: null,
  collectionErrors: {},
  refresh: () => {},
  ...over,
});

afterEach(unmount);

describe('the course admin sections', () => {
  it('draw the machine from the code, and each player', async () => {
    await mount(<CourseFlowSection course={course()} />);
    expect(text()).toContain('QUIZ(L)');
    expect(text()).toContain('2 of 3');
    await pressTab('Players');
    expect(text()).toContain('U-1');
    expect(text()).toContain('Driver Legality · open 1/3');
  });

  it('show the policy, the live table and the decisions', async () => {
    await mount(<QLearningSection course={course()} />);
    expect(text()).toContain('Double Explore-then-Commit');
    expect(text()).toContain('γ = 0.9');
    expect(text()).toContain('No table yet');
    await pressTab('Decisions');
    expect(text()).toContain('No decisions yet');
    await act(async () => {});
    expect(view()).toBeTruthy();
  });
});
