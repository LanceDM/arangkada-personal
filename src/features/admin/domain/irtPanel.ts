/**
 * What the IRT section counts for itself: the item
 * bank's readiness, and descriptive counts from the stored sittings. None of
 * it is a model: a count, a share, a proportion correct. Every Rasch number
 * the section shows comes from the published report (`irt_reports/current`).
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import type { TestSitting } from '@/domain/assessment/testResponse';
import type { Stage2Block } from '@/domain/assessment/twoStageDesign';
import { STAGE2_BLOCKS } from '@/domain/assessment/twoStageDesign';
import type { StudyCohort } from '@/domain/study/participantCode';

/** The pre-test is all 60, and the post-test's four blocks partition them. */
export const TEST_ITEM_COUNT = 60;

export interface BankItem {
  readonly id: string;
  readonly competency: string;
  readonly isActive: boolean;
}

export interface BankReadiness {
  readonly total: number;
  readonly switchedOn: number;
  readonly competenciesCovered: number;
  readonly competencies: number;
  /** Switched-on items per competency, in the syllabus's order. */
  readonly perCompetency: ReadonlyArray<{ competency: string; items: number }>;
  /** Exactly 60 switched on, over every competency: what the pre-test opens on. */
  readonly ready: boolean;
  readonly placeholder: boolean;
}

export const bankReadiness = (items: readonly BankItem[]): BankReadiness => {
  const on = items.filter(i => i.isActive);
  const perCompetency = COMPETENCIES.map(competency => ({ competency, items: on.filter(i => i.competency === competency).length }));
  const covered = perCompetency.filter(c => c.items > 0).length;
  return {
    total: items.length,
    switchedOn: on.length,
    competenciesCovered: covered,
    competencies: COMPETENCIES.length,
    perCompetency,
    ready: on.length === TEST_ITEM_COUNT && covered === COMPETENCIES.length,
    placeholder: items.some(i => i.id.startsWith('PH-')),
  };
};

/** A test's status as the participant's `testStatus/{kind}` stores it, cut to what is counted. */
export interface TestProgress {
  readonly status: 'open' | 'finished';
  /** The post-test's routed block, once its routing block has closed. */
  readonly block: Stage2Block | null;
}

/** One enrolled participant's tests: statuses and finished records. */
export interface ParticipantTests {
  readonly code: string;
  readonly cohort: StudyCohort;
  readonly pre: TestProgress | null;
  readonly post: TestProgress | null;
  readonly preSitting: TestSitting | null;
  readonly postSitting: TestSitting | null;
}

export const readTestProgress = (data: unknown): TestProgress | null => {
  if (typeof data !== 'object' || data === null) return null;
  const { status, block } = data as Record<string, unknown>;
  if (status !== 'open' && status !== 'finished') return null;
  return { status, block: STAGE2_BLOCKS.includes(block as Stage2Block) ? (block as Stage2Block) : null };
};

export interface TestCounts {
  readonly enrolled: number;
  readonly preOpen: number;
  readonly preFinished: number;
  readonly postOpen: number;
  readonly postFinished: number;
  /** Post-tests past their routing block, by the block it chose. */
  readonly routed: Readonly<Record<Stage2Block, number>>;
}

export const testCounts = (participants: readonly ParticipantTests[]): TestCounts => {
  const routed: Record<Stage2Block, number> = { easy: 0, medium: 0, hard: 0 };
  for (const p of participants) if (p.post?.block) routed[p.post.block] += 1;
  return {
    enrolled: participants.length,
    preOpen: participants.filter(p => p.pre?.status === 'open').length,
    preFinished: participants.filter(p => p.pre?.status === 'finished').length,
    postOpen: participants.filter(p => p.post?.status === 'open').length,
    postFinished: participants.filter(p => p.post?.status === 'finished').length,
    routed,
  };
};

export interface ItemDrift {
  readonly itemId: string;
  readonly competency: string;
  readonly preN: number;
  readonly preCorrect: number;
  readonly postN: number;
  readonly postCorrect: number;
  /** Percent correct; null where nobody answered it. */
  readonly prePct: number | null;
  readonly postPct: number | null;
}

/**
 * Each item's percent correct at each sitting, over the finished records. A
 * post-test item is answered only by those routed to its block, so its two
 * percentages are of different people: descriptive, never a test of drift.
 * An unanswered item counts as wrong, as the analysis scores it.
 */
export const itemDrift = (participants: readonly ParticipantTests[]): ItemDrift[] => {
  const byItem = new Map<string, { competency: string; preN: number; preCorrect: number; postN: number; postCorrect: number }>();
  const add = (sitting: TestSitting | null, at: 'pre' | 'post') => {
    for (const r of sitting?.responses ?? []) {
      const entry = byItem.get(r.itemId) ?? { competency: r.competency, preN: 0, preCorrect: 0, postN: 0, postCorrect: 0 };
      if (at === 'pre') {
        entry.preN += 1;
        entry.preCorrect += r.correct ? 1 : 0;
      } else {
        entry.postN += 1;
        entry.postCorrect += r.correct ? 1 : 0;
      }
      byItem.set(r.itemId, entry);
    }
  };
  for (const p of participants) {
    add(p.preSitting, 'pre');
    add(p.postSitting, 'post');
  }
  const pct = (correct: number, n: number) => (n > 0 ? (100 * correct) / n : null);
  return [...byItem.entries()]
    .map(([itemId, e]) => ({ itemId, ...e, prePct: pct(e.preCorrect, e.preN), postPct: pct(e.postCorrect, e.postN) }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId, 'en', { numeric: true }));
};
