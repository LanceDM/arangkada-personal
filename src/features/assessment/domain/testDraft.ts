/**
 * A sitting in progress as the screen holds it, drawn from the server: the status's clock and the draft's answers. A reload or another
 * device reads the same two documents, so it comes back to the same item with
 * the same clock. The order itself is not kept: the seed redraws it.
 *
 * The sitting is forward only, so the item on screen is the first one of its
 * part with no answer.
 *
 * A post-test has two parts, each with its own clock: the routing block's from
 * `startedAt`, the routed block's from `stage2StartedAt`. `routingClosedAt`
 * marks the routing block closed, after which its answers never change.
 *
 * In an admin's preview nothing is on the server, and this is all there is.
 */
import type { DraftAnswer } from '@/domain/assessment/sittingClock';

export interface TestDraft {
  seed: number;
  /** Server time. The first part's deadline is counted from it. */
  startedAt: number;
  /** By item id. */
  answers: Record<string, DraftAnswer>;
  /** A post-test's routing block closed: by its last answer or its clock. */
  routingClosedAt?: number;
  /** When a post-test's second block was started. */
  stage2StartedAt?: number;
}
