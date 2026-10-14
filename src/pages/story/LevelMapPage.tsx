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
          (routing.canOverride || course?.error) && (
            <div className="flex w-full max-w-md flex-col items-center gap-3">
              {course?.error && <p className="text-sm text-destructive">{course.error}</p>}
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
