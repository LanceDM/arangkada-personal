/** `/admin/routing`: the per-competency routing FSM the study runs, and where each player is in it. */
import { CourseFlowSection, useCourseAdmin } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const RoutingPage = () => {
  const { isAdmin } = useAuthSession();
  return <CourseFlowSection course={useCourseAdmin(isAdmin)} />;
};

export default RoutingPage;
