/**
 * `/play/pre-test`: the study's pre-test. A participant's account sits it,
 * under the code it enrolled with; an admin's previews it; anyone
 * else is told who it is for. The study's guided home
 * links here.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '@/features/auth';
import { PreTest } from '@/features/assessment';
import { useEnrolment } from '@/features/study';

const PreTestPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, studyAccount } = useAuthSession();
  const enrolment = useEnrolment(studyAccount && user ? user.uid : null);
  if (loading || enrolment.status === 'loading') return null;
  return (
    <PreTest
      // Remounted per account, so one account's sitting never shows to the next.
      key={user?.uid ?? 'guest'}
      uid={user?.uid ?? null}
      participantCode={enrolment.status === 'enrolled' ? enrolment.enrolment.code : null}
      isAdmin={isAdmin && !studyAccount}
      onLeave={() => navigate(studyAccount ? '/study' : '/play')}
    />
  );
};

export default PreTestPage;
