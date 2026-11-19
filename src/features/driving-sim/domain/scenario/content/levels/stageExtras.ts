// Scenarios written for a stage beyond its authored road (2026-10-28), so every
// competency the stage teaches has at least 3 scenarios per drive, and so the
// spread competencies have content of their own in the stages they were
// spread to. Each one is portable: a question or a decision graded from speed,
// lane and stopping, which any road can host. The composer appends them after
// the stage's authored road (`composeDrive.ts`).
//
// DRAFT CONTENT: every scenario here is a draft for the group's review and the
// LTO's validation of the competency mapping. Each cites the module text it
// tests; none has a verified FDM page yet.
import type { SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { STAGE_EXTRA_SCENARIOS } from './stageExtraScenarios';

/** Stage -> its extra scenarios. */
export const STAGE_EXTRAS: Readonly<Record<number, readonly SlotVariant[]>> = STAGE_EXTRA_SCENARIOS;

/** Every extra written for a stage before `levelId`, with the stage it belongs to. */
export const extrasBefore = (levelId: number): { levelId: number; variant: SlotVariant }[] =>
  Object.entries(STAGE_EXTRAS)
    .map(([stage, variants]) => ({ stage: Number(stage), variants }))
    .filter(({ stage }) => stage < levelId)
    .flatMap(({ stage, variants }) => variants.map(variant => ({ levelId: stage, variant })));

/** Every extra scenario, for content checks. */
export const allStageExtras = (): { levelId: number; variant: SlotVariant }[] => extrasBefore(Number.POSITIVE_INFINITY);
