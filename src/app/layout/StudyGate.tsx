/**
 * Keeps a study participant to the study's order: on
 * every route but the ones their stage opens, a study account is taken to
 * the study's home. The team's and admins' accounts, and guests, pass
 * through untouched. What each stage opens is the study's
 * (`studyAccountMayVisit`); the rules hold the order of the writes as well.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthSession } from '@/features/auth';
import { STUDY_HOME, studyAccountMayVisit, useStudyProgress } from '@/features/study';

export const StudyGate = ({ children }: { children: ReactNode }) => {
  const { studyAccount, loading } = useAuthSession();
  const progress = useStudyProgress();
  const { pathname } = useLocation();

  if (loading || !studyAccount) return <>{children}</>;
  const stage = progress.status === 'ready' ? progress.stage : null;
  // While the stage is read, only the paths open at every stage are shown.
  if (studyAccountMayVisit(stage, pathname)) return <>{children}</>;
  if (progress.status === 'loading') return null;
  return <Navigate to={STUDY_HOME} replace />;
};
