/**
 * What Daily Challenge needs from the outside world, stated as interfaces.
 *
 * Two stores rather than one, because a guest and a signed-in player keep their
 * record in different places and the migration on first sign-in has to read
 * both. The implementations are bound by this feature's `composition.ts`.
 */
import type {
  DailyAnswers,
  DailyAttempt,
  DailyStreakSummary,
  StreakData,
} from '@/features/daily-challenge/domain/dailyAttempt';

/** The signed-in player's record, under `users/{uid}`. */
export interface DailyRemoteRepository {
  getStreak(uid: string): Promise<DailyStreakSummary | null>;
  saveStreak(uid: string, streak: DailyStreakSummary): Promise<void>;
  saveAttempt(uid: string, attempt: DailyAttempt): Promise<void>;
  myAttempts(uid: string): Promise<DailyAttempt[]>;
  /** The denormalized copy on the account document, for the admin report. */
  saveLongestStreak(uid: string, longestStreak: number): Promise<void>;
}

/** A guest's record, in this browser only. */
export interface DailyLocalRepository {
  loadStreak(): StreakData;
  saveStreak(streak: StreakData): void;
  loadAnswer(dateKey: string): { selectedIndex: number } | null;
  saveAnswer(dateKey: string, selectedIndex: number): void;
  loadAllAnswers(): DailyAnswers;
}
