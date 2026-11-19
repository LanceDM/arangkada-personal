/** `/study/sign-in`: a participant signs back in by username, and goes on to `/study`. */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { signOut, useAuthSession } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';
import { StudyCard, StudySignInForm } from '@/features/study';
import { Say } from '@/shared/i18n/language';
import { Button } from '@/shared/ui/button';
import { studyPageMessages as m } from './messages';

/** Logged first: once signed out, nothing more can be written for this account. */
const signOutLogged = async (uid: string | null, from: string) => {
  if (uid) await logUiAction(uid, 'signed_out', { from }).catch(() => {});
  await signOut();
};

const StudySignInPage = () => {
  const navigate = useNavigate();
  const { user, isLoggedIn, studyAccount, loading } = useAuthSession();

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
          <Button variant="outline" onClick={() => void signOutLogged(user?.uid ?? null, 'study_sign_in')}>
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
