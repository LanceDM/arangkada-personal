/**
 * The player's ladder position, held in memory for the session.
 *
 * A guest's copy is all they have. A signed-in player's copy is hydrated from,
 * and written back to, `users/{uid}/progress/summary` by `app/sync/ProgressSync`
 * — which is also the only place the two ever meet.
 *
 * Best-per-level, not per-attempt: `saveLevelResult` keeps the higher score.
 * Full attempt history is Driving Sim's, in the append-only attempts collection.
 */
import { create } from 'zustand';
import type { LevelResult } from '@/domain/learner/attempt';
import type { PersistedProgress } from '@/features/progression/domain/progressSummary';

interface ProgressState extends PersistedProgress {
  unlockLevel: (levelId: number) => void;
  saveLevelResult: (result: LevelResult) => void;
  resetProgress: () => void;
  hydrateProgress: (progress: PersistedProgress | null) => void;
}

/** Level 0 is the tutorial and is always open, whatever a stored record says. */
const DEFAULT_PROGRESS: PersistedProgress = {
  unlockedLevels: [0],
  levelResults: {},
  totalScore: 0,
};

const withTutorial = (levels: number[]) => (levels.includes(0) ? levels : [0, ...levels]);

const totalOf = (results: Record<number, LevelResult>) =>
  Object.values(results).reduce((sum, r) => sum + r.score, 0);

export const useProgressStore = create<ProgressState>((set, get) => ({
  ...DEFAULT_PROGRESS,
  unlockedLevels: withTutorial(DEFAULT_PROGRESS.unlockedLevels),

  unlockLevel: levelId => {
    const { unlockedLevels } = get();
    if (!unlockedLevels.includes(levelId)) set({ unlockedLevels: [...unlockedLevels, levelId] });
  },

  saveLevelResult: result => {
    const { levelResults } = get();
    const existing = levelResults[result.levelId];
    const best = existing && existing.score > result.score ? existing : result;
    const next = { ...levelResults, [result.levelId]: best };
    set({ levelResults: next, totalScore: totalOf(next) });
  },

  resetProgress: () => set({ ...DEFAULT_PROGRESS }),

  hydrateProgress: progress => {
    const next = progress ?? DEFAULT_PROGRESS;
    set({
      unlockedLevels: withTutorial(next.unlockedLevels),
      levelResults: next.levelResults,
      totalScore: next.totalScore,
    });
  },
}));
