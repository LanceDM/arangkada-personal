/**
 * `users/{uid}/progress/summary` — the one "current state" document for a
 * player's ladder position.
 *
 * Only the best result per level is kept here. Full per-attempt history lives
 * in the append-only `users/{uid}/attempts` collection that Driving Sim writes.
 */
export interface LevelBest {
  levelId: number;
  score: number;
  stars: number;
  completed: boolean;
}

export interface UserProgressSummary {
  unlockedLevels: number[];
  levelBest: Record<number, LevelBest>;
  updatedAt: number;
}

/** What a guest carries in memory, and what a first sign-in migrates upward. */
export interface PersistedProgress {
  unlockedLevels: number[];
  levelResults: Record<number, import('@/domain/learner/attempt').LevelResult>;
  totalScore: number;
}
