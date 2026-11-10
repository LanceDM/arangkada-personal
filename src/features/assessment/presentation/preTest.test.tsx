// @vitest-environment jsdom
/**
 * The pre-test screen: a participant opens
 * a sitting, sees all 60 items one at a time with nothing said about any
 * answer, and the whole sitting is saved once. An admin previews and saves
 * nothing; anyone else is told who the test is for.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizItemDoc } from '@/features/driving-sim';
import { testSittingProblems, type TestSitting } from '@/domain/assessment/testResponse';
import { provideAssessmentDependencies } from '@/features/assessment/application/dependencies';
import type { DraftAnswer } from '@/domain/assessment/sittingClock';
import { CLOSE_MARGIN_MS } from '@/features/assessment/application/useTestSitting';
import type { NewTestStatus, TestStatusDoc } from '@/features/assessment/domain/testStatus';
import { PRE_TEST_SECONDS, PRE_TEST_SIZE } from '@/features/assessment/domain/preTestForm';
import { PreTest } from './PreTest';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const testItem = (n: number): QuizItemDoc => ({
  schemaVersion: 1,
  id: `L1-PH-${String(n).padStart(2, '0')}`,
  moduleId: 'lto_level_1',
  question: `Placeholder question ${n}`,
  options: [`Choice ${n}-1`, `Choice ${n}-2`, `Choice ${n}-3`, `Choice ${n}-4`],
  correctIndex: n % 4,
  explanation: 'Never shown on the pre-test.',
  image: '',
  competency: 'road_signs',
  source: 'Fixture',
  use: 'test',
  isActive: true,
  order: n,
  revision: 2,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'fixture',
});

let container: HTMLDivElement;
let root: Root;
let t: number;
let statusDoc: TestStatusDoc | null;
/** The answers the fake server holds: what every device reads. */
let serverAnswers: Record<string, DraftAnswer>;
/** How far this device's clock is from the server's. */
let deviceSkew: number;
let failAnswers: number;
/** A save that never comes back, as Firestore's does offline. */
let answersHang: boolean;
let saved: TestSitting[];
let failSaves: number;
let bank: QuizItemDoc[];
const opened: NewTestStatus[] = [];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  t = 1_000_000;
  statusDoc = null;
  serverAnswers = {};
  deviceSkew = 0;
  failAnswers = 0;
  answersHang = false;
  saved = [];
  failSaves = 0;
  opened.length = 0;
  bank = Array.from({ length: PRE_TEST_SIZE }, (_, i) => testItem(i + 1));
  provideAssessmentDependencies({
    items: { loadTestItems: async () => bank, loadItemsById: async () => [] },
    designs: { loadPostTestDesign: async () => null },
    sittings: {
      status: async () => statusDoc,
      postStatus: async () => null,
      enterStage2: async () => {},
      startStage2: async () => t,
      open: async (_uid, status) => {
        opened.push(status);
        statusDoc = { ...status, startedAt: t };
      },
      finish: async (_uid, sitting) => {
        if (failSaves > 0) {
          failSaves -= 1;
          throw new Error('offline');
        }
        saved.push(sitting);
        statusDoc = { ...statusDoc!, status: 'finished', finishedAt: sitting.finishedAt };
      },
    },
    drafts: {
      load: async () => ({ ...serverAnswers }),
      saveAnswer: async (_uid, _kind, itemId, chosen) => {
        if (answersHang) await new Promise(() => {});
        if (failAnswers > 0) {
          failAnswers -= 1;
          throw new Error('offline');
        }
        // Forward only, as the rules hold it.
        if (serverAnswers[itemId]) throw new Error('permission-denied');
        serverAnswers[itemId] = { chosen, at: t };
      },
      serverTime: async () => t,
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const settle = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0);
});

const open = async (who: { uid?: string | null; participantCode?: string | null; isAdmin?: boolean } = {}) => {
  act(() =>
    root.render(
      <PreTest
        uid={who.uid === undefined ? 'alice' : who.uid}
        participantCode={who.participantCode === undefined ? 'P-0001' : who.participantCode}
        isAdmin={who.isAdmin ?? false}
        newSeed={() => 424_242}
        clock={() => t + deviceSkew}
        onLeave={() => {}}
      />
    )
  );
  await settle();
};

