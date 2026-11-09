import { useState } from 'react';
import { loadBriefingProgress, saveBriefingProgress } from './briefingProgress';

/**
 * Where a level's quiz stands: `required` once the bank has one to pass,
 * `open` for a level with no quiz on purpose, and `blocked` while it loads or
 * when it cannot be read, since nothing bundled stands in for it.
 */
export type QuizGate = 'required' | 'open' | 'blocked';

/**
 * The briefing's order: read the module, pass its checkpoint, then drive. A
 * level with no quiz leaves nothing to pass, so its drive is open; a quiz that
 * cannot be read keeps the level shut. An admin skips the order, to reach any
 * step of any level when testing.
 */
export const useBriefing = (moduleId: string, gate: QuizGate, isAdmin: boolean) => {
  const initialProgress = loadBriefingProgress(moduleId);
  const [lessonsRead, setLessonsRead] = useState(Boolean(initialProgress.lessonsRead));
  const [quizPassed, setQuizPassed] = useState(Boolean(initialProgress.quizPassed));
  const [showReader, setShowReader] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  const markLessonsRead = () => {
    setLessonsRead(true);
    saveBriefingProgress(moduleId, { lessonsRead: true, quizPassed });
    setShowReader(false);
  };

  const markQuizPassed = () => {
    setQuizPassed(true);
    saveBriefingProgress(moduleId, { lessonsRead: true, quizPassed: true });
    setShowQuiz(false);
  };

  const canStartQuiz = gate === 'required' && (lessonsRead || isAdmin);
  const canStartMission = isAdmin || gate === 'open' || (gate === 'required' && quizPassed);

  return {
    lessonsRead,
    quizPassed,
    showReader,
    showQuiz,
    canStartQuiz,
    canStartMission,
    openReader: () => setShowReader(true),
    closeReader: () => setShowReader(false),
    openQuiz: () => setShowQuiz(true),
    closeQuiz: () => setShowQuiz(false),
    markLessonsRead,
    markQuizPassed,
  };
};
