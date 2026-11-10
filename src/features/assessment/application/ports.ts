/**
 * What the pre/post test needs from the outside world. The Firestore implementations are bound by `composition.ts`.
 */
import type { QuizItemDoc } from '@/features/driving-sim';
import type { DraftAnswer } from '@/domain/assessment/sittingClock';
import type { TestKind, TestSitting } from '@/domain/assessment/testResponse';
import type { Stage2Block, TwoStageDesign } from '@/domain/assessment/twoStageDesign';
import type { NewTestStatus, PostTestStatusDoc, TestStatusDoc } from '@/features/assessment/domain/testStatus';

export interface TestItemRepository {
  /** Every `test` item in the bank. A participant may read them only while a pre-test is open. */
  loadTestItems(): Promise<QuizItemDoc[]>;
  /**
   * These items, one read each: a post-test's participant may read only the
   * block they are on. An id the bank does not hold is left out.
   */
  loadItemsById(ids: readonly string[]): Promise<QuizItemDoc[]>;
}

export interface TestDesignRepository {
  /** The post-test's frozen design, or null before calibration day has published it. */
  loadPostTestDesign(): Promise<TwoStageDesign | null>;
}

export interface TestSittingRepository {
  status(uid: string, kind: TestKind): Promise<TestStatusDoc | null>;
  /** The post-test's status with its stage. */
  postStatus(uid: string): Promise<PostTestStatusDoc | null>;
  /** Writes the open status, stamped by the server, and its empty draft; refused if one exists. */
  open(uid: string, status: NewTestStatus): Promise<void>;
  /** Closes the routing block: the status names the block it routed to. */
  enterStage2(uid: string, block: Stage2Block): Promise<void>;
  /** Starts part 2's clock, and returns it. */
  startStage2(uid: string): Promise<number>;
  /** Saves the record and finishes the status in one write. */
  finish(uid: string, sitting: TestSitting): Promise<void>;
}

/** The answers in progress, on the server, so they follow the participant. */
export interface TestDraftRepository {
  load(uid: string, kind: TestKind): Promise<Record<string, DraftAnswer>>;
  /** Saves one confirmed answer; the server stamps it and refuses it past the deadline. */
  saveAnswer(uid: string, kind: TestKind, itemId: string, chosen: number): Promise<void>;
  /** The server's time now, so a countdown never rests on the device's clock. */
  serverTime(uid: string, kind: TestKind): Promise<number>;
}
