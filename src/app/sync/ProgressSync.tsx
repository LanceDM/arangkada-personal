/**
 * The one place guest (local) progress and Firestore progress meet.
 *
 * Renders nothing — it is a behaviour mounted next to the router — and owns
 * three things:
 *
 *   1. Hydration: on sign-in, pull the progress summary into the store.
 *   2. Migration: a first-time sign-in carries the guest's local progress and
 *      daily-challenge streak up with it, and never overwrites real data.
 *   3. Autosave: any change to unlocked levels, results or score is written
 *      back for the signed-in user.
 *
 * The ordering here is load-bearing. `hydratedUidRef` gates the autosave effect
 * so a fresh sign-in cannot save the empty pre-hydration store over the summary
 * it is about to read, and `previousUidRef` is what distinguishes "arrived here
 * as a guest" from "returning user with no progress doc" — migrated and reset
 * respectively.
 *
 * It sits in `app/` rather than in either feature because it is the only thing
 * that legitimately spans Auth, Progression and Daily Challenge.
 */
import { useEffect, useRef } from 'react';
import { useAuthSession } from '@/features/auth';
import { migrateGuestDailyProgress } from '@/features/daily-challenge';
import {
  getProgressSummary,
  saveProgressSummary,
  saveTotalScore,
  useProgressStore,
  type PersistedProgress,
  type UserProgressSummary,
} from '@/features/progression';
import type { LevelResult } from '@/domain/learner/attempt';

/** Strips per-attempt logs down to the best-per-level summary the doc stores. */
const toLevelBest = (
  levelResults: Record<number, LevelResult>
): UserProgressSummary['levelBest'] =>
  Object.fromEntries(
    Object.entries(levelResults).map(([id, r]) => [
      id,
      { levelId: r.levelId, score: r.score, stars: r.stars, completed: r.completed },
    ])
  );

/**
 * Rebuilds store-shaped results from the summary doc. `logs` is intentionally
 * empty: nothing reads them off the hydrated store, because a signed-in
 * player's full log history is pulled from the attempts collection instead.
 */
const toLevelResults = (
  levelBest: UserProgressSummary['levelBest']
): Record<number, LevelResult> =>
  Object.fromEntries(
    Object.entries(levelBest).map(([id, r]) => [
      id,
      {
        levelId: r.levelId,
        score: r.score,
        stars: r.stars,
        completed: r.completed,
        violations: 0,
        correctActions: 0,
        logs: [],
      },
    ])
  );

export const ProgressSync = () => {
  const { user, loading } = useAuthSession();
  const { unlockedLevels, levelResults, totalScore, hydrateProgress } = useProgressStore();
  const hydratedUidRef = useRef<string | null>(null);
  const previousUidRef = useRef<string | null>(null);
  const guestSnapshotRef = useRef<PersistedProgress>({
    unlockedLevels: [0],
    levelResults: {},
    totalScore: 0,
  });

  useEffect(() => {
    if (user) return;
    guestSnapshotRef.current = { unlockedLevels, levelResults, totalScore };
  }, [user, unlockedLevels, levelResults, totalScore]);

  useEffect(() => {
    let cancelled = false;

    const syncFromFirestore = async () => {
      if (loading) return;

      if (!user) {
        hydrateProgress(null);
        hydratedUidRef.current = null;
        previousUidRef.current = null;
        return;
      }

      try {
        const isFirstLoginFromGuest = previousUidRef.current === null;
        if (isFirstLoginFromGuest) await migrateGuestDailyProgress(user.uid);

        const summary = await getProgressSummary(user.uid);
        if (cancelled) return;

        if (summary) {
          hydrateProgress({
            unlockedLevels: summary.unlockedLevels,
            levelResults: toLevelResults(summary.levelBest),
            totalScore: Object.values(summary.levelBest).reduce((sum, r) => sum + r.score, 0),
          });
        } else if (isFirstLoginFromGuest) {
          const guestProgress = guestSnapshotRef.current;
          await saveProgressSummary(user.uid, {
            unlockedLevels: guestProgress.unlockedLevels,
            levelBest: toLevelBest(guestProgress.levelResults),
            updatedAt: Date.now(),
          });
          await saveTotalScore(user.uid, guestProgress.totalScore);
          hydrateProgress(guestProgress);
        } else {
          // Returning users with no progress doc start from clean defaults.
          hydrateProgress(null);
        }

        hydratedUidRef.current = user.uid;
        previousUidRef.current = user.uid;
      } catch (error) {
        console.error('Failed to load user progress:', error);
      }
    };

    void syncFromFirestore();
    return () => {
      cancelled = true;
    };
  }, [user, loading, hydrateProgress]);

  useEffect(() => {
    if (!user || loading) return;
    if (hydratedUidRef.current !== user.uid) return;

    void saveProgressSummary(user.uid, {
      unlockedLevels,
      levelBest: toLevelBest(levelResults),
      updatedAt: Date.now(),
    }).catch(error => console.error('Failed to save user progress:', error));
    void saveTotalScore(user.uid, totalScore).catch(error =>
      console.error('Failed to save total score:', error)
    );
  }, [user, loading, unlockedLevels, levelResults, totalScore]);

  return null;
};
