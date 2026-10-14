/** Daily Challenge's persisted shapes. */

/** The running streak, as both the guest record and `users/{uid}/dailyStreak/summary`. */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  completedDates: string[];
}

export type DailyStreakSummary = StreakData & { updatedAt: number };

/** `users/{uid}/dailyAttempts/{id}` — one answered scenario. */
export interface DailyAttempt {
  date: string;
  scenarioId: string;
  selectedIndex: number;
  correct: boolean;
  timestamp: number;
}

/** What a viewer picked on a given day, in the shape both sources return. */
export type DailyAnswers = Record<string, { selectedIndex: number }>;

export const EMPTY_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  completedDates: [],
};
