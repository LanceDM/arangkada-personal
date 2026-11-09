// @vitest-environment jsdom
/**
 * The post-test screen: a participant whose
 * pre-test is saved sits the routing block, is routed on its number correct,
 * and sits the routed block, with nothing said about any answer or block. No
 * item of the second block is read before the status names it.
 *
 * The items and the design are placeholders written for this test, not the
 * team's items or a calibration.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizItemDoc } from '@/features/driving-sim';
import { testSittingProblems, type TestSitting } from '@/domain/assessment/testResponse';
import { routeByScore, type Stage2Block, type TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import { provideAssessmentDependencies } from '@/features/assessment/application/dependencies';
import type { DraftAnswer } from '@/domain/assessment/sittingClock';
import { CLOSE_MARGIN_MS } from '@/features/assessment/application/useTestSitting';
import type { PostTestStatusDoc, TestStatusDoc } from '@/features/assessment/domain/testStatus';
import { postTestStageSeconds } from '@/features/assessment/domain/postTestForm';
import { PostTest } from './PostTest';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const BLOCKS = ['routing', 'easy', 'medium', 'hard'] as const;
// The text on screen names no block, so the screens can be checked for one.
const letter = (block: string) => ({ routing: 'R', easy: 'X', medium: 'Y', hard: 'Z' })[block as (typeof BLOCKS)[number]];
const testItem = (block: string, n: number): QuizItemDoc => ({
  schemaVersion: 1,
  id: `PH-${block}-${String(n).padStart(2, '0')}`,
  moduleId: 'lto_level_1',
  question: `Placeholder question ${letter(block)}${n}.`,
  options: [1, 2, 3, 4].map(k => `Choice ${letter(block)}${n}-${k}`),
  correctIndex: n % 4,
  explanation: 'Never shown on the post-test.',
  image: '',
  competency: 'road_signs',
  source: 'Fixture',
  use: 'test',
  isActive: true,
  order: n,
  revision: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'fixture',
});
const bank = BLOCKS.flatMap(block => Array.from({ length: 15 }, (_, i) => testItem(block, i + 1)));
const placeholderDesign: TwoStageDesign = {
  schemaVersion: 1,
  designId: 'placeholder-design',
  calibrationId: 'placeholder-scale',
  routing: bank.filter(i => i.id.includes('-routing-')).map(i => i.id),
  easy: bank.filter(i => i.id.includes('-easy-')).map(i => i.id),
  medium: bank.filter(i => i.id.includes('-medium-')).map(i => i.id),
  hard: bank.filter(i => i.id.includes('-hard-')).map(i => i.id),
  cuts: [6, 11],
};

let container: HTMLDivElement;
let root: Root;
let t: number;
let preStatus: TestStatusDoc | null;
let postStatus: PostTestStatusDoc | null;
let design: TwoStageDesign | null;
/** The answers the fake server holds: what every device reads. */
let serverAnswers: Record<string, DraftAnswer>;
let saved: TestSitting[];
/** Every read and write, in order: what the rules would see. */
let events: string[];

