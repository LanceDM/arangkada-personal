/**
 * Resetting an account's course (2026-11-16): an admin takes an account back
 * to the start of its course, as if it had just taken its pre-test.
 *
 * Nothing is deleted outright. Every record the reset clears is first copied
 * to `users/{uid}/archive/{resetId}/...` (the same path under it), and the
 * reset itself is recorded at `users/{uid}/archive/{resetId}`: who, when, why,
 * and how many records of each kind. Only then are the originals removed, so
 * the game, BKT, the study export and the admin views no longer see them.
 *
 * Cleared (the course): the course's place, the drives with their telemetry,
 * the course log, the course's own short-quiz sittings, the BKT log and BKT
 * profile (rebuilt from the pre-test on the next answer), practice quizzes,
 * the open quiz or drive, and the level map's stars.
 *
 * Kept: the pre-test and post-test (their sittings and records), study
 * enrolment, consent, background form, mock exams, the Daily Challenge, the
 * event stream (the reset itself is logged in its archive record), the
 * evidence counter, the pilot group and pilot mark.
 *
 * Not undone: the shared Q-table. Its updates from this account's past
 * decisions stay, because every player learns into the one table.
 *
 * Study participants (an account with a study code) are never reset.
 */

/** Collections cleared whole. */
export const RESET_COLLECTIONS = ['attempts', 'courseLog', 'bktUpdates', 'quizSittings'] as const;

/** A drive's telemetry documents, under `attempts/{id}/telemetry/`. */
export const ATTEMPT_TELEMETRY = ['fsm', 'decisions', 'routing', 'inputs'] as const;

/** Sittings in `assessmentSittings` that belong to the course: the short quiz. The pre-test and post-test stay. */
export const RESET_SITTING_KINDS = ['quiz'] as const;

/** Single documents cleared, as [collection, id]. */
export const RESET_DOCUMENTS = [
  ['routing', 'competencyCourse'],
  ['routing', 'cursor'],
  ['state', 'active'],
  ['bkt', 'profile'],
  ['progress', 'summary'],
] as const;

export interface ResetTarget {
  uid: string;
  label: string;
  /** The study code; any code makes the account a participant. */
  code: string | null;
}

/** Why this account may not be reset, or null when it may. */
export const resetRefusal = (target: ResetTarget, enrolled: boolean): string | null => {
  if (target.code || enrolled) return 'This account is a study participant: its records are study data and are never reset.';
  return null;
};

export type ResetCounts = Record<string, number>;

export interface ProgressResetRecord {
  schemaVersion: 1;
  kind: 'progress_reset';
  uid: string;
  /** `copying` until every record is copied and removed; `done` after. */
  status: 'copying' | 'done';
  at: number;
  finishedAt: number | null;
  by: { uid: string; email: string | null };
  note: string;
  /** Records archived, by kind (collection name, or `routing/competencyCourse` for a single document). */
  counts: ResetCounts;
}

/** The reset's id: when it began, so an account's resets list in order. */
export const resetIdAt = (at: number): string => `reset-${at}`;

export const totalArchived = (counts: ResetCounts): number => Object.values(counts).reduce((sum, n) => sum + n, 0);
