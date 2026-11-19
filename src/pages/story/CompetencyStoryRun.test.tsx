// @vitest-environment jsdom
/**
 * The course as a participant clicks through it, on in-memory repositories:
 * Continue sends a participant without the initial exam to the main menu's
 * initial exam, and otherwise opens the briefing with the gate's steps. Every
 * action on the way is logged.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { memoryCourseStore, provideInMemoryDrivingSim, type MemoryCourseStore } from '@/features/driving-sim';
import CompetencyStoryRun from './CompetencyStoryRun';
import LevelMapPage from './LevelMapPage';
import BriefingPage from './BriefingPage';
import type { StoryRouting } from './storyRunContext';
import { lessonsRead, startingCourse } from '@/domain/competencyRouting/course';
import { QUESTION_BANK } from '@/domain/assessment/questionBank';
import {
  completeCourseDrive,
  diagnosticItems,
  markCourseLessonsRead,
  openCourseQuiz,
  planCourseDrive,
  saveDiagnostic,
  submitCourseQuiz,
} from '@/features/driving-sim';

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
  openAll: false,
  participant: false,
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
  it('sends Continue to the initial exam on the main menu while it is not taken', async () => {
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
            <Route path="/play/pre-test" element={<p>Pre-test page</p>} />
          </Routes>
        </MemoryRouter>
      );
    });
    await settle();

    expect(host.textContent).toContain('Take the pre-test first.');
    await clickText(host, 'CONTINUE COURSE');
    expect(host.textContent).toContain('Pre-test page');
    expect(store.events.get('participant')!.some(e => e.type === 'ui_action' && e.payload.action === 'continue_blocked')).toBe(true);
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
    // Each answer was logged the moment it was given, before the sitting was saved.
    const given = store.events.get('participant')!.filter(e => e.type === 'answer_given');
    expect(given.map(e => e.payload.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(given.every(e => e.payload.sitting === 'quiz' && e.payload.correct === true)).toBe(true);
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
    // The tutorial has no quiz: its module ends with Finish Reading.
    await clickText(host, 'Finish Reading');
    expect(store.cursors.get('participant')?.phase).toEqual({ kind: 'DRIVE', level: 0 });
    const actions = store.events.get('participant')!.filter(e => e.type === 'ui_action').map(e => e.payload.action);
    expect(actions).toEqual(expect.arrayContaining(['continue_course', 'module_opened', 'module_finished']));
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

  it('sends a typed briefing URL for a stage the course is not at back to the map', async () => {
    diagnosticDone();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story/5/briefing']}>
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
    expect(host.textContent).toContain('CONTINUE COURSE');
    expect(host.textContent).not.toContain('Mission Briefing');
    await act(async () => root.unmount());
  });

  it('plans the drive on a reloaded drive-phase briefing', async () => {
    store.cursors.set('participant', { ...startingCourse(), phase: { kind: 'DRIVE', level: 0 } });
    diagnosticDone();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/play/story/0/briefing']}>
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
    await settle();
    expect(host.textContent).toContain('road events');
    const drive = [...host.querySelectorAll('button')].find(b => b.textContent?.includes('Drive'));
    expect(drive?.disabled).toBe(false);
    await act(async () => root.unmount());
  });

  // Kyle's two reports from the team's test (2026-11-10): the short quiz step
  // vanished once passed, and after a 1-star drive the repeat drive the map
  // sent the player to was empty, so the next stage could not be reached.
  it('keeps a passed quiz on the briefing, and plans a full repeat drive after a failed competency', async () => {
    const uid = 'participant';
    const items = diagnosticItems();
    await saveDiagnostic(uid, items, items.map(item => item.answer));
    let cursor = await markCourseLessonsRead(uid, { ...startingCourse(), phase: { kind: 'MODULE', level: 1 } });
    const quiz = await openCourseQuiz(uid, cursor);
    cursor = (await submitCourseQuiz(uid, cursor, quiz.items, quiz.items.map(item => item.answer))).cursor;
    expect(cursor.phase).toEqual({ kind: 'DRIVE', level: 1 });
    const run = await planCourseDrive(uid, cursor);
    // Every scenario answered wrong: a 1-star drive, both competencies to repeat.
    const logs = (run.composed?.items ?? []).map((item, i) => ({
      timestamp: 1000 + i, action: 'x', result: 'violation' as const, points: 0, competency: item.competency, scenarioId: item.scenarioId,
    }));
    cursor = (await completeCourseDrive({ uid, cursor, run, result: { levelId: 1, score: 0, stars: 1, completed: true, violations: 6, correctActions: 0, logs } })).cursor;
    expect(cursor.phase).toEqual({ kind: 'REPEAT', level: 1 });

    const { host, root } = await mount();
    await clickText(host, 'CONTINUE COURSE');
    await settle();
    expect(host.textContent).toContain('Repeat drive: Driver Legality, Document Awareness');
    // The quiz step is still there, marked passed.
    const buttons = () => [...host.querySelectorAll('button')];
    expect(buttons().some(b => b.textContent?.startsWith('Short Quiz') && b.textContent.includes('Passed'))).toBe(true);
    // The repeat drive has its scenarios: 3 for each competency still to pass.
    const driveStep = () => buttons().find(b => b.textContent?.startsWith('Driving Simulation'))!;
    expect(driveStep().textContent).toContain('6 scenarios: 3 per competency');
    // A review the fallback rule asks for comes first; read, it opens the drive.
    const review = buttons().find(b => b.textContent?.startsWith('Review:'));
    if (review) {
      expect(driveStep().disabled).toBe(true);
      await clickText(host, 'Review:');
      await clickText(host, 'Finish Reading');
      await settle();
    }
    expect(driveStep().disabled).toBe(false);
    await act(async () => root.unmount());
  });
});