const blockOf = (id: string) => BLOCKS.find(b => id.includes(`-${b}-`))!;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  t = 2_000_000;
  preStatus = { schemaVersion: 1, kind: 'pre', playerCode: 'P-0001', seed: 5, openedAt: 1, startedAt: 1, status: 'finished', finishedAt: 2 };
  postStatus = null;
  design = placeholderDesign;
  serverAnswers = {};
  saved = [];
  events = [];
  provideAssessmentDependencies({
    items: {
      loadTestItems: async () => {
        events.push('list');
        return bank;
      },
      loadItemsById: async ids => {
        events.push(...new Set(ids.map(id => `read ${blockOf(id)}`)));
        return bank.filter(i => ids.includes(i.id));
      },
    },
    designs: { loadPostTestDesign: async () => design },
    sittings: {
      status: async (_uid, kind) => (kind === 'pre' ? preStatus : postStatus),
      postStatus: async () => postStatus,
      open: async (_uid, status) => {
        events.push('open');
        postStatus = { ...status, startedAt: t } as PostTestStatusDoc;
      },
      enterStage2: async (_uid, block) => {
        events.push(`enter ${block}`);
        postStatus = { ...postStatus!, stage: 'stage2', block, stage2At: t };
      },
      startStage2: async () => {
        events.push('start part 2');
        postStatus = { ...postStatus!, stage2StartedAt: t };
        return t;
      },
      finish: async (_uid, sitting) => {
        events.push('finish');
        saved.push(sitting);
        postStatus = { ...postStatus!, status: 'finished', finishedAt: sitting.finishedAt };
      },
    },
    drafts: {
      load: async () => ({ ...serverAnswers }),
      saveAnswer: async (_uid, _kind, itemId, chosen) => {
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

const open = async (who: { uid?: string; participantCode?: string | null; isAdmin?: boolean } = {}) => {
  act(() =>
    root.render(
      <PostTest
        uid={who.uid ?? 'alice'}
        participantCode={who.participantCode === undefined ? 'P-0001' : who.participantCode}
        isAdmin={who.isAdmin ?? false}
        newSeed={() => 777}
        clock={() => t}
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
const shownItem = () => bank.find(i => text().includes(`${i.question}`) && text().includes(i.options[0]))!;
/** Answers the item on screen, right or wrong, and goes on. */
const answer = async (right: boolean, ms = 3_000) => {
  const item = shownItem();
  const wanted = item.options[right ? item.correctIndex : (item.correctIndex + 1) % 4];
  t += ms;
  act(() => choices().find(c => c.lastElementChild?.textContent === wanted)!.click());
  await click(button('Finish') ? 'Finish' : 'Next');
};

/** Nothing on any screen during the test may say how an answer went, or where it was routed. */
const NO_FEEDBACK = /correct|wrong|score|tama|mali|passed|failed|easy|medium|hard/i;

const sitRouting = async (rightAnswers: number) => {
  for (let i = 0; i < 15; i++) {
    expect(text()).toContain(`Part 1 of 2 · Question ${i + 1} of 15`);
    expect(text()).not.toMatch(NO_FEEDBACK);
    await answer(i < rightAnswers);
  }
};

describe('the post-test screen', () => {
  // Each side of each cut point: [6, 11] sends 5 to easy, 6 and 10 to medium, 11 to hard.
  it.each([
    [0, 'easy'], [5, 'easy'], [6, 'medium'], [10, 'medium'], [11, 'hard'], [15, 'hard'],
  ] as [number, Stage2Block][])('routes %i right on the routing block to %s, and saves a sitting its design accepts', async (right, block) => {
    await open();
    await click('Start the post-test');
    expect(postStatus).toMatchObject({ kind: 'post', designId: 'placeholder-design', stage: 'routing', block: null, seed: 777 });
    await sitRouting(right);

    // Between the parts: the status names the block, nothing names it on screen.
    expect(text()).toContain('Part 1 is done');
    expect(text()).not.toMatch(NO_FEEDBACK);
    expect(postStatus).toMatchObject({ stage: 'stage2', block });
    expect(block).toBe(routeByScore(right, placeholderDesign.cuts));
    // No item of the second part was read before the status named its block.
    expect(events).toEqual(['open', 'read routing', `enter ${block}`, `read ${block}`]);

    await click('Start part 2');
    for (let i = 0; i < 15; i++) {
      expect(text()).toContain(`Part 2 of 2 · Question ${i + 1} of 15`);
      expect(text()).not.toMatch(NO_FEEDBACK);
      expect(blockOf(shownItem().id)).toBe(block);
      await answer(i % 2 === 0);
    }
    expect(text()).toContain('Your answers are saved');
    expect(saved).toHaveLength(1);
    const [sitting] = saved;
    expect(testSittingProblems(sitting, placeholderDesign)).toEqual([]);
    expect(sitting).toMatchObject({ kind: 'post', playerCode: 'P-0001', sittingId: 'P-0001-post', seed: 777, designId: 'placeholder-design' });
    expect(sitting.routing).toEqual({ score: right, cuts: [6, 11], block });
    expect(sitting.closedBy).toBe('participant');
    // Each part is timed from its own start, by the server's times.
    expect(sitting.responses.every(r => r.timeMs === 3_000)).toBe(true);
  });

  it('closes the routing block when its clock runs out, counting the items not reached as wrong', async () => {
    await open();
    await click('Start the post-test');
    await answer(true);
    await answer(true);
    t = 2_000_000 + postTestStageSeconds(15) * 1000 + CLOSE_MARGIN_MS;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(text()).toContain('Part 1 is done');
    expect(postStatus).toMatchObject({ stage: 'stage2', block: 'easy' });

    // Part 2 has its own clock, from when it starts.
    t += 60_000;
    await click('Start part 2');
    expect(text()).toContain(`${postTestStageSeconds(15) / 60}:00`);
    for (let i = 0; i < 15; i++) await answer(true);
    const routing = saved[0].responses.filter(r => r.stage === 'routing');
    expect(routing.filter(r => r.chosen === null)).toHaveLength(13);
    expect(saved[0].routing).toEqual({ score: 2, cuts: [6, 11], block: 'easy' });
    expect(testSittingProblems(saved[0], placeholderDesign)).toEqual([]);
  });

  it('comes back to the second part where it was after a reload', async () => {
    await open();
    await click('Start the post-test');
    await sitRouting(8);
    await click('Start part 2');
    await answer(true);
    const second = shownItem().id;
    act(() => root.unmount());
    root = createRoot(container);

    await open();
    await click('Continue the post-test');
    expect(text()).toContain('Part 2 of 2 · Question 2 of 15');
    expect(shownItem().id).toBe(second);
    expect(events.filter(e => e.startsWith('enter'))).toEqual(['enter medium']);
  });

  it('opens only after the pre-test is saved, and only on a published design', async () => {
    preStatus = { ...preStatus!, status: 'open', finishedAt: null };
    await open();
    expect(text()).toContain('opens after your pre-test is saved');
    expect(button('Start')).toBeUndefined();

    act(() => root.unmount());
    root = createRoot(container);
    preStatus = { ...preStatus!, status: 'finished', finishedAt: 2 };
    design = null;
    await open();
    expect(text()).toContain('once the researchers have prepared it');
    expect(button('Start')).toBeUndefined();

    act(() => root.unmount());
    root = createRoot(container);
    design = { ...placeholderDesign, cuts: [0, 11] };
    await open();
    expect(text()).toContain('once the researchers have prepared it');
    expect(events).toEqual([]);
  });

  it('opens no part whose items the bank does not all hold', async () => {
    design = { ...placeholderDesign, routing: [...placeholderDesign.routing.slice(1), 'PH-missing-01'] };
    await open();
    await click('Start the post-test');
    expect(text()).toContain("isn't ready yet");
    expect(choices()).toHaveLength(0);
  });

  it('carries both parts across devices: the routing answers, the routed block and part 2’s clock', async () => {
    await open();
    await click('Start the post-test');
    await sitRouting(15);
    act(() => root.unmount());
    root = createRoot(container);

    // Another device, between the parts: nothing has started part 2's clock.
    t += 60 * 60 * 1000;
    await open();
    await click('Continue the post-test');
    expect(text()).toContain('Part 1 is done');
    await click('Start part 2');
    expect(container.querySelector('[role="timer"]')?.textContent).toContain('15:00');
    await answer(true);
    act(() => root.unmount());
    root = createRoot(container);

    // A third, with part 2 under way: its clock kept running.
    t += 60_000;
    await open();
    await click('Continue the post-test');
    expect(text()).toContain('Part 2 of 2 · Question 2 of 15');
    expect(container.querySelector('[role="timer"]')?.textContent).toContain('13:57');
    expect(events.filter(e => e.startsWith('enter'))).toEqual(['enter hard']);
    expect(events.filter(e => e === 'start part 2')).toHaveLength(1);
    for (let i = 1; i < 15; i++) await answer(true);
    expect(saved[0].routing).toEqual({ score: 15, cuts: [6, 11], block: 'hard' });
    expect(testSittingProblems(saved[0], placeholderDesign)).toEqual([]);
  });

  it('closes part 1 and offers part 2 when a participant returns after part 1’s clock ran out', async () => {
    await open();
    await click('Start the post-test');
    await answer(true);
    await answer(true);
    act(() => root.unmount());
    root = createRoot(container);
    t += 24 * 60 * 60 * 1000;
    await open();
    await click('Continue the post-test');
    expect(text()).toContain('Part 1 is done');
    expect(postStatus).toMatchObject({ stage: 'stage2', block: 'easy' });
    expect(saved).toHaveLength(0);
  });

  it('lets an admin preview both parts, writing nothing', async () => {
    await open({ uid: 'dev', participantCode: null, isAdmin: true });
    expect(text()).toContain('Preview: nothing is saved');
    await click('Start the post-test');
    await sitRouting(15);
    await click('Start part 2');
    for (let i = 0; i < 15; i++) await answer(false);
    expect(text()).toContain('Preview: nothing is saved');
    expect(events).toEqual(['read routing', 'read hard']);
    expect(saved).toHaveLength(0);
    expect(serverAnswers).toEqual({});
  });

  it('is for participants only', async () => {
    for (const participantCode of ['P01', null]) {
      act(() => root.unmount());
      root = createRoot(container);
      await open({ participantCode });
      expect(text()).toContain("for the study's participants");
      expect(button('Start')).toBeUndefined();
    }
  });
});
