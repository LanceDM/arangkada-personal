/** `/admin/course-q-learning`: the per-competency policy, its live table, its rewards and its decisions. */
import { CourseQLearningSection, useCourseRecords } from '@/features/admin';

const CourseQLearningPage = () => {
  const course = useCourseRecords();
  return <CourseQLearningSection course={course} />;
};

export default CourseQLearningPage;
