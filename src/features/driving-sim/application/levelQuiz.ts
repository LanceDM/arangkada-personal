/**
 * The Short Quiz's bank, through the ports. There is no bundled
 * fallback: a quiz that cannot be read blocks its level until it can.
 */
import { useCallback, useEffect, useState } from 'react';
import { levelQuizFrom, type LevelQuizState, type QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import { drivingSimDeps } from './dependencies';

export const loadLevelQuiz = async (moduleId: string): Promise<LevelQuizState> => {
  const bank = await drivingSimDeps().quizBank.load(moduleId);
  return levelQuizFrom(moduleId, bank.items, bank.settings);
};

/** A failed save is logged and dropped: losing the record must not take the quiz down. */
export const recordQuizSitting = (uid: string, sitting: QuizSittingDoc): void => {
  drivingSimDeps()
    .quizSittings.save(uid, sitting)
    .catch(error => console.warn('Could not save the quiz sitting.', error));
};

/** While loading, `loading`; a read that failed, `failed`; else what the bank holds. */
export type LevelQuizLoad = { kind: 'loading' } | { kind: 'failed' } | LevelQuizState;

/** A module's quiz, read each time the briefing opens so an admin's edit shows at once. */
export const useLevelQuiz = (moduleId: string) => {
  const [load, setLoad] = useState<{ moduleId: string; attempt: number; value: LevelQuizLoad }>({
    moduleId,
    attempt: 0,
    value: { kind: 'loading' },
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadLevelQuiz(moduleId)
      .then(value => {
        if (!cancelled) setLoad({ moduleId, attempt, value });
      })
      .catch(error => {
        console.warn(`Could not load the quiz for ${moduleId}.`, error);
        if (!cancelled) setLoad({ moduleId, attempt, value: { kind: 'failed' } });
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId, attempt]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const current = load.moduleId === moduleId && load.attempt === attempt ? load.value : { kind: 'loading' as const };
  return { quiz: current, retry };
};
