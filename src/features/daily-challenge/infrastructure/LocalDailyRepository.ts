/** A guest's daily-challenge record: the streak, plus one key per answered day. */
import {
  EMPTY_STREAK,
  type DailyAnswers,
  type StreakData,
} from '@/features/daily-challenge/domain/dailyAttempt';
import type { DailyLocalRepository } from '@/features/daily-challenge/application/ports';

const STREAK_KEY = 'arangkada_streak';
const ANSWER_PREFIX = 'daily-';

const answerKey = (dateKey: string) => `${ANSWER_PREFIX}${dateKey}`;

const loadStreak = (): StreakData => {
  try {
    const saved = localStorage.getItem(STREAK_KEY);
    if (saved) return JSON.parse(saved) as StreakData;
  } catch {
    // A corrupt record just means starting the streak over.
  }
  return { ...EMPTY_STREAK };
};

const saveStreak = (streak: StreakData) => {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
};

const loadAnswer = (dateKey: string): { selectedIndex: number } | null => {
  try {
    const raw = localStorage.getItem(answerKey(dateKey));
    return raw ? (JSON.parse(raw) as { selectedIndex: number }) : null;
  } catch {
    return null;
  }
};

const saveAnswer = (dateKey: string, selectedIndex: number) => {
  localStorage.setItem(answerKey(dateKey), JSON.stringify({ selectedIndex }));
};

/** Every locally-stored answer, for the one-time migration on first sign-in. */
const loadAllAnswers = (): DailyAnswers => {
  const answers: DailyAnswers = {};
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(ANSWER_PREFIX)) continue;

      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as { selectedIndex?: unknown };
      if (typeof parsed.selectedIndex === 'number') {
        answers[key.slice(ANSWER_PREFIX.length)] = { selectedIndex: parsed.selectedIndex };
      }
    }
  } catch {
    // Partial results are fine: migration is best-effort and never overwrites.
  }
  return answers;
};

export const localDailyRepository: DailyLocalRepository = {
  loadStreak,
  saveStreak,
  loadAnswer,
  saveAnswer,
  loadAllAnswers,
};
