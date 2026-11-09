/** `/study/sign-in`: a participant signs back in by username, and goes on to `/study`. */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { signOut, useAuthSession } from '@/features/auth';
import { StudyCard, StudySignInForm } from '@/features/study';
import { Say } from '@/shared/i18n/language';
import { Button } from '@/shared/ui/button';
import { studyPageMessages as m } from './messages';

const StudySignInPage = () => {
  const navigate = useNavigate();
  const { isLoggedIn, studyAccount, loading } = useAuthSession();

  if (!loading && isLoggedIn && studyAccount) return <Navigate to="/study" replace />;

  return (
    <StudyCard>
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.participantSignIn} />
      </h1>
      {loading ? (
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      ) : isLoggedIn ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            <Say {...m.youAreSignedIn2} />
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            <Say {...m.signOut} />
          </Button>
        </div>
      ) : (
        <>
          <StudySignInForm onSignedIn={() => navigate('/study', { replace: true })} />
          <p className="text-center text-sm text-muted-foreground">
            <Say {...m.newToTheStudy} />{' '}
            <Link to="/study/join" className="font-medium text-primary underline-offset-4 hover:underline">
              <Say {...m.join} />
            </Link>
          </p>
        </>
      )}
    </StudyCard>
  );
};

export default StudySignInPage;
