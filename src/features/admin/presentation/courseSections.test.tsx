// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { CourseFlowSection } from './CourseFlowSection';
import { QLearningSection } from './QLearningSection';
import { EvaluationSection } from './EvaluationSection';
import { PlayersSection } from './PlayersSection';
import type { EvaluationLogs } from '@/features/admin/application/useEvaluationLogs';
import { clickLabel, flush, mount, pressTab, text, unmount, view } from './adminSections.fixture';
import type { BktSets } from '@/features/admin/application/useBktSets';
import { EMPTY_BKT_SETS, type SavedValueSet } from '@/features/admin/domain/bktSetsAdmin';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { COMPETENCIES } from '@/domain/learner/profile';

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ user: { uid: 'admin-1', email: 'admin@example.com', emailVerified: true, isAdmin: true }, isAdmin: true }),
}));

const bkt = (over: Partial<BktSets> = {}): BktSets => ({
  ...EMPTY_BKT_SETS,
  models: new Map(),
  pilotIds: new Set(),
  loading: false,
  error: null,
  wired: true,
  setOf: () => 'default',
  modelOf: () => DEFAULT_BKT_MODEL,
  refresh: async () => {},
  setPilot: async () => {},
  apply: async () => {
    throw new Error('not in this test');
  },
  ...over,
});

provideAdminDependencies({
  live: { watchTable: (on: (t: null) => void) => (on(null), () => {}), watchUpdates: (_: number, on: (r: []) => void) => (on([]), () => {}) },
  logs: {
    eventsOf: async () => [
      { seq: 1, at: Date.UTC(2026, 10, 13, 1), type: 'ui_action', payload: { action: 'signed_in' } },
      { seq: 2, at: Date.UTC(2026, 10, 13, 2), type: 'page_viewed', payload: { path: '/play' } },
      { seq: 3, at: Date.UTC(2026, 10, 13, 3), type: 'ui_action', payload: { action: 'signed_out', from: 'header' } },
    ],
  },
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
  bkt: bkt(),
  users: [],
  codes: new Map(),
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
    await mount(<EvaluationSection course={course({ bkt: bkt({ pilotIds: new Set(['u1']) }) })} logs={logs({ data: { bktUpdates, qUpdates: [], loadedAt: 1 } })} />);
    await pressTab('BKT: calibration');
    expect(text()).toContain('BKT values for new players: Default values');
    expect(text()).toContain('1 player(s) marked pilot');
    expect(text()).toContain('No calibration applied yet');
    expect(text()).not.toContain('Starting value per competency');
    await clickLabel('Run the calibration');
    expect(text()).toContain('Not enough data yet');
    expect(text()).toContain('Starting value per competency');
    expect(text()).toContain('too few players');
    expect(text()).toContain('the value in force is kept');
    expect(text()).toContain('Held-out test of per-player T: not enough answers yet');
    expect(text()).toContain('Slip + 0.05');
    expect(text()).toContain('0.250 (not calibrated: 1 of 4)');
    // One marked player: too few to apply.
    expect(text()).toContain('Needs at least 7 players marked pilot');
  });

  it('applies a calibration from 7 marked players after a confirm, and logs it', async () => {
    const pilots = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    let seq = 0;
    const bktUpdates = pilots.flatMap(uid =>
      COMPETENCIES.flatMap(competency =>
        [true, true, false, true, false].map(correct => ({ uid, competency, source: 'diagnostic', predictedCorrect: 0.5, correct, userSeq: ++seq }))
      )
    );
    const applied: { note: string; pilots: number; by: string }[] = [];
    const saved: SavedValueSet[] = [];
    const sets = bkt({
      pilotIds: new Set(pilots),
      apply: async (record, admin) => {
        applied.push({ note: record.note, pilots: record.pilots.length, by: admin.uid });
        const set = { ...record, setId: 'cal-1', number: 1, appliedAt: 1, appliedBy: admin.uid, appliedByEmail: admin.email };
        saved.push(set);
        return set;
      },
    });
    await mount(<EvaluationSection course={course({ bkt: sets })} logs={logs({ data: { bktUpdates, qUpdates: [], loadedAt: 1 } })} />);
    await pressTab('BKT: calibration');
    await clickLabel('Run the calibration');
    expect(text()).toContain('one start per competency');
    const button = [...document.querySelectorAll('button')].find(b => b.textContent === 'Apply as Calibration 1')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(applied).toHaveLength(0);
    await clickLabel('Confirm apply');
    expect(applied).toEqual([{ note: '', pilots: 7, by: 'admin-1' }]);
    expect(text()).toContain('Calibration 1 is saved and is now the set new players get');
    // The result is spent: it cannot be applied a second time.
    expect([...document.querySelectorAll('button')].some(b => b.textContent?.startsWith('Apply as Calibration'))).toBe(false);

    // The log reads the saved set back.
    unmount();
    await mount(<EvaluationSection course={course({ bkt: bkt({ sets: saved, state: { activeSetId: 'cal-1', number: 1, appliedAt: 1, appliedBy: 'admin-1' } }) })} logs={logs()} />);
    await pressTab('BKT: calibration');
    expect(text()).toContain('BKT values for new players: Calibration 1');
    expect(text()).toContain('Calibration 1(new players)');
    expect(text()).toContain('admin@example.com');
  });
});

describe('the players section', () => {
  it('finds an account, shows its value set, and its sign-ins and sign-outs', async () => {
    const users = [
      { id: 'u1', email: 'ana@example.com', username: 'Ana', createdAt: 1, totalScore: 0, longestStreak: 0, bestExamScore: 0, termsVersion: '2026-11-13', termsAcceptedAt: 2 },
      { id: 'u2', email: 'ben@example.com', username: 'Ben', createdAt: 3, totalScore: 0, longestStreak: 0, bestExamScore: 0 },
    ];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await mount(
      <QueryClientProvider client={client}>
        <PlayersSection course={course({ users, codes: new Map([['u1', 'P-0001']]), bkt: bkt({ pilotIds: new Set(['u1']) }) })} />
      </QueryClientProvider>
    );
    expect(text()).toContain('2 account(s)');
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Search players"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'p-0001');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const row = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('ana@example.com'))!;
    expect([...document.querySelectorAll('button')].some(b => b.textContent?.includes('ben@example.com'))).toBe(false);
    await act(async () => row.click());
    await flush();
    expect(text()).toContain('version 2026-11-13');
    expect(text()).toContain('Default values');
    expect(text()).toContain('marked: feeds the next calibration');
    expect(text()).toContain('Signed in');
    expect(text()).toContain('Signed out');
    expect(text()).not.toContain('Page viewed');
  });
});
