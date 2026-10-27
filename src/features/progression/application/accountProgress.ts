/**
 * A signed-in player's progress summary, over the bound port.
 *
 * The store itself is guest-first and synchronous; these are the reads and
 * writes that cross the network, called by `app/sync/ProgressSync`.
 */
import type { UserProgressSummary } from '@/features/progression/domain/progressSummary';
import { progressionDeps } from './dependencies';

export const getProgressSummary = (uid: string): Promise<UserProgressSummary | null> =>
  progressionDeps().progress.getSummary(uid);

export const saveProgressSummary = (uid: string, summary: UserProgressSummary): Promise<void> =>
  progressionDeps().progress.saveSummary(uid, summary);

export const saveTotalScore = (uid: string, totalScore: number): Promise<void> =>
  progressionDeps().progress.saveTotalScore(uid, totalScore);
