/**
 * What every study step page does before its screen: it is for a signed-in
 * study account at that step, and anyone else goes to the study's home,
 * which knows where they stand.
 */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { studyUsernameOf, useAuthSession } from '@/features/auth';
import { CodeBadge, HelpButton, STUDY_HOME, StudyCard, useStudyProgress, type StudyStage } from '@/features/study';

export const StudyStepPage = ({
  stage,
  children,
}: {
  stage: StudyStage;
  children: (step: { uid: string; code: string; username: string | null; surveyOpened: boolean; done: () => void }) => ReactNode;
}) => {
  const { user, loading } = useAuthSession();
  const progress = useStudyProgress();

  if (loading || progress.status === 'loading') {
    return (
      <StudyCard>
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      </StudyCard>
    );
  }
  if (!user || progress.status !== 'ready' || progress.stage !== stage) return <Navigate to={STUDY_HOME} replace />;

  const code = progress.enrolment.code;
  return (
    <StudyCard>
      <CodeBadge code={code} />
      {children({ uid: user.uid, code, username: studyUsernameOf(user.email), surveyOpened: progress.facts.survey.openedAt !== null, done: () => void progress.refresh() })}
      <HelpButton code={code} />
    </StudyCard>
  );
};
