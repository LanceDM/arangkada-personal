import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { LessonReader, LEVELS, LEVEL_MODULES, getLevelModule, logUiAction, markLessonsRead } from '@/features/driving-sim';
import { useAuthSession } from '@/features/auth';

/**
 * A level's LTO module, readable on its own.
 *
 * Unlike the three run screens this deep-links and survives a reload: module
 * text is authored content, independent of the per-attempt roll, so there is no
 * in-memory run state to lose. Finishing here counts toward the briefing's
 * lesson gate - both call sites key progress on `level.moduleId`, so they write
 * and read one record rather than two.
 */
const LearnPage = () => {
  const navigate = useNavigate();
  const { levelId: levelIdParam } = useParams();
  const { user } = useAuthSession();
  const log = (action: string, detail: Record<string, unknown> = {}) => {
    if (user) void logUiAction(user.uid, action, { levelId, from: 'learn_page', ...detail });
  };
  const levelId = Number(levelIdParam);
  const level = Number.isInteger(levelId) ? LEVELS.find(l => l.id === levelId) : undefined;

  if (!level) return <Navigate to="/play/story" replace />;

  const levelModule = LEVEL_MODULES[level.moduleId] ?? getLevelModule(level.id);
  // Reachable directly by URL, so there may be no history entry behind it -
  // fall back to the level map rather than `-1`.
  const leave = () => navigate('/play/story');

  return (
    <AppLayout showFooter={false}>
      <LessonReader
        module={levelModule}
        onReadEvent={event => log(`lesson_${event.action}`, { ...event, module: levelModule.id })}
        onClose={() => {
          log('module_closed', { module: levelModule.id });
          leave();
        }}
        onFinish={() => {
          log('module_finished', { module: levelModule.id });
          markLessonsRead(level.moduleId);
          leave();
        }}
      />
    </AppLayout>
  );
};

export default LearnPage;
