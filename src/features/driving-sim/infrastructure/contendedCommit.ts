/**
 * A commit to the shared cohort Q-table, retried whole while other players
 * hold it.
 *
 * Every participant's course step writes the one `q_tables/{cohort}` document
 * in a transaction. When several commit at once, Firestore aborts the losers,
 * and the emulator reports the same contention as `permission-denied`: its
 * rules evaluation of `get()`/`getAfter()` fails on the contended documents
 * (a scripted check of 20 players lost 9 that way). `runTransaction` retries
 * an abort but never a refusal, so the step was lost.
 *
 * A refused or aborted commit writes nothing, and each attempt re-reads the
 * table and recomputes the step from it, so a retry can neither lose nor
 * double-count an update. A genuine refusal is still refused on every
 * attempt and surfaces after the last one. Errors thrown by the step itself
 * (a cursor conflict) carry no Firestore code and are never retried.
 */

/** Firestore codes a concurrent commit to the same table can produce. */
const CONTENDED_CODES = new Set(['aborted', 'permission-denied', 'failed-precondition', 'unavailable']);

export const CONTENDED_COMMIT_ATTEMPTS = 20;

const isContended = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && CONTENDED_CODES.has(String((error as { code?: unknown }).code));

/** Full-jitter backoff, so players who collided do not collide again in step. */
const backoffMs = (attempt: number): number => Math.random() * Math.min(3_000, 100 * 2 ** attempt);

export async function contendedCommit<T>(
  commit: () => Promise<T>,
  { attempts = CONTENDED_COMMIT_ATTEMPTS, wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)) } = {}
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await commit();
    } catch (error) {
      if (attempt >= attempts || !isContended(error)) throw error;
      await wait(backoffMs(attempt));
    }
  }
}
