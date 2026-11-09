import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { LevelMap } from '@/features/progression';
import { Say } from '@/shared/i18n/language';
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
            replays: !routing.participant,
            backTo: routing.participant ? '/study' : undefined,
            loading: course.loading,
            onContinue: course.continueCourse,
          }
        }
        aside={course?.error && <p className="text-sm text-destructive"><Say {...course.error} /></p>}
      />
    </AppLayout>
  );
};

export default LevelMapPage;
