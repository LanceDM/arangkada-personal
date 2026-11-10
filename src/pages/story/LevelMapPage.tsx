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
        aside={
          (course?.error || course?.assessments) && (
            <div className="flex w-full max-w-md flex-col items-center gap-3">
              {course?.error && <p className="text-sm text-destructive"><Say {...course.error} /></p>}
              {course?.assessments && !course.assessments.diagnosticDone && (
                <button
                  onClick={() => navigate(routing.participant ? '/study' : '/play')}
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                >
                  <Say en="Take the pre-test first." fil="Sagutan muna ang pre-test." />
                </button>
              )}
              {course?.assessments?.postExamDone && (
                <p className="text-sm text-accent">
                  <Say en="Course complete. Thank you for taking part." fil="Tapos na ang kurso. Salamat sa paglahok." />
                </p>
              )}
              {course?.assessments?.postExamOpen && !course.assessments.postExamDone && (
                <button
                  onClick={() => navigate(routing.participant ? '/study' : '/play/post-test')}
                  className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground"
                >
                  <Say en="POST-TEST →" fil="POST-TEST →" />
                </button>
              )}
            </div>
          )
        }
      />
    </AppLayout>
  );
};

export default LevelMapPage;
