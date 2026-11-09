/**
 * One clock per sitting, on the server. A part's deadline
 * counts from a server timestamp on the status document, so leaving, reloading
 * or changing device never restarts it, and a device's own clock never sets it.
 * `firestore.rules` holds the same two limits, plus `ANSWER_GRACE_SECONDS`.
 *
 * The answers in progress are on the server too, each with the server time it
 * arrived. They hold the choice picked and never whether it was right.
 */
import type { TestAnswer, TestKind } from './testResponse';

/** The pre-test's one countdown: 60 items at a minute each. */
export const PRE_TEST_LIMIT_SECONDS = 3600;
/** Each part of the post-test: 15 items at a minute each. */
export const POST_TEST_PART_LIMIT_SECONDS = 900;
/**
 * How long past a deadline the rules still take an answer: a save already on
 * its way when the clock ran out. An assumption, a few seconds of network delay.
 */
export const ANSWER_GRACE_SECONDS = 10;

/** A server timestamp as Firestore's two SDKs hand it back, or a number already read. */
export const millisOf = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  const stamp = value as { toMillis?: () => number } | null | undefined;
  return typeof stamp?.toMillis === 'function' ? stamp.toMillis() : null;
};

/** An answer the server has: the stored choice picked, and when it arrived. */
export interface DraftAnswer {
  readonly chosen: number;
  readonly at: number;
}

export type DraftAnswers = Readonly<Record<string, DraftAnswer>>;

/** The answers of `users/{uid}/testDrafts/{kind}` as Firestore hands them back. */
export const readDraftAnswers = (data: Record<string, unknown> | null | undefined): Record<string, DraftAnswer> => {
  const answers: Record<string, DraftAnswer> = {};
  const stored = data?.answers;
  if (typeof stored !== 'object' || stored === null) return answers;
  for (const [id, value] of Object.entries(stored as Record<string, unknown>)) {
    const answer = value as { chosen?: unknown; at?: unknown } | null;
    const at = millisOf(answer?.at);
    if (answer && Number.isInteger(answer.chosen) && at !== null) answers[id] = { chosen: answer.chosen as number, at };
  }
  return answers;
};

/**
 * The record's answers for one part, items in the order shown. The sitting is
 * forward only, so an item appeared when the one before it was answered, or
 * when the part began: its time is the gap between the two server times.
 */
export const timedAnswers = (
  shownIds: readonly string[],
  answers: DraftAnswers,
  partStartedAt: number
): Record<string, TestAnswer> => {
  const timed: Record<string, TestAnswer> = {};
  let previous = partStartedAt;
  for (const id of shownIds) {
    const answer = answers[id];
    if (!answer) continue;
    timed[id] = { chosen: answer.chosen, timeMs: Math.max(0, answer.at - previous) };
    previous = answer.at;
  }
  return timed;
};

/** What a status says about its clock. */
export interface SittingClockFacts {
  readonly kind: TestKind;
  readonly startedAt: number;
  readonly stage?: 'routing' | 'stage2';
  readonly stage2At?: number | null;
  readonly stage2StartedAt?: number | null;
}

/**
 * When an open sitting stopped running, or null while it still runs. A
 * post-test whose first part has closed and whose second never started has
 * stopped too: no clock is running, and only the participant can start one.
 */
export const sittingStoppedAt = (status: SittingClockFacts, now: number): number | null => {
  const until = (start: number, seconds: number) => {
    const deadline = start + seconds * 1000;
    return now >= deadline ? deadline : null;
  };
  if (status.kind === 'pre') return until(status.startedAt, PRE_TEST_LIMIT_SECONDS);
  if (status.stage2StartedAt != null) return until(status.stage2StartedAt, POST_TEST_PART_LIMIT_SECONDS);
  if (status.stage === 'stage2') return status.stage2At ?? status.startedAt;
  return until(status.startedAt, POST_TEST_PART_LIMIT_SECONDS);
};
