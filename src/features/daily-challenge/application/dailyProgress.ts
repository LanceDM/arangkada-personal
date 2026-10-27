/**
 * The daily record, read and moved between the two stores that hold it.
 *
 * These are what other parts of the app call. They go through the bound ports,
 * so nothing outside this feature names Firestore or `localStorage`.
 */
import { getDailyScenarioForDateKey } from '@/features/daily-challenge/domain/dailyScenarios';
import type { DailyStreakSummary, StreakData } from '@/features/daily-challenge/domain/dailyAttempt';
import { dailyDeps } from './dependencies';

export const getDailyStreak = (uid: string): Promise<DailyStreakSummary | null> =>
  dailyDeps().remote.getStreak(uid);

export const loadGuestStreak = (): StreakData => dailyDeps().local.loadStreak();

/**
 * Moves a guest's local daily record into the account's subcollections on first
 * sign-in. Does nothing when a remote streak already exists, so a returning
 * player's real record is never overwritten by whatever this browser holds.
 */
export const migrateGuestDailyProgress = async (uid: string): Promise<void> => {
  const { remote, local } = dailyDeps();
  if (await remote.getStreak(uid)) return;

  const guestStreak = local.loadStreak();
  const guestAnswers = local.loadAllAnswers();
  if (guestStreak.completedDates.length === 0 && Object.keys(guestAnswers).length === 0) return;

  await remote.saveStreak(uid, { ...guestStreak, updatedAt: Date.now() });
  await Promise.all(
    Object.entries(guestAnswers).map(([dateKey, answer]) => {
      const scenario = getDailyScenarioForDateKey(dateKey);
      return remote.saveAttempt(uid, {
        date: dateKey,
        scenarioId: scenario.id,
        selectedIndex: answer.selectedIndex,
        correct: scenario.choices[answer.selectedIndex]?.correct ?? false,
        timestamp: Date.now(),
      });
    })
  );
  if (guestStreak.longestStreak > 0) await remote.saveLongestStreak(uid, guestStreak.longestStreak);
};
