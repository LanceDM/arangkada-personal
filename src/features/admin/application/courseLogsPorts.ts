/**
 * What the course views read beyond the registry: each participant's BKT
 * update log and course log, and a cohort's shared Q-table with its newest
 * update-log entries, followed live. Handed over as document data, unchecked,
 * so this port and its adapter depend on no other feature.
 */
import type { StudyCohort } from '@/domain/study/participantCode';

export interface CourseLogsRepository {
  /** `users/{uid}/bktUpdates`: one entry per graded answer. */
  bktUpdates(uid: string): Promise<Record<string, unknown>[]>;
  /** `users/{uid}/courseLog`: the course's verdicts, decisions and rewards. */
  courseLog(uid: string): Promise<Record<string, unknown>[]>;
  /** `q_tables/{cohort}`, live; null until its first decision. Returns an unsubscribe. */
  watchTable(cohort: StudyCohort, onChange: (table: Record<string, unknown> | null) => void, onError: (message: string) => void): () => void;
  /** The newest `limit` entries of `q_tables/{cohort}/updates`, newest first, live. Returns an unsubscribe. */
  watchUpdates(cohort: StudyCohort, limit: number, onChange: (rows: Record<string, unknown>[]) => void, onError: (message: string) => void): () => void;
}