const text = () => container.textContent ?? '';
const button = (label: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.includes(label));
const click = async (label: string) => {
  const target = button(label);
  if (!target) throw new Error(`no button "${label}" in: ${text()}`);
  act(() => target.click());
  await settle();
};
const choices = () => [...container.querySelectorAll('button[aria-pressed]')] as HTMLButtonElement[];
/** Picks the shown choice at `place` and goes on, `ms` after the item appeared. */
const answer = async (place: number, ms = 5_000) => {
  t += ms;
  act(() => choices()[place].click());
  await click(button('Finish') ? 'Finish' : 'Next');
};

/** Nothing on any screen may say how an answer went. */
const NO_FEEDBACK = /correct|wrong|right|score|tama|mali|passed|failed/i;

describe('the pre-test screen', () => {
  it('saves a whole sitting and never says how an answer went', async () => {
    await open();
    expect(text()).toContain('60 questions');
    await click('Start the pre-test');
    expect(opened).toEqual([
      { schemaVersion: 1, kind: 'pre', playerCode: 'P-0001', seed: 424_242, openedAt: 1_000_000, status: 'open', finishedAt: null },
    ]);

    const shown: string[][] = [];
    for (let i = 0; i < PRE_TEST_SIZE; i++) {
      expect(text()).toContain(`Question ${i + 1} of 60`);
      expect(text()).not.toMatch(NO_FEEDBACK);
      shown.push(choices().map(c => c.lastElementChild?.textContent ?? ''));
      // Next waits for a choice.
      expect(button(i === PRE_TEST_SIZE - 1 ? 'Finish' : 'Next')!.disabled).toBe(true);
      await answer(i % 4, 4_000 + i);
    }
    expect(text()).toContain('Your answers are saved');
    expect(text()).not.toMatch(NO_FEEDBACK);

    expect(saved).toHaveLength(1);
    const [sitting] = saved;
    expect(testSittingProblems(sitting)).toEqual([]);
    expect(sitting).toMatchObject({ playerCode: 'P-0001', sittingId: 'P-0001-pre', kind: 'pre', seed: 424_242 });
    expect(sitting.responses).toHaveLength(PRE_TEST_SIZE);
    expect(new Set(sitting.responses.map(r => r.itemId)).size).toBe(PRE_TEST_SIZE);
    sitting.responses.forEach((r, i) => {
      // What was picked is the stored choice shown at that place, and the
      // record's choice order is the order shown.
      const item = bank.find(b => b.id === r.itemId)!;
      expect(shown[i]).toEqual(r.choiceOrder.map(index => item.options[index]));
      expect(r.chosen).toBe(r.choiceOrder[i % 4]);
      expect(r.correct).toBe(r.chosen === item.correctIndex);
      expect(r).toMatchObject({ position: i + 1, revision: 2, competency: 'road_signs', timeMs: 4_000 + i });
    });
    expect(sitting.closedBy).toBe('participant');
    expect(sitting.startedAt).toBe(1_000_000);
  });

  it('comes back to the same item and clock on any device, then counts the rest unanswered when time is up', async () => {
    await open();
    await click('Start the pre-test');
    await answer(0);
    await answer(1);
    const third = text();
    act(() => root.unmount());
    root = createRoot(container);

    // Signed in again, with nothing kept on this device: only the server knows.
    t += 60_000;
    await open();
    await click('Continue the pre-test');
    expect(text()).toContain('Question 3 of 60');
    expect(text().match(/Placeholder question \d+/)![0]).toBe(third.match(/Placeholder question \d+/)![0]);
    expect(opened).toHaveLength(1);
    const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    expect(text()).toContain(clockText(PRE_TEST_SECONDS - 70));

    // Picked but not confirmed when the clock runs out: only what the server has counts.
    act(() => choices()[2].click());
    t = 1_000_000 + PRE_TEST_SECONDS * 1000 + CLOSE_MARGIN_MS;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(text()).toContain('Your answers are saved');
    const responses = saved[0].responses;
    expect(responses.filter(r => r.chosen !== null)).toHaveLength(2);
    expect(responses.slice(2).every(r => r.chosen === null && !r.correct && r.timeMs === 0)).toBe(true);
    expect(saved[0]).toMatchObject({ closedBy: 'deadline', finishedAt: 1_000_000 + PRE_TEST_SECONDS * 1000 });
    expect(testSittingProblems(saved[0])).toEqual([]);
  });

  it('closes at its deadline a sitting left and returned to long after', async () => {
    await open();
    await click('Start the pre-test');
    await answer(0, 4_000);
    act(() => root.unmount());
    root = createRoot(container);
    t += 3 * 24 * 60 * 60 * 1000;
    await open();
    await click('Continue the pre-test');
    expect(text()).toContain('Your answers are saved');
    expect(saved[0]).toMatchObject({ closedBy: 'deadline', finishedAt: 1_000_000 + PRE_TEST_SECONDS * 1000 });
    expect(saved[0].responses.filter(r => r.chosen !== null).map(r => r.timeMs)).toEqual([4_000]);
    expect(saved[0].responses).toHaveLength(PRE_TEST_SIZE);
  });

  it('counts down by the server, whatever the device’s clock says', async () => {
    deviceSkew = 5 * 60 * 60 * 1000;
    await open();
    await click('Start the pre-test');
    expect(container.querySelector('[role="timer"]')?.textContent).toContain('60:00');
    t += 60_000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(container.querySelector('[role="timer"]')?.textContent).toContain('59:00');
    expect(saved).toHaveLength(0);
  });

  it('holds the next item until the server has the answer, and says so when it cannot', async () => {
    await open();
    await click('Start the pre-test');
    failAnswers = 1;
    const shown = text().match(/Placeholder question \d+/)![0];
    act(() => choices()[0].click());
    await click('Next');
    expect(text()).toContain('Not saved yet');
    expect(text()).toContain(shown);
    expect(text()).toContain('Question 1 of 60');
    expect(Object.keys(serverAnswers)).toHaveLength(0);
    await click('Next');
    expect(text()).not.toContain('Not saved yet');
    expect(text()).toContain('Question 2 of 60');
    expect(Object.keys(serverAnswers)).toHaveLength(1);
  });

  it('says so when a save never comes back, as one does offline', async () => {
    await open();
    await click('Start the pre-test');
    answersHang = true;
    act(() => choices()[0].click());
    await click('Next');
    expect(text()).toContain('Question 1 of 60');
    expect(text()).not.toContain('Not saved yet');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(text()).toContain('Not saved yet');
  });

  it('moves on when another device already answered the item', async () => {
    await open();
    await click('Start the pre-test');
    const firstId = bank.find(item => text().includes(item.question))!.id;
    serverAnswers[firstId] = { chosen: 1, at: t };
    act(() => choices()[0].click());
    await click('Next');
    expect(text()).toContain('Question 2 of 60');
    expect(serverAnswers[firstId].chosen).toBe(1);
  });

  it('keeps the answers and tries again when the save fails', async () => {
    bank = bank.slice(0, PRE_TEST_SIZE);
    await open();
    await click('Start the pre-test');
    failSaves = 1;
    for (let i = 0; i < PRE_TEST_SIZE; i++) await answer(0, 1_000);
    expect(text()).toContain("couldn't be saved");
    expect(saved).toHaveLength(0);
    expect(Object.keys(serverAnswers)).toHaveLength(PRE_TEST_SIZE);
    await click('Try again');
    expect(saved).toHaveLength(1);
    expect(text()).toContain('Your answers are saved');
  });

  it('opens no sitting when the bank does not hold exactly 60 test items', async () => {
    bank = bank.slice(1);
    await open();
    await click('Start the pre-test');
    expect(text()).toContain("isn't ready");
    expect(choices()).toHaveLength(0);
  });

  it('shows a finished pre-test as done, and never again', async () => {
    statusDoc = { schemaVersion: 1, kind: 'pre', playerCode: 'P-0001', seed: 1, openedAt: 1, startedAt: 1, status: 'finished', finishedAt: 2 };
    await open();
    expect(text()).toContain('Your answers are saved');
    expect(button('Start')).toBeUndefined();
  });

  it('lets an admin preview the form, writing nothing', async () => {
    bank = bank.slice(0, 3);
    await open({ uid: 'dev', participantCode: null, isAdmin: true });
    expect(text()).toContain('Preview: nothing is saved');
    await click('Start the pre-test');
    await answer(0);
    await answer(0);
    await answer(0);
    expect(text()).toContain('3 test items are switched on');
    expect(opened).toHaveLength(0);
    expect(saved).toHaveLength(0);
    expect(serverAnswers).toEqual({});
  });

  it('is for participants only', async () => {
    for (const who of [{ participantCode: 'P01' }, { participantCode: null }, { uid: null, participantCode: null }]) {
      await open(who);
      expect(text()).toContain("for the study's participants");
      expect(button('Start')).toBeUndefined();
    }
  });
});
