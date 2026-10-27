import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { useStoryRun } from './storyRunContext';

/**
 * The pilot's post-test: the final exam on one fixed
 * roll, driven once by every participant at the end of their play time.
 *
 * Reached only by its URL, which the facilitator opens, so it never appears
 * as a choice on the map. It starts like a free replay, outside the routing
 * FSM, and its results screen offers no further play. A guest cannot start
 * it, because nothing a guest plays is saved.
 */
const PostTestPage = () => {
  const navigate = useNavigate();
  const { course } = useStoryRun();

  return (
    <AppLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-4 py-12 text-center">
        <h1 className="font-display text-3xl font-bold">POST-TEST</h1>
        <p className="text-muted-foreground">
          The final exam, the same for every participant. Drive it once, when the facilitator tells
          you to. There are no hints, and it does not change your course.
        </p>
        {course === null ? (
          <p className="text-sm text-muted-foreground">The post-test is not part of this build of the game.</p>
        ) : course.playPostTest === null ? (
          <p className="text-sm text-destructive">Sign in first: the post-test is saved to your account.</p>
        ) : (
          <button
            onClick={course.playPostTest}
            className="rounded-xl bg-primary px-8 py-3 font-display text-sm tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            START THE POST-TEST →
          </button>
        )}
        {course?.error && <p className="text-sm text-destructive">{course.error}</p>}
        <button
          onClick={() => navigate('/play/story')}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Back to the map
        </button>
      </div>
    </AppLayout>
  );
};

export default PostTestPage;
