/**
 * `/study`: a participant's guided home. One "Next
 * step", the study's order, help and withdrawal; every step returns here. It
 * also finishes a join that stopped after the account was made.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { signOut, useAuthSession } from '@/features/auth';
import { StudyCard, StudyHome, type NextStep } from '@/features/study';

const StudyHomePage = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, studyAccount, loading } = useAuthSession();

  if (!loading && !(isLoggedIn && studyAccount)) return <Navigate to="/study/sign-in" replace />;

  const next = (step: NextStep) => navigate(step.to, step.continueCourse ? { state: { continueCourse: true } } : undefined);
  const leave = async () => {
    await signOut();
    navigate('/study/sign-in', { replace: true });
  };

  return (
    <StudyCard>
      {loading || !user ? (
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      ) : (
        <StudyHome uid={user.uid} onNext={next} onSignOut={() => void leave()} />
      )}
    </StudyCard>
  );
};

export default StudyHomePage;
