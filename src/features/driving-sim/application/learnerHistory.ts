/**
 * Where the learner's cross-session history comes from, in one place.
 *
 * Every consumer of the adaptive layer is a pure function over `ActionLog[]`
 * and is only ever as right as the history it is handed. The two sources are
 * not equivalent - a signed-in player has every attempt ever saved, a guest has
 * only the best attempt per level in this browser - so both go through the same
 * port and the same flattening, and the dev inspector reads exactly what real
 * play reads.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { LearnerHistory } from './ports';
import { drivingSimDeps } from './dependencies';

export type { LearnerAttempt, LearnerHistory, HistorySource } from './ports';

export const loadLearnerHistory = (uid: string | null): Promise<LearnerHistory> =>
  drivingSimDeps().learnerHistory.load(uid);

/**
 * The flat log stream the learner-model functions take, in chronological order.
 *
 * BKT and the practice selector's recent-performance bucket are sequential
 * replays: each folds over this array left to right. Neither source hands back
 * chronological attempts - Firestore orders newest-first, the guest store by
 * level id - so a naive flatMap would replay a signed-in player's most recent
 * evidence as their earliest. Sorting by each log's own `timestamp` fixes that
 * without caring which attempt a log came from. Route every consumer here.
 */
export const historyLogs = (history: LearnerHistory): ActionLog[] =>
  history.attempts.flatMap(attempt => attempt.logs).sort((a, b) => a.timestamp - b.timestamp);
