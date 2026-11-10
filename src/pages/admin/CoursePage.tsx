/** `/admin/course`: the per-competency course's live Q-table and the study export. */
import { CourseSection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const CoursePage = () => {
  const { isAdmin } = useAuthSession();
  return <CourseSection enabled={isAdmin} />;
};

export default CoursePage;
