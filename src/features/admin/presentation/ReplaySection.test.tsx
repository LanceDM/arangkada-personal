// @vitest-environment jsdom
/**
 * Replay on screen, driven by its own hook over in-memory repositories, in
 * Strict Mode: choosing an account and an attempt, the timeline's folded runs
 * and its stepping, the diagram's path, the decisions and the routing record,
 * and the whole FSM log read once per opening and never kept. Then the Players
 * tab: every signed-in account outside the pool, and an attempt's records read
 * when it is opened.
 */
import { StrictMode, act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { FSMState, TransitionLogEntry } from '@/features/driving-sim';
import type { AttemptDocument, AttemptRecordDocuments, PilotRecordsRepository, PoolAccountEntry } from '@/features/admin/application/pilotPorts';
import { provideAdminDependencies, type AdminDependencies } from '@/features/admin/application/dependencies';
import { useAttemptReplay, type ReplaySelection } from '@/features/admin/application/useAttemptReplay';
import type { UserRow } from '@/features/admin/domain/adminReport';
import { ReplaySection } from './ReplaySection';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const T0 = Date.UTC(2026, 9, 17, 1, 0, 0);

const entry = (from: FSMState, to: FSMState, trigger: string, at: number): TransitionLogEntry => ({
  from,
  to,
  trigger,
  timestamp: T0 + at,
  snapshot: { gameplay: to, competency: 'pedestrians' },
  params: { approachScale: 1, reactionScale: 1 },
});

/** Level 1: brake held, a hazard read and answered, the level's end. */
const LOG_A2: TransitionLogEntry[] = [
  entry('IDLE', 'DRIVING', 'start', 0),
  entry('DRIVING', 'DRIVING', 'brake', 16),
  entry('DRIVING', 'DRIVING', 'brake', 32),
  entry('DRIVING', 'DRIVING', 'brake', 48),
  entry('DRIVING', 'APPROACHING_EVENT', 'scenario_trigger', 2000),
  entry('APPROACHING_EVENT', 'APPROACHING_EVENT', 'briefing_dismissed', 4000),
  entry('APPROACHING_EVENT', 'REACTION_WINDOW', 'scenario_trigger', 4500),
  entry('REACTION_WINDOW', 'HAZARD', 'obstacle_ahead', 4500),
  entry('HAZARD', 'HAZARD', 'answer_correct', 4600),
  entry('HAZARD', 'DRIVING', 'road_clear', 5000),
  entry('DRIVING', 'COMPLETED', 'level_end', 9000),
];
const LOG_A1: TransitionLogEntry[] = [entry('IDLE', 'DRIVING', 'start', -600_000), entry('DRIVING', 'COMPLETED', 'level_end', -590_000)];

const log = (at: number): ActionLog => ({ timestamp: T0 + at, action: 'brake', result: 'correct', points: 10, competency: 'pedestrians' });

const records = (fsm: TransitionLogEntry[], levelId: number, at: number, extra: Record<string, unknown>): AttemptRecordDocuments => ({
  fsm: { transitions: fsm, truncated: false, totalCount: fsm.length },
  decisions: {
    schemaVersion: 1,
    levelId,
    attemptSeed: 31,
    route: ['level1.0.a', 'level0.2.a'],
    bkt: {},
    policy: { source: 'routing', requested: { support: null, approachScale: null }, applied: { support: 'full', approachScale: 1 } },
    rerolls: [],
    decisions: [
      {
        logIndex: 0, timestamp: T0 + at, scenarioId: `level${levelId}.0.a`, kind: 'road', settlement: 'response', competency: 'pedestrians',
        result: 'correct', points: 10, remediation: false, support: 'full',
        theta: { requested: 1, effective: 1, baselineLead: 400, lead: 400, room: null, floor: 120 },
        reaction: { ms: 640 }, bktBefore: 0.3, bktAfter: 0.52,
      },
    ],
    truncated: false,
    totalCount: 1,
  },
  routing: {
    schemaVersion: 1, mode: 'new', assignedGroup: 'optimized', groupInEffect: 'optimized', override: false, options: {},
    driving: { support: 'full', approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
    play: null, log: [], truncated: false, totalCount: 0,
    entry: {
      kind: 'course', levelId, gradedDecisions: 1, outcome: 'passed', route: ['level1.0.a'],
      cursorBefore: { state: `DRIVE(${levelId})`, outcome: null, seq: 0, decisionsSpent: 0 },
      cursorAfter: { state: `DRIVE(${levelId + 1})`, outcome: 'passed', seq: 1, decisionsSpent: 1 },
      starts: 1, move: 'advance', legal: ['advance'], destination: levelId, item: null, review: null, decidedIn: 'optimized', observation: null,
      ...extra,
    },
  },
});

const POOL: PoolAccountEntry[] = [
  { code: 'P02', cohort: 'study', uid: 'u2' },
  { code: 'P01', cohort: 'study', uid: 'u1' },
];
const ATTEMPTS: Record<string, AttemptDocument[]> = {
  u1: [
    { id: 'a1', savedAt: T0 - 580_000, data: { levelId: 0, timestamp: T0 - 580_000, finalScore: 87, violations: 0, correctDecisions: 1, logs: [log(-595_000)] } },
    { id: 'a2', savedAt: T0 + 10_000, data: { levelId: 1, timestamp: T0 + 10_000, finalScore: 87, violations: 0, correctDecisions: 1, logs: [log(4600)] } },
  ],
  u2: [],
  // A player outside the pool: one free replay of Level 1.
  u9: [{ id: 'p1', savedAt: T0 + 20_000, data: { levelId: 1, timestamp: T0 + 20_000, finalScore: 87, violations: 0, correctDecisions: 1, logs: [log(4600)] } }],
  u7: [],
};
const RECORDS: Record<string, AttemptRecordDocuments> = {
  a1: records(LOG_A1, 0, -595_000, {}),
  a2: records(LOG_A2, 1, 4600, {
    move: 'advance+practice(pedestrians)',
    legal: ['advance', 'advance+practice(pedestrians)'],
    item: { competency: 'pedestrians', scenarioId: 'level0.2.a', sourceLevelId: 0 },
  }),
  p1: records(LOG_A2, 1, 4600, { kind: 'free-replay', move: null, legal: [], cursorBefore: null, cursorAfter: null, starts: null }),
};

const user = (id: string, username: string, email: string): UserRow => ({
  id, username, email, createdAt: T0, totalScore: 0, longestStreak: 0, bestExamScore: 0,
});
/** Every profile: the two pool accounts, and three players outside the pool. */
const USERS: UserRow[] = [
  user('u1', 'P01', ''),
  user('u2', 'P02', ''),
  user('u7', 'zoe', 'zoe@example.test'),
  user('u9', 'Ana', 'ana@example.test'),
  user('u8', '', 'kim@example.test'),
];

const fsmReads: string[] = [];
const recordReads: string[] = [];
const repository: PilotRecordsRepository = {
  pool: async () => POOL,
  routing: async () => ({ assignment: null, cursor: null }),
  attemptsFrom: async uid => ATTEMPTS[uid],
  attemptRecords: async (uid, id) => {
    recordReads.push(`${uid}/${id}`);
    return RECORDS[id];
  },
  otherModes: async () => ({ examSittings: [], dailyAnswers: [] }),
  fsmLog: async (uid, id) => {
    fsmReads.push(`${uid}/${id}`);
    return RECORDS[id].fsm;
  },
};

beforeAll(() => {
  provideAdminDependencies({ pilotRecords: repository, report: { users: async () => USERS } } as unknown as AdminDependencies);
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const Harness = ({ initial }: { initial: ReplaySelection }) => {
  const [selection, setSelection] = useState<ReplaySelection>(initial);
  return <ReplaySection replay={useAttemptReplay(true, selection, setSelection)} />;
};

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
};

const NOTHING: ReplaySelection = { view: 'pilot', code: null, player: null, attemptId: null };

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const render = async (initial: ReplaySelection = NOTHING, client = newClient()) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Harness initial={initial} />
        </QueryClientProvider>
      </StrictMode>
    )
  );
  await flush();
  return host;
};

