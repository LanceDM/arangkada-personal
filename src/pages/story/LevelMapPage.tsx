import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { LevelMap } from '@/features/progression';
import { RoutingGroupOverride } from '@/features/driving-sim';
import { useStoryRun } from './storyRunContext';

/**
 * The level ladder. In Legacy, choosing a level starts a fresh attempt and
 * hands off to its briefing - the map itself never opens a drive directly. In
 * a New group the routing FSM chooses the course's next entry, so the map
 * offers Continue, and a level already passed as a free replay.
 */
const LevelMapPage = () => {
  const navigate = useNavigate();
  const { restartAttempt, course, routing } = useStoryRun();

  return (
    <AppLayout>
      <LevelMap
        onSelectLevel={levelId => {
          if (course) {
            course.playFreeReplay(levelId);
            return;
          }
          // Re-entering a level the player has already finished has to roll a
          // new attempt, exactly as Retry does.
          restartAttempt();
          navigate(`/play/story/${levelId}/briefing`);
        }}
        course={
          course && {
            frontierLevelId: course.frontierLevelId,
            certified: course.certified,
            openAll: course.openAll,
            loading: course.loading,
            onContinue: course.continueCourse,
          }
        }
        aside={
          (routing.canOverride || course?.error || course?.assessments) && (
            <div className="flex w-full max-w-md flex-col items-center gap-3">
              {course?.error && <p className="text-sm text-destructive">{course.error}</p>}
              {course?.assessments && !course.assessments.diagnosticDone && (
                <p className="text-sm text-muted-foreground">
                  Your course starts with a short diagnostic test: Continue opens it.
                </p>
              )}
              {course?.assessments?.postExamOpen && !course.assessments.postExamDone && (
                <button
                  onClick={() => navigate('/play/story/post-exam')}
                  className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground"
                >
                  POST-EVALUATION EXAM →
                </button>
              )}
              {routing.canOverride && (
                <RoutingGroupOverride
                  resolution={routing.resolution}
                  value={routing.override}
                  onChange={routing.setOverride}
                />
              )}
            </div>
          )
        }
      />
    </AppLayout>
  );
};

export default LevelMapPage;
