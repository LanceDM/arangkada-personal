import { Navigate, useNavigate } from 'react-router-dom';
import { LevelComplete, SaveProgressModal } from '@/features/progression';
import { useStoryRun } from './storyRunContext';
import { useAuthSession } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';

/**
 * The results screen. Like the drive, it holds a result that only exists in
 * memory, so a cold load has nothing to show and returns to the map. In a New
 * group it offers the routing FSM's Continue in place of Next, Retry and the
 * practice suggestion.
 */
const CompletePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const {
    activeLevel,
    levelConfig,
    levelResult,
    recommendation,
    nextLevelId,
    showSaveModal,
    dismissSaveModal,
    totalScore,
    completedLevels,
    restartAttempt,
    course,
  } = useStoryRun();

  if (activeLevel === null || !levelConfig || levelResult?.levelId !== activeLevel) {
    return <Navigate to="/play/story" replace />;
  }

  // All three of these end the attempt, so all three roll a new one. Retry goes
  // straight back to the road; the other two pass through a briefing, because
  // they are entering a level rather than repeating one.
  const log = (action: string, detail: Record<string, unknown> = {}) => {
    if (user) void logUiAction(user.uid, action, { levelId: activeLevel, ...detail });
  };
  const startFresh = (path: string, replace = false) => {
    restartAttempt();
    navigate(path, { replace });
  };

  return (
    <>
      <LevelComplete
        result={levelResult}
        level={levelConfig}
        onNext={() => {
          log('results_next', { nextLevelId });
          if (nextLevelId !== null) startFresh(`/play/story/${nextLevelId}/briefing`);
        }}
        onRetry={() => {
          log('results_retry');
          startFresh(`/play/story/${activeLevel}/drive`, true);
        }}
        onMenu={() => {
          log('results_menu');
          navigate('/play/story');
        }}
        hasNextLevel={nextLevelId !== null}
        recommendation={recommendation}
        course={
          course && {
            note: course.saving ? 'Saving your result...' : course.resultNote ?? '',
            // The post-test ends the session, so it offers no further play.
            onContinue: course.saving || course.certified || course.postTest ? null : course.continueCourse,
          }
        }
        onPracticeRecommended={() => {
          log('results_practice_recommended', { target: recommendation?.recommendedLevelId ?? null });
          const target = recommendation?.recommendedLevelId;
          if (target === null || target === undefined) return;
          startFresh(`/play/story/${target}/briefing`);
        }}
      />
      {showSaveModal && (
        <SaveProgressModal
          totalScore={totalScore}
          completedLevels={completedLevels}
          onDismiss={dismissSaveModal}
        />
      )}
    </>
  );
};

export default CompletePage;
