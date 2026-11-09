/**
 * One post-test sitting, on the shared
 * sitting (`useTestSitting`): the frozen design's routing block, then the
 * block its number correct routes to, each with its own countdown.
 *
 * It opens only on a published design the domain finds no problem with, and
 * only after the participant's pre-test is saved. The routing block is
 * routed in the browser by `routeByScore` on the raw score: no IRT runs here.
 * The second block is read only after the status names it, which is what the
 * rules check.
 */
import { useState } from 'react';
import { nextAttemptSeed } from '@/features/driving-sim';
import { postTestFromDraft } from '@/domain/assessment/sittingFromDraft';
import { routingScoreOf, testSittingProblems } from '@/domain/assessment/testResponse';
import { routeByScore, twoStageDesignProblems, type TestBlock, type TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import { blockItems, postTestStageSeconds, presentBlock } from '@/features/assessment/domain/postTestForm';
import type { TestDraft } from '@/features/assessment/domain/testDraft';
import { openPostTestStatus } from '@/features/assessment/domain/testStatus';
import { assessmentDeps } from './dependencies';
import { useTestSitting, type SittingForm, type SittingStage } from './useTestSitting';
import type { PreTestInput } from './usePreTest';

export type PostTestInput = PreTestInput;

const usable = (design: TwoStageDesign | null): TwoStageDesign | null =>
  design && twoStageDesignProblems(design).length === 0 ? design : null;

/** The post-test as the screen runs it; the emulator test kit runs it too (a developers' script). */
export const createPostTestForm = (): SittingForm => {
  // The design this sitting opened on, read again at every Start.
  let design: TwoStageDesign | null = null;

  const loadStage = async (block: TestBlock, seed: number): Promise<{ stage: SittingStage | null; found: number }> => {
    const { items, missing } = blockItems(design!, block, await assessmentDeps().items.loadItemsById(design![block]));
    if (missing.length > 0) return { stage: null, found: items.length };
    const presented = presentBlock(items, seed, block);
    return { stage: { presented, seconds: postTestStageSeconds(presented.length) }, found: items.length };
  };

  return {
    kind: 'post',
    stageCount: 2,
    async readStatus(uid) {
      const deps = assessmentDeps();
      const status = await deps.sittings.postStatus(uid);
      if (status) return { status: status.status, blocked: null };
      const [pre, published] = await Promise.all([deps.sittings.status(uid, 'pre'), deps.designs.loadPostTestDesign()]);
      return { status: 'none', blocked: pre?.status !== 'finished' ? 'pre-test' : !usable(published) ? 'design' : null };
    },
    async open(context) {
      const deps = assessmentDeps();
      design = usable(await deps.designs.loadPostTestDesign());
      if (!design) return { notReady: 'design', count: 0 };
      let seed: number;
      let stage2: TestBlock | null = null;
      let draft: TestDraft | null = null;
      if (context.access === 'participant') {
        let status = await deps.sittings.postStatus(context.uid!);
        if (!status) {
          const pre = await deps.sittings.status(context.uid!, 'pre');
          if (pre?.status !== 'finished') return { notReady: 'pre-test', count: 0 };
          await deps.sittings.open(context.uid!, openPostTestStatus(context.participantCode!, context.newSeed(), context.clock(), design.designId));
          status = await deps.sittings.postStatus(context.uid!);
          if (!status) throw new Error('The opened post-test could not be read.');
        }
        if (status.designId !== design.designId) return { notReady: 'design', count: 0 };
        seed = status.seed;
        if (status.stage === 'stage2') stage2 = status.block;
        draft = {
          seed,
          startedAt: status.startedAt,
          answers: await deps.drafts.load(context.uid!, 'post'),
          ...(status.stage2At !== null ? { routingClosedAt: status.stage2At } : {}),
          ...(status.stage2StartedAt !== null ? { stage2StartedAt: status.stage2StartedAt } : {}),
        };
      } else {
        seed = context.newSeed();
      }
      const routing = await loadStage('routing', seed);
      if (!routing.stage) return { notReady: 'items', count: routing.found };
      const stages = [routing.stage];
      if (stage2) {
        const second = await loadStage(stage2, seed);
        if (!second.stage) return { notReady: 'items', count: second.found };
        stages.push(second.stage);
      }
      return { seed, stages, count: routing.found, draft };
    },
    async advance(context, draft, first) {
      const deps = assessmentDeps();
      // What the server has, wherever it was answered.
      const answers = context.access === 'participant' ? await deps.drafts.load(context.uid!, 'post') : draft.answers;
      const block = routeByScore(routingScoreOf(first.presented, answers), design!.cuts);
      if (context.access === 'participant') {
        // The status names the block before any of its items is read.
        const status = await deps.sittings.postStatus(context.uid!);
        if (status?.stage === 'routing') await deps.sittings.enterStage2(context.uid!, block);
        else if (status?.block !== block) throw new Error('The status names another block than the routing answers give.');
      }
      const second = await loadStage(block, draft.seed);
      if (!second.stage) throw new Error(`The ${block} block's items are not all in the bank.`);
      return second.stage;
    },
    startStage2(context) {
      return context.access === 'participant' ? assessmentDeps().sittings.startStage2(context.uid!) : Promise.resolve(context.clock());
    },
    record(context, draft, stages, finishedAt, closedBy) {
      return postTestFromDraft({
        playerCode: context.participantCode ?? 'preview',
        seed: draft.seed,
        startedAt: draft.startedAt,
        stage2StartedAt: draft.stage2StartedAt ?? null,
        finishedAt,
        closedBy,
        design: design!,
        routingPresented: stages[0].presented,
        stage2Presented: stages[1]?.presented ?? [],
        answers: draft.answers,
      });
    },
    problems: sitting => testSittingProblems(sitting, design ?? undefined),
  };
};

export const usePostTest = ({ newSeed = nextAttemptSeed, clock = Date.now, ...who }: PostTestInput) => {
  // One form per mounted sitting: it holds the design that sitting opened on.
  const [form] = useState(createPostTestForm);
  return useTestSitting(form, { ...who, newSeed, clock });
};

export type PostTestState = ReturnType<typeof usePostTest>;
