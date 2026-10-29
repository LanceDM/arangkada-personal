// @vitest-environment jsdom
/**
 * The initial exam from the main menu, on in-memory repositories: the
 * background form first when it is asked, then the 55-item diagnostic, every
 * answer logged as it is given, the sitting saved once. The route guard keeps
 * the other modes closed until it is taken.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKGROUND_QUESTIONS, memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '@/features/driving-sim';
import { RequireInitialExam } from '@/app/initialExam/RequireInitialExam';
import InitialExamPage from './InitialExamPage';

vi.mock('@/features/auth', () => ({
  useAuthSession: () => ({ user: { uid: 'participant' }, profile: null, loading: false, isAdmin: false, isLoggedIn: true }),
  useAuthModal: () => ({ open: () => {} }),
}));
vi.mock('@/app/layout/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let store: MemoryCourseStore;

beforeEach(() => {
  store = memoryCourseStore();
  provideInMemoryDrivingSim(store);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 20)));

const clickText = async (host: HTMLElement, text: string) => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  if (!button) throw new Error(`no button "${text}" in: ${host.textContent?.slice(0, 400)}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
};

const mount = async (path: string, routes: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    );
  });
  await settle();
  return { host, root };
};

const examRoutes = (
  <>
    <Route path="/play" element={<p>Main menu</p>} />
    <Route path="/play/initial-exam" element={<InitialExamPage />} />
  </>
);

describe('the initial exam', () => {
  it('is sat from its own page: every answer logged as given, the sitting saved once', async () => {
    const { host, root } = await mount('/play/initial-exam', examRoutes);
    // The background form is muted by default: straight to the exam.
    expect(host.textContent).toContain('55 multiple-choice items');
    await clickText(host, 'START');
    for (let i = 0; i < 55; i++) {
      const choice = [...host.querySelectorAll('button')].find(b => b.textContent?.trim().endsWith('A'));
      await act(async () => {
        choice!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }
    await settle();
    const sittings = store.sittings.get('participant')!;
    expect(sittings).toHaveLength(1);
    expect(sittings[0].kind).toBe('diagnostic');
    expect(sittings[0].answers).toHaveLength(55);

    const events = store.events.get('participant')!;
    const given = events.filter(e => e.type === 'answer_given');
    expect(given).toHaveLength(55);
    expect(given.every(e => e.payload.sitting === 'diagnostic' && typeof e.payload.responseMs === 'number')).toBe(true);
    const actions = events.filter(e => e.type === 'ui_action').map(e => e.payload.action);
    expect(actions).toEqual(expect.arrayContaining(['initial_exam_viewed', 'exam_started']));
    expect(store.backgrounds.size).toBe(0);

    await clickText(host, 'Continue');
    expect(host.textContent).toContain('Main menu');
    await act(async () => root.unmount());
  });

  it('shows it as done on a second visit', async () => {
    store.sittings.set('participant', [{ schemaVersion: 1, kind: 'diagnostic', levelId: null, attempt: null, answers: [], timestamp: 1 }]);
    const { host, root } = await mount('/play/initial-exam', examRoutes);
    expect(host.textContent).toContain('Already taken');
    expect(host.textContent).not.toContain('START');
    await act(async () => root.unmount());
  });

  it('asks the background form first when it is turned on, logging every choice', async () => {
    provideInMemoryDrivingSim(store, { backgroundFormEnabled: true });
    const { host, root } = await mount('/play/initial-exam', examRoutes);
    const next = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('NEXT'))!;
    expect(next.disabled).toBe(true);
    for (const question of BACKGROUND_QUESTIONS) {
      const radio = host.querySelector<HTMLInputElement>(`input[name="${question.id}"]`)!;
      await act(async () => {
        radio.click();
      });
    }
    await clickText(host, 'NEXT');
    expect(store.backgrounds.get('participant')?.answers.gaming_frequency).toBe('Never');
    const selected = store.events.get('participant')!.filter(e => e.type === 'ui_action' && e.payload.action === 'background_answer_selected');
    expect(selected).toHaveLength(BACKGROUND_QUESTIONS.length);
    expect(host.textContent).toContain('START');
    await act(async () => root.unmount());
  });
});

describe('the modes behind the initial exam', () => {
  const guarded = (
    <>
      <Route path="/play" element={<p>Main menu</p>} />
      <Route path="/play/story" element={<RequireInitialExam><p>Story Mode</p></RequireInitialExam>} />
    </>
  );

  it('sends a participant without it back to the main menu', async () => {
    vi.stubEnv('DEV', false);
    const { host, root } = await mount('/play/story', guarded);
    expect(host.textContent).toContain('Main menu');
    await act(async () => root.unmount());
  });

  it('opens once it is taken', async () => {
    vi.stubEnv('DEV', false);
    store.sittings.set('participant', [{ schemaVersion: 1, kind: 'diagnostic', levelId: null, attempt: null, answers: [], timestamp: 1 }]);
    const { host, root } = await mount('/play/story', guarded);
    expect(host.textContent).toContain('Story Mode');
    await act(async () => root.unmount());
  });
});
