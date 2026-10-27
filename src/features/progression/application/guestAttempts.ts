/**
 * A guest's graded runs, as the learner model wants to see them.
 *
 * The store keeps only the best attempt per level and stamps no time of its
 * own, so each entry carries logs, a level id and whether that best run passed,
 * and nothing else. Exposed on Progression's public API because Driving Sim's
 * guest history adapter needs it, and `app/dependencies` is what joins the two.
 */
import { useProgressStore } from './progressStore';
import type { ActionLog } from '@/domain/learner/attempt';

export interface GuestAttempt {
  levelId: number;
  logs: ActionLog[];
  passed: boolean;
}

export const guestAttempts = (): GuestAttempt[] =>
  Object.values(useProgressStore.getState().levelResults).map(({ levelId, logs, completed }) => ({
    levelId,
    logs,
    passed: completed,
  }));
