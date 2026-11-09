/**
 * One pre-test sitting: the 60 test
 * items, one stage and one countdown, on the shared sitting (`useTestSitting`).
 */
import { nextAttemptSeed } from '@/features/driving-sim';
import { preTestFromDraft } from '@/domain/assessment/sittingFromDraft';
import { testSittingProblems } from '@/domain/assessment/testResponse';
import {
  PRE_TEST_SECONDS,
  PRE_TEST_SIZE,
  preTestItems,
  presentPreTest,
} from '@/features/assessment/domain/preTestForm';
import type { TestDraft } from '@/features/assessment/domain/testDraft';
import { openTestStatus } from '@/features/assessment/domain/testStatus';
import { assessmentDeps } from './dependencies';
import { testAccess, useTestSitting, type SittingForm, type TestAccess, type TestPhase } from './useTestSitting';

export type PreTestAccess = TestAccess;
export const preTestAccess = testAccess;
export type PreTestPhase = TestPhase;

export interface PreTestInput {
  uid: string | null;
  participantCode: string | null;
  isAdmin: boolean;
  /** Where a new sitting's seed comes from. Taken once, when the status is opened. */
  newSeed?: () => number;
  clock?: () => number;
}

/** The pre-test as the screen runs it; the emulator test kit runs it too (a developers' script). */
export const PRE_TEST_FORM: SittingForm = {
  kind: 'pre',
  stageCount: 1,
  async readStatus(uid) {
    const status = await assessmentDeps().sittings.status(uid, 'pre');
    return { status: status?.status ?? 'none', blocked: null };
  },
  async open(context) {
    const deps = assessmentDeps();
    let seed: number;
    let draft: TestDraft | null = null;
    if (context.access === 'participant') {
      let status = await deps.sittings.status(context.uid!, 'pre');
      if (!status) {
        await deps.sittings.open(context.uid!, openTestStatus('pre', context.participantCode!, context.newSeed(), context.clock()));
        status = await deps.sittings.status(context.uid!, 'pre');
        if (!status) throw new Error('The opened pre-test could not be read.');
      }
      seed = status.seed;
      draft = { seed, startedAt: status.startedAt, answers: await deps.drafts.load(context.uid!, 'pre') };
    } else {
      seed = context.newSeed();
    }
    const items = preTestItems(await deps.items.loadTestItems());
    const ready = context.access === 'participant' ? items.length === PRE_TEST_SIZE : items.length > 0;
    if (!ready) return { notReady: 'items', count: items.length };
    return { seed, stages: [{ presented: presentPreTest(items, seed), seconds: PRE_TEST_SECONDS }], count: items.length, draft };
  },
  advance() {
    throw new Error('The pre-test has one stage.');
  },
  startStage2() {
    throw new Error('The pre-test has one stage.');
  },
  record(context, draft, stages, finishedAt, closedBy) {
    return preTestFromDraft({
      playerCode: context.participantCode ?? 'preview',
      seed: draft.seed,
      startedAt: draft.startedAt,
      finishedAt,
      closedBy,
      presented: stages[0].presented,
      answers: draft.answers,
    });
  },
  problems: sitting => testSittingProblems(sitting),
};

export const usePreTest = ({ newSeed = nextAttemptSeed, clock = Date.now, ...who }: PreTestInput) => {
  return useTestSitting(PRE_TEST_FORM, { ...who, newSeed, clock });
};

export type PreTestState = ReturnType<typeof usePreTest>;
