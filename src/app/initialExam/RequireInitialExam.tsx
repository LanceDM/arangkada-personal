/**
 * Keeps a mode closed until the initial exam is taken: a direct link or a
 * bookmark to Story Mode, the Daily Challenge or the mock exam lands on the
 * main menu instead, where the initial exam is.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useInitialExam } from './useInitialExam';

export const RequireInitialExam = ({ children }: { children: ReactNode }) => {
  const gate = useInitialExam();
  const { pathname } = useLocation();
  if (gate.loading) return null;
  if (gate.locked) return <Navigate to="/play" replace state={{ lockedFrom: pathname }} />;
  return <>{children}</>;
};
