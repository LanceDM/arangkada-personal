import type { LearnerHistory, LearnerHistoryRepository } from '@/features/driving-sim/application/ports';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import { listLevelAttempts } from './FirebaseStoryAttemptRepository';

/**
 * Whether a saved run passed its level: its score reached the pass mark and,
 * where the attempt carries its FSM summary, it did not end in a crash - the
 * rule `buildLevelResult` applies.
 */
const passedRun = ({ levelId, finalScore, fsmMetrics }: LevelAttempt): boolean => {
  const level = LEVELS.find(candidate => candidate.id === levelId);
  return Boolean(level) && finalScore >= level!.requiredScore && !(fsmMetrics && fsmMetrics.crashes > 0);
};

/**
 * A signed-in player's full history: every attempt ever saved, across sessions
 * and devices, including repeats of the same level.
 *
 * Attempt order is whatever Firestore returns (newest first). Callers must
 * flatten through `historyLogs`, which re-sorts by each log's own timestamp —
 * the replay-based estimators downstream need chronological order.
 */
export const firebaseLearnerHistoryRepository: LearnerHistoryRepository = {
  async load(uid): Promise<LearnerHistory> {
    if (!uid) return { source: 'firestore', attempts: [] };
    const attempts = await listLevelAttempts(uid);
    return {
      source: 'firestore',
      attempts: attempts.map(attempt => ({
        levelId: attempt.levelId,
        timestamp: attempt.timestamp,
        logs: attempt.logs,
        passed: passedRun(attempt),
      })),
    };
  },
};
