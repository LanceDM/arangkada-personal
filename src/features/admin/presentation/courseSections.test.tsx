// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { CourseFlowSection } from './CourseFlowSection';
import { QLearningSection } from './QLearningSection';
import { EvaluationSection } from './EvaluationSection';
import type { EvaluationLogs } from '@/features/admin/application/useEvaluationLogs';
import { clickLabel, mount, pressTab, text, unmount, view } from './adminSections.fixture';

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

describe('the model evaluation section', () => {
  const logs = (over: Partial<EvaluationLogs> = {}): EvaluationLogs => ({ data: null, loading: false, error: null, load: () => {}, ...over });
  const update = (uid: string, predictedCorrect: number, correct: boolean, source = 'quiz') => ({
    uid, competency: 'driver_legality', source, predictedCorrect, correct, userSeq: 1,
  });

  it('asks for the logs before it shows BKT, and loads them on the button', async () => {
    let loaded = 0;
    await mount(<EvaluationSection course={course()} logs={logs({ load: () => void loaded++ })} />);
    expect(text()).toContain('The logs are not loaded');
    await clickLabel('Load the logs');
    expect(loaded).toBe(1);
  });

  it('shows the whole model three ways, then each player', async () => {
    const bktUpdates = [update('u1', 0.9, true), update('u1', 0.2, false), update('u2', 0.8, true, 'drive'), update('u2', 0.6, false, 'drive')];
    await mount(<EvaluationSection course={course()} logs={logs({ data: { bktUpdates, qUpdates: [], loadedAt: 1 } })} />);
    expect(text()).toContain('Pooled over 4 predictions (headline)');
    expect(text()).toContain('Per-player average');
    expect(text()).toContain('1.000 ± 0.000 (2)');
    expect(text()).toContain('Expected calibration error');
    await pressTab('BKT: per player');
    expect(text()).toContain('U-1');
    expect(text()).toContain('u2');
    await pressTab('Q-learning');
    expect(text()).toContain('No decisions yet');
  });

  it('tracks the calibration stage, and calibrates only on request', async () => {
    const bktUpdates = [update('u1', 0.9, true, 'diagnostic'), update('u1', 0.2, false, 'diagnostic'), update('u2', 0.8, true, 'drive')];
    await mount(<EvaluationSection course={course()} logs={logs({ data: { bktUpdates, qUpdates: [], loadedAt: 1 } })} />);
    await pressTab('BKT: calibration');
    expect(text()).toContain('BKT calibration stage: Collecting pilot data');
    expect(text()).toContain('0 of 11 competencies');
    expect(text()).not.toContain('Starting value per competency');
    await clickLabel('Run the calibration');
    expect(text()).toContain('Not enough data yet');
    expect(text()).toContain('Starting value per competency');
    expect(text()).toContain('too few players');
    expect(text()).toContain('the value in force is kept');
    expect(text()).toContain('Held-out test of per-player T: not enough answers yet');
    expect(text()).toContain('Sensitivity check');
    expect(text()).toContain('Slip + 0.05');
    expect(text()).toContain('0 of 7 pilot player(s)');
    expect(text()).toContain('0.250 (fixed: 1 of 4)');
  });
});
