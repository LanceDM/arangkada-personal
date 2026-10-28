import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { MissionBriefing } from '@/features/driving-sim';
import { useStoryRun } from './storyRunContext';

/**
 * The pre-drive lesson flow: module, lesson reader and checkpoint quiz.
 *
 * The one run screen that deep-links honestly in Legacy. Entering a briefing
 * *is* the fresh-entry path - there is no prior state to restore, so a cold
 * load rolls the level and runs the adaptive decision, exactly as arriving
 * from the map would have done. In a New group an entry is planned by
 * Continue or a free replay, so a cold load has no plan and returns to the
 * map; the briefing then also says which move of the course this is, and why.
 */
const BriefingPage = () => {
  const navigate = useNavigate();
  const { activeLevel, levelConfig, weakArea, course, beginDrive } = useStoryRun();

  // `buildLevelConfig` returns null for a level id with no content behind it.
  if (activeLevel === null || !levelConfig) return <Navigate to="/play/story" replace />;
  // In the course, a briefing exists only where the course is (or for a free
  // replay of a finished stage). Any other level is not open: back to the map,
  // so nobody plays a stage outside the course from a typed URL.
  if (course && !course.loading && course.gate === null) return <Navigate to="/play/story" replace />;

  return (
    <AppLayout showFooter={false}>
      <MissionBriefing
        level={levelConfig}
        weakArea={weakArea}
        courseNote={course?.note ?? null}
        gate={course?.gate ?? null}
        onBack={() => navigate('/play/story')}
        onStartGame={() => {
          beginDrive(activeLevel);
          navigate(`/play/story/${activeLevel}/drive`);
        }}
      />
    </AppLayout>
  );
};

export default BriefingPage;
