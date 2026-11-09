/**
 * `/study/join`: a participant joins the study with the invite the team gave
 * them. An invite in the link (`?invite=`) is filled in for them.
 * A study account already signed in goes on to `/study`, which finishes a
 * join that stopped after the account was made; but not while a join runs
 * here, which signs the account in before it enrols it.
 *
 * The language comes first, so that the join and everything after
 * it is read in the participant's own.
 */
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { signOut, useAuthSession } from '@/features/auth';
import { LanguageChooser, StudyCard, StudyJoinForm } from '@/features/study';
import { Say } from '@/shared/i18n/language';
import { Button } from '@/shared/ui/button';
import { studyPageMessages as m } from './messages';

const StudyJoinPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isLoggedIn, studyAccount, loading } = useAuthSession();
  const [joining, setJoining] = useState(false);
  const [languageSet, setLanguageSet] = useState(false);

  if (!joining && !loading && isLoggedIn && studyAccount) return <Navigate to="/study" replace />;

  return (
    <StudyCard>
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.joinTheArangkadaStudy} />
      </h1>
      {loading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : isLoggedIn && !joining ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            <Say {...m.youAreSignedIn} />
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            <Say {...m.signOut} />
          </Button>
        </div>
      ) : !languageSet ? (
        <LanguageChooser onChosen={() => setLanguageSet(true)} />
      ) : (
        <>
          <StudyJoinForm
            initialInvite={params.get('invite') ?? ''}
            onBusy={setJoining}
            onJoined={() => navigate('/study', { replace: true })}
          />
          <p className="text-center text-sm text-muted-foreground">
            <Say {...m.alreadyJoined} />{' '}
            <Link to="/study/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              <Say {...m.signIn} />
            </Link>
          </p>
        </>
      )}
    </StudyCard>
  );
};

export default StudyJoinPage;
