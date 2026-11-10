/** `/admin/q-learning`: the per-competency policy, its live table, its rewards and its decisions. */
import { QLearningSection, useCourseAdmin } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const QLearningPage = () => {
  const { isAdmin } = useAuthSession();
  return <QLearningSection course={useCourseAdmin(isAdmin)} />;
};

export default QLearningPage;
