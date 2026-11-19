/** `/admin/evaluation`: how well BKT predicted each answer, per player and overall, and how the policy behaved. */
import { EvaluationSection, useCourseAdmin, useEvaluationLogs } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const EvaluationPage = () => {
  const { isAdmin } = useAuthSession();
  return <EvaluationSection course={useCourseAdmin(isAdmin)} logs={useEvaluationLogs()} />;
};

export default EvaluationPage;
