/**
 * The two routing sections' test harness: a pool of three accounts whose
 * records were written by walking the real routing FSM, served by an
 * in-memory records repository, and a renderer that mounts a section in
 * Strict Mode inside a router. For tests only.
 */
import { StrictMode, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { AttemptDocument, AttemptRecordDocuments, PilotRecordsRepository, PoolAccountEntry } from '@/features/admin/application/pilotPorts';
import { designatedRoutingPolicyOf } from '@/features/admin/domain/designatedRoutingPolicy';
import { playCourse, type FixtureEntry } from '@/features/admin/domain/routingRecords.fixture';
import results from '@/features/admin/domain/designatedRoutingTable.json';
import type { StoredAttempt } from '@/features/driving-sim';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export const T0 = Date.UTC(2026, 9, 1, 1, 0, 0);
export const designated = designatedRoutingPolicyOf(results);

/** A failed tutorial and its retry, practice offered, a review offered, a free replay and the post-test. */
export const COURSE: FixtureEntry[] = [
  { outcome: 'failed' },
  { outcome: 'passed' },
  { outcome: 'passed', probe: 'open' },
  { outcome: 'failed', probe: 'open' },
  { outcome: 'passed', probe: 'open' },
  { outcome: 'passed', probe: 'gap' },
  { outside: 'free-replay', outcome: 'passed' },
  { outcome: 'passed' },
  { outside: 'post-test', outcome: 'failed' },
];

const course = (group: 'conventional' | 'optimized', idPrefix: string, t0: number) =>
  playCourse({ group, entries: COURSE, table: designated.table, tableId: designated.tableId, budgetSize: designated.budgetSize, idPrefix, t0 });

export const POOL: Array<PoolAccountEntry & { group: 'conventional' | 'optimized'; attempts: StoredAttempt[] }> = [
  { code: 'P01', cohort: 'study', uid: 'u1', group: 'conventional', attempts: course('conventional', 'c', T0) },
  { code: 'P02', cohort: 'study', uid: 'u2', group: 'optimized', attempts: course('optimized', 'o', T0 + 1000) },
  { code: 'E01B', cohort: 'test', uid: 'u3', group: 'optimized', attempts: course('optimized', 'e', T0 + 2000) },
];

export const reads: string[] = [];

export const repository: PilotRecordsRepository = {
  pool: async () => POOL.map(({ code, cohort, uid }) => ({ code, cohort, uid })),
  routing: async uid => ({
    assignment: { group: POOL.find(entry => entry.uid === uid)!.group, assignedAt: T0 - 86_400_000, method: 'balanced' },
    cursor: null,
  }),
  attemptsFrom: async (uid, from): Promise<AttemptDocument[]> =>
    POOL.find(entry => entry.uid === uid)!
      .attempts.filter(stored => from === null || stored.attempt.timestamp >= from)
      .map(stored => ({ id: stored.id, savedAt: stored.attempt.timestamp, data: stored.attempt })),
  attemptRecords: async (uid, id): Promise<AttemptRecordDocuments> => {
    reads.push(`${uid}/${id}`);
    const stored = POOL.find(entry => entry.uid === uid)!.attempts.find(attempt => attempt.id === id)!;
    return { fsm: { transitions: [], truncated: false, totalCount: 0 }, decisions: null, routing: stored.routing };
  },
  otherModes: async () => ({ examSittings: [], dailyAnswers: [] }),
  fsmLog: async () => null,
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

export const unmount = () => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
};

export const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
};

export const mount = async (element: ReactNode) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <StrictMode>
        <MemoryRouter>{element}</MemoryRouter>
      </StrictMode>
    )
  );
  await flush();
  return host;
};

export const view = () => host!;
export const text = () => host!.textContent ?? '';

export const click = (selector: string) =>
  act(() => host!.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

export const clickLabel = (label: string) => click(`[aria-label="${label}"]`);

/** Radix tabs switch on a mouse down, not a click. */
export const pressTab = async (label: string) => {
  const tab = [...host!.querySelectorAll<HTMLElement>('[role="tab"]')].find(each => each.textContent === label)!;
  act(() => {
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  await flush();
};

export const choose = async (label: string, value: string) => {
  act(() => {
    const element = host!.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
};
