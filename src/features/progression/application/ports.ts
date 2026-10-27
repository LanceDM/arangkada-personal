/**
 * What Progression needs from the outside world, stated as an interface.
 *
 * The store and the screens over it depend only on this. The Firestore
 * implementation is bound by this feature's `composition.ts`.
 */
import type { UserProgressSummary } from '@/features/progression/domain/progressSummary';

export interface ProgressRepository {
  getSummary(uid: string): Promise<UserProgressSummary | null>;
  saveSummary(uid: string, summary: UserProgressSummary): Promise<void>;
  /** The denormalized copy on the account document, for the admin report. */
  saveTotalScore(uid: string, totalScore: number): Promise<void>;
}
