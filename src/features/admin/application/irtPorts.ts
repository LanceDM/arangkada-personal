/**
 * What the IRT section reads, and its one write, the
 * team's review sheets. Documents are handed over as stored, unchecked: the
 * section's domain reads them. Bound by this feature's `composition.ts`.
 */
import type { StudyCohort } from '@/domain/study/participantCode';
import type { QuizItemDoc } from '@/features/driving-sim';
import type { ExpertReviewDoc, ItemReviewKind, TaggingReviewDoc } from '@/features/admin/domain/contentValidity';
import type { ExamSittingResponses } from '@/features/admin/domain/bankCalibration';

/** One enrolled participant's test documents, each null where it does not exist. */
export interface ParticipantTestDocuments {
  code: string;
  cohort: StudyCohort;
  preStatus: unknown;
  postStatus: unknown;
  preSitting: unknown;
  postSitting: unknown;
}

export interface IrtRepository {
  /** `irt_reports/current`, published by a developers' script; null before it is. */
  report(): Promise<unknown>;
  /** `test_designs/post`; null before it is published. */
  design(): Promise<unknown>;
  /** Every `test` item of the Short Quiz bank, switched on or off. */
  testItems(): Promise<QuizItemDoc[]>;
  /** Every enrolled participant's `testStatus` and `testSittings`. */
  participantTests(): Promise<ParticipantTestDocuments[]>;
  reviews(): Promise<{ tagging: unknown; experts: unknown }>;
  /** Every Mock Exam sitting's per-item answers (`users/{uid}/examAttempts`), for the bank's calibration. */
  examResponses(): Promise<ExamSittingResponses[]>;
  /** A whole review at its next revision; the rules refuse a stale one. */
  saveReview(kind: ItemReviewKind, review: TaggingReviewDoc | ExpertReviewDoc): Promise<void>;
}
