import { Navigate, useNavigate } from 'react-router-dom';
import { GameScreen } from '@/features/driving-sim';
import { useStoryRun } from './storyRunContext';

/**
 * The canvas simulation, including its own garage and aftermath stages.
 *
 * Deliberately not a real entry point: the attempt's rolled config lives in
 * memory in the layout above, a guest's history does not survive a reload, and
 * the adaptive decision is asynchronous - so a cold load here would drive a
 * different level than any briefing described. It bounces to the briefing.
 */
const DrivePage = () => {
  const navigate = useNavigate();
  const {
    activeLevel,
    levelConfig,
    startedRun,
    decisionSettled,
    rollNonce,
    practice,
    support,
    attemptSeed,
    priorLogs,
    liveReroll,
    completeRun,
    exitRun,
    abandonRun,
  } = useStoryRun();

  if (activeLevel === null || startedRun !== activeLevel) {
    return <Navigate to={activeLevel === null ? '/play/story' : `/play/story/${activeLevel}/briefing`} replace />;
  }

  // The adaptive decision feeds `levelConfig`. Mounting before it lands means
  // the events array can be replaced underneath a running animation loop.
  if (!levelConfig || !decisionSettled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Preparing route...
        </p>
      </div>
    );
  }

  return (
    <GameScreen
      // A route change already remounts this, so the key is belt-and-braces -
      // but one fresh GameScreen per attempt is worth stating, because it is
      // also what registers the drive's session for /dev/profile.
      key={`${activeLevel}:${rollNonce}`}
      level={levelConfig}
      onComplete={(result, telemetry) => {
        completeRun(result, telemetry);
        // Replace, not push: "back" out of a results screen belongs on the
        // briefing, not inside a drive that has already been scored.
        navigate(`/play/story/${activeLevel}/complete`, { replace: true });
      }}
      onExit={partial => {
        exitRun?.(partial);
        navigate('/play/story');
      }}
      onAbandon={abandonRun}
      transitionParams={practice?.transitionParams}
      support={support}
      attemptSeed={attemptSeed ?? undefined}
      priorLogs={priorLogs}
      liveReroll={liveReroll}
    />
  );
};

export default DrivePage;
