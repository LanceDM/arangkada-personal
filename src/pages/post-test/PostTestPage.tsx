/**
 * `/play/post-test`: the two-stage post-test. Every signed-in account sits it (a study
 * account under its enrolment code, any other under its open-access code);
 * an admin previews it, and a guest is asked to sign in. The study's guided home
 * links here.
 */
import { useNavigate } from 'react-router-dom';
import { useAuthSession } from '@/features/auth';
import { PostTest } from '@/features/assessment';
import { useEnrolment } from '@/features/study';
import { openAccessCode } from '@/domain/study/participantCode';

const StudyPostTestPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, studyAccount } = useAuthSession();
  const enrolment = useEnrolment(studyAccount && user ? user.uid : null);
  if (loading || enrolment.status === 'loading') return null;
  return (
    <PostTest
      // Remounted per account, so one account's sitting never shows to the next.
      key={user?.uid ?? 'guest'}
      uid={user?.uid ?? null}
      participantCode={
        enrolment.status === 'enrolled'
          ? enrolment.enrolment.code
          : // Every other signed-in account sits it too (2026-11-10); an admin previews it.
            user && !studyAccount && !isAdmin
            ? openAccessCode(user.uid)
            : null
      }
      isAdmin={isAdmin && !studyAccount}
      onLeave={() => navigate(studyAccount ? '/study' : '/play')}
    />
  );
};

export default StudyPostTestPage;
