// @vitest-environment jsdom
/**
 * The course as a participant clicks through it, on in-memory repositories:
 * the map's Continue opens the diagnostic first, the diagnostic is saved, and
 * Continue then opens the tutorial's briefing with the gate's steps.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '@/features/driving-sim';
import CompetencyStoryRun from './CompetencyStoryRun';
import LevelMapPage from './LevelMapPage';
import BriefingPage from './BriefingPage';
import { DiagnosticPage } from './AssessmentPage';
import BackgroundFormPage from './BackgroundFormPage';
import { BACKGROUND_QUESTIONS } from '@/features/driving-sim';
import type { StoryRouting } from './storyRunContext';
import { lessonsRead, startingCourse } from '@/domain/competencyRouting/course';
import { QUESTION_BANK } from '@/domain/assessment/questionBank';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let store: MemoryCourseStore;

beforeEach(() => {
  store = memoryCourseStore();
  provideInMemoryDrivingSim(store);
});

const routing: StoryRouting = {
  resolution: { mode: 'new', assignedGroup: null, groupInEffect: 'optimized', override: false },
  canOverride: false,
  override: 'assigned',
  setOverride: () => {},
};

const settle = () => act(async () => new Promise(resolve => setTimeout(resolve, 20)));

const clickText = async (host: HTMLElement, text: string) => {
  const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  if (!button) throw new Error(`no button "${text}" in: ${host.textContent?.slice(0, 400)}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
};

describe('the course in Story Mode', () => {
  it('starts with the diagnostic, then opens the tutorial briefing', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story']}>
          <Routes>
            <Route path="/play/story" element={<CompetencyStoryRun routing={routing} uid="participant" />}>
              <Route index element={<LevelMapPage />} />
              <Route path=":levelId/briefing" element={<BriefingPage />} />
              <Route path="diagnostic" element={<DiagnosticPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    });
    await settle();

    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Diagnostic Test');
    await clickText(host, 'START');
    for (let i = 0; i < 55; i++) {
      const choice = [...host.querySelectorAll('button')].find(b => b.textContent?.trim().endsWith('A'));
      await act(async () => {
        choice!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }
    await settle();
    expect(store.sittings.get('participant')?.[0]?.kind).toBe('diagnostic');
    expect(store.sittings.get('participant')?.[0]?.answers).toHaveLength(55);
    await clickText(host, 'Continue');

    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Learning Module');
    expect(host.textContent).toContain('Driving Simulation');
    // The tutorial has no quiz.
    expect(host.textContent).not.toContain('Short Quiz');
    await act(async () => root.unmount());
  });

  it('gates the Level 1 drive on the bank-drawn quiz, 2 of 3 per competency', async () => {
    store.cursors.set('participant', lessonsRead({ ...startingCourse(), phase: { kind: 'MODULE', level: 1 } }));
    store.sittings.set('participant', [{ schemaVersion: 1, kind: 'diagnostic', levelId: null, attempt: null, answers: [], timestamp: 1 }]);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story']}>
          <Routes>
            <Route path="/play/story" element={<CompetencyStoryRun routing={routing} uid="participant" />}>
              <Route index element={<LevelMapPage />} />
              <Route path=":levelId/briefing" element={<BriefingPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    });
    await settle();
    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Short Quiz');
    expect(host.textContent).toContain('Attempt 1 of 3');
    await clickText(host, 'Short Quiz');
    // Answer every item correctly, by its text.
    for (let i = 0; i < 6; i++) {
      const question = QUESTION_BANK.find(item => host.textContent?.includes(item.question))!;
      const right = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(question.choices[question.answer]));
      await act(async () => {
        right!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await settle();
    }
    expect(host.textContent).toContain('Quiz passed');
    await clickText(host, 'Continue');
    expect(store.cursors.get('participant')?.phase).toEqual({ kind: 'DRIVE', level: 1 });
    // The drive is planned and the Drive step is open.
    expect(host.textContent).toContain('6 scenarios: 3 per competency');
    await act(async () => root.unmount());
  });

  const mount = async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story']}>
          <Routes>
            <Route path="/play/story" element={<CompetencyStoryRun routing={routing} uid="participant" />}>
              <Route index element={<LevelMapPage />} />
              <Route path=":levelId/briefing" element={<BriefingPage />} />
              <Route path="diagnostic" element={<DiagnosticPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    });
    await settle();
    return { host, root };
  };

  const diagnosticDone = () =>
    store.sittings.set('participant', [{ schemaVersion: 1, kind: 'diagnostic', levelId: null, attempt: null, answers: [], timestamp: 1 }]);

  it('reads the tutorial module and opens its drive, with no quiz', async () => {
    diagnosticDone();
    const { host, root } = await mount();
    await clickText(host, 'CONTINUE COURSE');
    await clickText(host, 'Learning Module');
    await clickText(host, 'Proceed to Checkpoint');
    expect(store.cursors.get('participant')?.phase).toEqual({ kind: 'DRIVE', level: 0 });
    expect(host.textContent).toContain('road events');
    await act(async () => root.unmount());
  });

  it('retakes only the failed competency, with new items', async () => {
    store.cursors.set('participant', lessonsRead({ ...startingCourse(), phase: { kind: 'MODULE', level: 1 } }));
    diagnosticDone();
    const { host, root } = await mount();
    await clickText(host, 'CONTINUE COURSE');
    await clickText(host, 'Short Quiz');
    const shown: string[] = [];
    for (let i = 0; i < 6; i++) {
      const question = QUESTION_BANK.find(item => host.textContent?.includes(item.question))!;
      shown.push(question.id);
      // Right for driver legality, wrong for document awareness.
      const choice = question.competency === 'driver_legality' ? question.answer : (question.answer + 1) % 4;
      const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(question.choices[choice]));
      await act(async () => {
        button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await settle();
    }
    expect(host.textContent).toContain('Some competencies to retake');
    await clickText(host, 'Continue');
    expect(host.textContent).toContain('Attempt 2 of 3');
    await clickText(host, 'Short Quiz');
    const retake = QUESTION_BANK.find(item => host.textContent?.includes(item.question))!;
    expect(retake.competency).toBe('document_awareness');
    expect(shown).not.toContain(retake.id);
    await act(async () => root.unmount());
  });

  it('skips the background form while it is muted (the default)', async () => {
    const { host, root } = await mount();
    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Diagnostic Test');
    expect(store.backgrounds.size).toBe(0);
    await act(async () => root.unmount());
  });

  it('asks the background form before the diagnostic when it is turned on', async () => {
    provideInMemoryDrivingSim(store, { backgroundFormEnabled: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story']}>
          <Routes>
            <Route path="/play/story" element={<CompetencyStoryRun routing={routing} uid="participant" />}>
              <Route index element={<LevelMapPage />} />
              <Route path="background" element={<BackgroundFormPage />} />
              <Route path="diagnostic" element={<DiagnosticPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      );
    });
    await settle();

    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('About You');
    const submit = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('SUBMIT'))!;
    expect(submit.disabled).toBe(true);
    for (const question of BACKGROUND_QUESTIONS) {
      const radio = host.querySelector<HTMLInputElement>(`input[name="${question.id}"]`)!;
      await act(async () => {
        radio.click();
      });
    }
    await clickText(host, 'SUBMIT');
    expect(store.backgrounds.get('participant')?.answers.gaming_frequency).toBe('Never');
    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Diagnostic Test');
    await act(async () => root.unmount());
  });
});
