/**
 * The IRT section's state: the test items, the
 * published Rasch report and design, every enrolled participant's tests and
 * the team's review sheets, read together, and again on Refresh or after a
 * review is saved. Nothing is estimated here.
 */
import { useCallback, useEffect, useState } from 'react';
import { readIrtReport, type IrtReportDoc } from '@/domain/assessment/irtReport';
import { readTestSitting } from '@/domain/assessment/testResponse';
import { readTwoStageDesign, type TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import type { QuizItemDoc } from '@/features/driving-sim';
import {
  nextReview,
  readExpertReview,
  readExpertSheet,
  readTaggingReview,
  readTaggingSheet,
  type ExpertReviewDoc,
  type ItemReviewKind,
  type TaggingReviewDoc,
} from '@/features/admin/domain/contentValidity';
import { readTestProgress, type ParticipantTests } from '@/features/admin/domain/irtPanel';
import { bankCalibration, type BankCalibration } from '@/features/admin/domain/bankCalibration';
import { adminDeps } from './dependencies';

export interface IrtData {
  items: QuizItemDoc[];
  report: IrtReportDoc | null;
  design: TwoStageDesign | null;
  participants: ParticipantTests[];
  tagging: TaggingReviewDoc | null;
  experts: ExpertReviewDoc | null;
  /** The rest of the bank, from Mock Exam answers. */
  bank: BankCalibration;
  readAt: number;
}

export type IrtLoad = { status: 'loading' } | { status: 'ready'; data: IrtData } | { status: 'error'; error: string };

const asRecord = (v: unknown) => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null);
const sittingOf = (v: unknown) => {
  const data = asRecord(v);
  return data ? readTestSitting(data) : null;
};

export const loadIrtData = async (): Promise<IrtData> => {
  const repo = adminDeps().irt;
  const [items, report, design, tests, reviews, exams] = await Promise.all([
    repo.testItems(), repo.report(), repo.design(), repo.participantTests(), repo.reviews(), repo.examResponses(),
  ]);
  return {
    items: [...items].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    report: readIrtReport(report),
    design: readTwoStageDesign(asRecord(design)),
    participants: tests.map(t => ({
      code: t.code,
      cohort: t.cohort,
      pre: readTestProgress(t.preStatus),
      post: readTestProgress(t.postStatus),
      preSitting: sittingOf(t.preSitting),
      postSitting: sittingOf(t.postSitting),
    })),
    tagging: readTaggingReview(reviews.tagging),
    experts: readExpertReview(reviews.experts),
    bank: bankCalibration(exams),
    readAt: Date.now(),
  };
};

export interface IrtPanel {
  load: IrtLoad;
  refresh: () => Promise<void>;
  /** Reads a review sheet and saves it at its next revision; returns what stopped it, or nothing. */
  importReview: (kind: ItemReviewKind, csv: string) => Promise<string[]>;
}

const messageOf = (cause: unknown) => {
  const text = cause instanceof Error ? cause.message : String(cause);
  return /permission/i.test(text)
    ? "Firestore refused the read. Either this project's deployed rules predate irt_reports and item_reviews (test on the emulators with npm run dev:emulator), or this sign-in has no admin claim."
    : text;
};

export const useIrtPanel = (enabled: boolean, uid: string | null): IrtPanel => {
  const [load, setLoad] = useState<IrtLoad>({ status: 'loading' });
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadIrtData().then(
      data => {
        if (!cancelled) setLoad({ status: 'ready', data });
      },
      cause => {
        if (!cancelled) setLoad({ status: 'error', error: messageOf(cause) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, reads]);

  const refresh = useCallback(async () => setReads(n => n + 1), []);

  const importReview = useCallback(
    async (kind: ItemReviewKind, csv: string): Promise<string[]> => {
      if (load.status !== 'ready' || !uid) return ['The section has not finished reading.'];
      const { data } = load;
      const read = kind === 'tagging' ? readTaggingSheet(csv) : readExpertSheet(csv);
      const known = new Set(data.items.map(i => i.id));
      const unknown = read.rows.map(r => r.itemId).filter(id => !known.has(id));
      const problems = [...read.problems, ...(unknown.length > 0 ? [`Not test items of the bank: ${unknown.join(', ')}.`] : [])];
      if (problems.length > 0) return problems;
      const review =
        kind === 'tagging'
          ? nextReview<TaggingReviewDoc>('tagging', read as ReturnType<typeof readTaggingSheet>, data.tagging, uid, Date.now())
          : nextReview<ExpertReviewDoc>('experts', read as ReturnType<typeof readExpertSheet>, data.experts, uid, Date.now());
      try {
        await adminDeps().irt.saveReview(kind, review);
      } catch (cause) {
        return [messageOf(cause)];
      }
      await refresh();
      return [];
    },
    [load, uid, refresh]
  );

  return { load, refresh, importReview };
};
