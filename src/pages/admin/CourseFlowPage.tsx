/** `/admin/course-flow`: the per-competency routing FSM, and where each participant is in it. */
import { CourseFlowSection, useCourseRecords } from '@/features/admin';

const CourseFlowPage = () => {
  const course = useCourseRecords();
  return <CourseFlowSection course={course} />;
};

export default CourseFlowPage;
