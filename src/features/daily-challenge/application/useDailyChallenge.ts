/**
 * One day's challenge: which scenario it is, whether it has been answered, and
 * what answering it does to the streak.
 *
 * Both storage paths are handled here so the screen never branches on who is
 * signed in: a guest's record is localStorage, a signed-in player's is
 * Firestore, and the two are read into the same shape.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import {
  getDailyKey,
  getDailyScenario,
  updateStreak,
  type DailyScenario,
} from '../domain/dailyScenarios';
import {
  EMPTY_STREAK,
  type DailyAnswers,
  type StreakData,
} from '../domain/dailyAttempt';
import { dailyDeps } from './dependencies';

export interface DailyChallengeState {
  scenario: DailyScenario;
  streak: StreakData;
  selectedIndex: number | null;
  /** True once the answer and its explanation are on screen. */
  revealed: boolean;
  /** True when today has already been answered, in this session or a previous one. */
  alreadyDone: boolean;
  answer: (choiceIndex: number) => void;
}

export const useDailyChallenge = (): DailyChallengeState => {
  const { user, isLoggedIn } = useAuthSession();
  const scenario = getDailyScenario();
  const todayKey = getDailyKey();

  const [streak, setStreak] = useState<StreakData>(EMPTY_STREAK);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answersByDate, setAnswersByDate] = useState<DailyAnswers>({});

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const { remote, local: localStore } = dailyDeps();

      if (!isLoggedIn || !user) {
        const local = localStore.loadStreak();
        const today = localStore.loadAnswer(todayKey);
        if (cancelled) return;

        setStreak(local);
        setAnswersByDate(today ? { [todayKey]: today } : {});
        setSelectedIndex(today?.selectedIndex ?? null);
        setRevealed(Boolean(today));
        return;
      }

      try {
        const [remoteStreak, remoteAttempts] = await Promise.all([
          remote.getStreak(user.uid),
          remote.myAttempts(user.uid),
        ]);
        if (cancelled) return;

        const answers = Object.fromEntries(
          remoteAttempts.map(a => [a.date, { selectedIndex: a.selectedIndex }])
        );
        setStreak(remoteStreak ?? EMPTY_STREAK);
        setAnswersByDate(answers);
        setSelectedIndex(answers[todayKey]?.selectedIndex ?? null);
        setRevealed(Boolean(answers[todayKey]));
      } catch (error) {
        console.error('Failed to load daily progress:', error);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user, todayKey]);

  const alreadyDone = streak.completedDates.includes(todayKey) || Boolean(answersByDate[todayKey]);

  const answer = useCallback(
    (choiceIndex: number) => {
      if (revealed || alreadyDone) return;

      setSelectedIndex(choiceIndex);
      setRevealed(true);
      const nextStreak = updateStreak(streak, todayKey);
      setStreak(nextStreak);
      setAnswersByDate(prev => ({ ...prev, [todayKey]: { selectedIndex: choiceIndex } }));

      const { remote, local: localStore } = dailyDeps();

      if (isLoggedIn && user) {
        const now = Date.now();
        void Promise.all([
          remote.saveStreak(user.uid, { ...nextStreak, updatedAt: now }),
          remote.saveAttempt(user.uid, {
            date: todayKey,
            scenarioId: scenario.id,
            selectedIndex: choiceIndex,
            correct: scenario.choices[choiceIndex].correct,
            timestamp: now,
          }),
          nextStreak.longestStreak > streak.longestStreak
            ? remote.saveLongestStreak(user.uid, nextStreak.longestStreak)
            : Promise.resolve(),
        ]).catch(error => console.error('Failed to save daily progress:', error));
      } else {
        localStore.saveAnswer(todayKey, choiceIndex);
        localStore.saveStreak(nextStreak);
      }
    },
    [alreadyDone, isLoggedIn, revealed, scenario, streak, todayKey, user]
  );

  return { scenario, streak, selectedIndex, revealed, alreadyDone, answer };
};
