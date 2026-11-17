/** `/admin/course-bkt`: each participant's P(L) per competency, from the BKT update log. */
import { CourseBktSection, useCourseRecords } from '@/features/admin';

const CourseBktPage = () => {
  const course = useCourseRecords();
  return <CourseBktSection course={course} />;
};

export default CourseBktPage;