const select = (label: string) => host!.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;

const choose = async (label: string, value: string) => {
  act(() => {
    const element = select(label);
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
};

const click = (label: string) =>
  act(() => host!.querySelector<HTMLElement>(`[aria-label="${label}"]`)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

const text = () => host!.textContent ?? '';

describe('the Replay section', () => {
  it('lists the pool by code, then an account\'s attempts by level, kind and time, with no score', async () => {
    await render();
    expect(text()).toContain('Choose a participant');
    expect([...select('Account').options].map(option => option.textContent)).toEqual([
      'Choose a participant',
      'P01 · study · 2 attempts',
      'P02 · study · 0 attempts',
    ]);

    await choose('Account', 'P01');
    const attempts = [...select('Attempt').options].slice(1).map(option => option.textContent ?? '');
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatch(/^#1 · Level 0 · .+ · Course entry · .+ · 1 decision$/);
    expect(attempts[1]).toMatch(/^#2 · Level 1 /);
    for (const option of attempts) expect(option).not.toMatch(/87|optimized|conventional/i);
    expect(fsmReads).toEqual([]);
  });

  it('opens an attempt: the board lights the road driven so far, and stepping moves it and the decisions', async () => {
    fsmReads.length = 0;
    await render();
    await choose('Account', 'P01');
    await choose('Attempt', 'a2');

    // Read once for the opening, Strict Mode's replay included.
    expect(fsmReads).toEqual(['u1/a2']);
    expect(text()).toContain('STEP 1 / 9');
    expect(text()).toContain('×3');
    expect(text()).toContain('11 transitions in 9 steps');

    const board = host!.querySelector('svg[role="img"]')!;
    const stop = (state: string) => board.querySelector(`[data-state="${state}"]`)!;
    const road = (id: string) => board.querySelector(`[data-road="${id}"]`)!;
    // Step 1: IDLE -> DRIVING, on the road from Idle.
    expect(stop('DRIVING').hasAttribute('data-current')).toBe(true);
    expect(stop('IDLE').hasAttribute('data-reached')).toBe(true);
    expect(stop('HAZARD').hasAttribute('data-reached')).toBe(false);
    expect(road('idle-driving').hasAttribute('data-active')).toBe(true);
    expect(road('driving-approaching').hasAttribute('data-lit')).toBe(false);
    // The decision comes later than the first step.
    expect(host!.querySelectorAll('tr[data-later]')).toHaveLength(1);

    // Step 2: the held brake, a self-loop counted on its stop, no road driven.
    click('Next step');
    expect(text()).toContain('STEP 2 / 9');
    expect(stop('DRIVING').querySelector('[data-badge="↺3"]')).not.toBeNull();
    expect(board.querySelectorAll('[data-active]')).toHaveLength(0);
    expect(text()).toContain('Stayed in this state');

    // The last step: the road to the finish, every stop driven past lit.
    click('Last step');
    expect(text()).toContain('STEP 9 / 9');
    expect(road('driving-finish').hasAttribute('data-active')).toBe(true);
    expect(stop('COMPLETED').hasAttribute('data-current')).toBe(true);
    expect(stop('HAZARD').hasAttribute('data-reached')).toBe(true);
    expect(stop('INTERSECTION').hasAttribute('data-reached')).toBe(false);
    expect(road('reaction-hazard').hasAttribute('data-lit')).toBe(true);
    expect(host!.querySelectorAll('tr[data-later]')).toHaveLength(0);
    expect(board.querySelector('[data-hop]')).toBeNull();

    // Step 8: HAZARD -> DRIVING on road_clear is off the roads: a hop drawn while it is shown, and counted.
    click('Previous step');
    expect(text()).toContain('STEP 8 / 9');
    expect(board.querySelector('[data-hop]')?.getAttribute('data-hop')).toBe('HAZARD>DRIVING');
    expect(text()).toContain('direct moves 1');

    act(() => host!.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(text()).toContain('STEP 7 / 8');
  });

  it('draws the exact table on request, and stepping never scrolls the page', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    await render();
    await choose('Account', 'P01');
    await choose('Attempt', 'a2');
    const board = host!.querySelector('svg[role="img"]')!;
    expect(board.querySelector('[data-edge]')).toBeNull();

    act(() => host!.querySelector<HTMLElement>('[role="switch"]')!.click());
    expect(host!.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    click('Last step');
    expect(board.querySelector('[data-edge="IDLE>DRIVING"]')!.getAttribute('data-taken')).toBe('1');
    expect(board.querySelector('[data-edge="REACTION_WINDOW>INTERSECTION"]')!.getAttribute('data-taken')).toBe('0');
    // Self-loops are counts on their stops, not lines.
    expect(board.querySelector('[data-edge="DRIVING>DRIVING"]')).toBeNull();

    click('First step');
    for (let i = 0; i < 5; i++) click('Next step');
    expect(text()).toContain('STEP 6 / 9');
    expect(scrolled).not.toHaveBeenCalled();
  });

  it('plays on by itself, one step at a time, and stops at the end', async () => {
    await render();
    await choose('Account', 'P01');
    await choose('Attempt', 'a2');
    vi.useFakeTimers();
    try {
      click('Play');
      expect(host!.querySelector('[aria-label="Pause"]')).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(text()).toContain('STEP 2 / 9');
      for (let i = 0; i < 12; i++) {
        act(() => {
          vi.advanceTimersByTime(800);
        });
      }
      expect(text()).toContain('STEP 9 / 9');
      expect(host!.querySelector('[aria-label="Play"]')).not.toBeNull();

      // Any other control stops it.
      click('Play');
      expect(text()).toContain('STEP 1 / 9');
      act(() => {
        vi.advanceTimersByTime(800);
      });
      click('Next step');
      expect(host!.querySelector('[aria-label="Play"]')).not.toBeNull();
      const at = text().match(/STEP (\d+) \/ 9/)![1];
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(text().match(/STEP (\d+) \/ 9/)![1]).toBe(at);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows every decision and the routing record', async () => {
    await render();
    await choose('Account', 'P01');
    await choose('Attempt', 'a2');
    const table = host!.querySelector('table')!.textContent ?? '';
    expect(table).toContain('level1.0.a');
    expect(table).toContain('Pedestrian Safety');
    expect(table).toContain('road · response');
    expect(table).toContain('Correct');
    expect(table).toContain('640 ms');
    expect(table).toContain('1 → 1');
    expect(table).toContain('30% → 52%');
    expect(text()).toContain('Advance to the next level, with a practice item for Pedestrian Safety');
    expect(text()).toContain('level0.2.a');
    expect(text()).toContain('DRIVE(1)');
    expect(text()).toContain('DRIVE(2)');
  });

  it('reads the log again for each attempt opened, and keeps none between them', async () => {
    fsmReads.length = 0;
    await render();
    await choose('Account', 'P01');
    await choose('Attempt', 'a2');
    click('Previous attempt');
    await flush();
    expect(text()).toContain('Attempt #1');
    click('Next attempt');
    await flush();
    expect(fsmReads).toEqual(['u1/a2', 'u1/a1', 'u1/a2']);
  });

  it('opened from an address with the records already read, reads the log once, Strict Mode replay included', async () => {
    fsmReads.length = 0;
    await render({ ...NOTHING, code: 'P01', attemptId: 'a2' });
    expect(text()).toContain('STEP 1 / 9');
    expect(fsmReads).toEqual(['u1/a2']);
  });
});

describe('the Players tab', () => {
  const tab = (name: string) =>
    act(() =>
      [...host!.querySelectorAll<HTMLElement>('[role="tab"]')]
        .find(element => element.textContent === name)!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    );

  it('lists every signed-in account outside the pool by name, and searches them', async () => {
    await render();
    tab('Players');
    await flush();
    expect(text()).toContain('Choose a player');
    expect([...select('Player').options].map(option => option.textContent)).toEqual([
      'Choose a player (3 of 3)',
      'Ana · ana@example.test',
      'kim@example.test',
      'zoe · zoe@example.test',
    ]);
    act(() => {
      const search = host!.querySelector<HTMLInputElement>('input[aria-label="Search players"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'zo');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect([...select('Player').options].map(option => option.value)).toEqual(['', 'u7']);
  });

  it("lists a player's attempts without a kind, then reads an attempt's records once when it is opened", async () => {
    recordReads.length = 0;
    fsmReads.length = 0;
    await render({ view: 'players', code: null, player: 'u9', attemptId: null });
    const attempts = [...select('Attempt').options].slice(1).map(option => option.textContent ?? '');
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatch(/^#1 · Level 1 · .+ · .+ · 1 decision$/);
    expect(attempts[0]).not.toMatch(/87|Free replay/);
    expect(recordReads).toEqual([]);

    await choose('Attempt', 'p1');
    // Read once for the opening, Strict Mode's replay included; the log came whole with it.
    expect(recordReads).toEqual(['u9/p1']);
    expect(fsmReads).toEqual([]);
    expect(text()).toContain('Attempt #1');
    expect(text()).toContain('Free replay');
    expect(text()).toContain('STEP 1 / 9');
    expect(host!.querySelector('table')!.textContent).toContain('level1.0.a');
    expect(text()).not.toContain('Verdict handed to the routing FSM');
  });

  it('reads an attempt again each time it is opened, and once per opening, Strict Mode replay included', async () => {
    recordReads.length = 0;
    const client = newClient();
    const opened: ReplaySelection = { view: 'players', code: null, player: 'u9', attemptId: 'p1' };
    await render(opened, client);
    expect(text()).toContain('STEP 1 / 9');
    expect(recordReads).toEqual(['u9/p1']);
    await choose('Attempt', '');
    await choose('Attempt', 'p1');
    expect(recordReads).toEqual(['u9/p1', 'u9/p1']);

    // Back to Replay in the same tab: the player's attempts are cached, so the attempt is opened as it mounts.
    act(() => root!.unmount());
    host!.remove();
    await render(opened, client);
    expect(text()).toContain('STEP 1 / 9');
    expect(recordReads).toEqual(['u9/p1', 'u9/p1', 'u9/p1']);
  });

  it('never lists a pool account, and reads no pilot records', async () => {
    recordReads.length = 0;
    await render({ view: 'players', code: null, player: 'u1', attemptId: null });
    expect(select('Player').value).toBe('');
    expect([...select('Player').options].some(option => option.value === 'u1' || option.value === 'u2')).toBe(false);
    expect(recordReads).toEqual([]);
  });
});
