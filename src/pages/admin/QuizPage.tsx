/**
 * `/admin/quiz`: the Short Quiz bank's editor, inside the admin
 * area's layout, which checks the admin. Its writes carry this admin's id.
 */
import { QuizEditorSection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const QuizPage = () => {
  const { user } = useAuthSession();
  return <QuizEditorSection uid={user?.uid ?? null} />;
};

export default QuizPage;
