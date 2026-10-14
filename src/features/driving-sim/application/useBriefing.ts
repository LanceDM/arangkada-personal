import { useState } from 'react';
import { loadBriefingProgress, saveBriefingProgress } from './briefingProgress';

export const useBriefing = (moduleId: string) => {
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

  const canStartQuiz = lessonsRead;
  // const canStartMission = quizPassed;
  const canStartMission = true; // testing: bypass quiz gate

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
