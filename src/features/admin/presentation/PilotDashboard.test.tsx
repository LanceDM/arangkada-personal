// @vitest-environment jsdom
/**
 * The Participants page: each enrolled participant by code, name
 * and cohort, at their stage of the study, their place, drives and last
 * activity, and never a score; and the invites, created and closed.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PilotSessions } from '@/features/admin/application/usePilotSessions';
import type { StudyInvites } from '@/features/admin/application/useStudyInvites';
import { NO_PROFILE, NO_STEPS, pilotRows, type PilotAccountProgress } from '@/features/admin/domain/pilotProgress';
import { PilotDashboard } from './PilotDashboard';

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

const MIN = 60_000;
const NOW = 1_760_000_000_000;

const accounts: PilotAccountProgress[] = [
  {
    code: 'P-0001', name: 'Juan dela Cruz', cohort: 'study', uid: 'u1', enrolledAt: NOW - 60 * MIN, group: null, withdrawnAt: null,
    profile: {
      username: 'juan_2026', age: 24, consentVersion: 'draft-2026-11-04b', gaming: 'weekly', device: 'phone',
      deviceCheck: { touch: true, medianFps: 58.4, slow: false, width: 844, height: 390 },
    },
    steps: { ...NO_STEPS, consentedAt: NOW - 59 * MIN, backgroundAt: NOW - 58 * MIN, deviceCheckedAt: NOW - 57 * MIN, preTest: 'finished' },
    cursor: { state: { kind: 'DRIVE', level: 3 }, outcome: null, updatedAt: NOW - 2 * MIN },
    attempts: [{ id: 'a', levelId: 0, savedAt: NOW - 40 * MIN }],
  },
  { code: 'P-0002', name: null, profile: NO_PROFILE, cohort: 'study', uid: 'u2', enrolledAt: NOW - 5 * MIN, withdrawnAt: null, steps: NO_STEPS, group: null, cursor: null, attempts: [] },
  {
    code: 'D-0001', name: 'Maria Santos', profile: { ...NO_PROFILE, age: 31 }, cohort: 'dryrun', uid: 'u3', enrolledAt: NOW - 90 * MIN, withdrawnAt: NOW - 80 * MIN,
    steps: { ...NO_STEPS, consentedAt: NOW - 89 * MIN }, group: 'conventional', cursor: null, attempts: [],
  },
];

const sessions = (over: Partial<PilotSessions> = {}): PilotSessions => ({
  rows: pilotRows(accounts),
  loading: false,
  error: null,
  now: NOW,
  ...over,
});

const invites = (over: Partial<StudyInvites> = {}): StudyInvites => ({
  invites: [
    { code: '7K3Q9X2MT4', cohort: 'study', open: true, createdAt: NOW - 100 * MIN, closedAt: null },
    { code: 'ABCDE12345', cohort: 'study', open: false, createdAt: NOW - 900 * MIN, closedAt: NOW - 200 * MIN },
  ],
  loading: false,
  error: null,
  create: vi.fn(async () => 'NEWCODE001'),
  close: vi.fn(async () => {}),
  ...over,
});

const render = (value: PilotSessions, invitesValue: StudyInvites = invites()) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter><PilotDashboard sessions={value} invites={invitesValue} /></MemoryRouter>));
  return host;
};

const button = (view: HTMLElement, label: string) => [...view.querySelectorAll('button')].find(b => b.textContent?.trim() === label);

const rowOf = (view: HTMLElement, code: string) =>
  [...view.querySelectorAll('tr')].find(row => row.querySelector('td')?.textContent === code)!;

describe('PilotDashboard', () => {
  it('lists each cohort apart, with each participant’s progress', () => {
    const view = render(sessions());
    expect(view.textContent).toContain('Study (2)');
    expect(view.textContent).toContain('Dry run (1)');
    expect(view.textContent).toContain('Test (0)');
    expect(view.textContent).toContain('Nobody has joined with a test invite yet.');

    const first = rowOf(view, 'P-0001');
    expect(first.textContent).toContain('Levels 1–11');
    expect(first.textContent).toContain('Level 3');
    expect(first.textContent).toContain('2 min ago');
    expect(first.textContent).toContain('None');

    expect(first.textContent).toContain('Juan dela Cruz');
    expect(rowOf(view, 'P-0002').textContent).toContain('Consent');
    expect(rowOf(view, 'P-0002').textContent).toContain('No consent yet');
    expect(rowOf(view, 'D-0001').textContent).toContain('Withdrawn');
    expect(rowOf(view, 'D-0001').textContent).toContain('Conventional');
  });

  it('shows no score, accuracy or result anywhere, and offers nothing to start or hand over', () => {
    const view = render(sessions());
    const text = view.textContent!.toLowerCase();
    for (const word of ['score', 'accuracy', 'passed', 'failed', 'correct', 'points', '/200', 'nickname', 'hand over']) {
      expect(text).not.toContain(word);
    }
    // Every control on the page is an invite's.
    const labels = [...view.querySelectorAll('button')].map(b => b.textContent?.trim());
    expect(new Set(labels)).toEqual(new Set(['New invite', 'Copy join link', 'Close', 'Details']));
  });

  it("opens a participant's details for the team: username, age, consent, background and device check, still no score", () => {
    const view = render(sessions());
    expect(view.textContent).not.toContain('juan_2026');
    const details = () => [...rowOf(view, 'P-0001').querySelectorAll('button')].find(b => b.textContent === 'Details' || b.textContent === 'Hide')!;
    act(() => details().click());
    expect(details().getAttribute('aria-expanded')).toBe('true');
    const panel = rowOf(view, 'P-0001').nextElementSibling!.textContent!;
    for (const fact of ['juan_2026', 'Age24', 'text draft-2026-11-04b', 'Every week', 'Phone', 'Touch · 58 fps · 844×390', 'Pre-testFinished', 'Post-testNot started']) {
      expect(panel).toContain(fact);
    }
    for (const word of ['score', 'accuracy', 'passed', 'failed', 'correct', 'points', 'email']) {
      expect(panel.toLowerCase()).not.toContain(word);
    }
    act(() => details().click());
    expect(view.textContent).not.toContain('juan_2026');
  });

  it("lists each cohort's invites, creates one, and closes an open one only on a second press", async () => {
    const value = invites();
    const view = render(sessions(), value);
    expect(view.textContent).toContain('7K3Q9-X2MT4');
    expect(view.textContent).toContain('ABCDE-12345');
    expect(view.textContent).toContain('No dry run invite yet.');
    // A closed invite offers nothing.
    expect(view.querySelectorAll('li button')).toHaveLength(2);

    await act(async () => button(view, 'New invite')!.click());
    expect(value.create).toHaveBeenCalledWith('study');

    act(() => button(view, 'Close')!.click());
    expect(value.close).not.toHaveBeenCalled();
    await act(async () => button(view, 'Close it for good')!.click());
    expect(value.close).toHaveBeenCalledWith('7K3Q9X2MT4');
  });

  it('says when the registry cannot be followed', () => {
    expect(render(sessions({ error: 'permission-denied' })).textContent).toContain('Could not follow the participants: permission-denied');
  });
});
