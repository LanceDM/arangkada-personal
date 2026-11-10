/**
 * Where the signed-in participant stands: their
 * enrolment, the facts the study's order reads, and the stage they give.
 *
 * Held in one context for the whole app, so the guided home and the route
 * gate agree. Read when the account signs in, and again whenever a screen
 * asks (`refresh`): the home asks every time it opens, which is where every
 * step returns to.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { EnrolmentDoc } from '@/domain/study/studyRecords';
import { studyStage, type StudyFacts, type StudyStage } from '@/domain/study/studyStage';
import { studyDeps } from './dependencies';

export type StudyProgress =
  /** Not a study account, or nobody signed in. */
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'error' }
  /** Signed in, but the join stopped before the account was given a code. */
  | { status: 'not-enrolled' }
  | { status: 'ready'; enrolment: EnrolmentDoc; facts: StudyFacts; stage: StudyStage };

export type StudyProgressState = StudyProgress & { refresh: () => Promise<void> };

export const loadStudyProgress = async (uid: string): Promise<StudyProgress> => {
  const { registry, records, sources } = studyDeps();
  const enrolment = await registry.enrolmentOf(uid);
  if (!enrolment) return { status: 'not-enrolled' };
  const [own, course, tests] = await Promise.all([records.load(uid, enrolment.code), sources.course(uid), sources.tests(uid)]);
  const facts: StudyFacts = { ...own, preTest: tests.pre, course, postTest: tests.post };
  return { status: 'ready', enrolment, facts, stage: studyStage(facts) };
};

/** The provider's value: follows `uid`, which is null for anyone but a signed-in study account. */
export const useStudyProgressSource = (uid: string | null): StudyProgressState => {
  const [read, setRead] = useState<{ uid: string; progress: StudyProgress } | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const progress = await loadStudyProgress(uid);
      setRead({ uid, progress });
    } catch (failure) {
      console.error('Failed to read the study progress:', failure);
      setRead({ uid, progress: { status: 'error' } });
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    loadStudyProgress(uid)
      .then(progress => !cancelled && setRead({ uid, progress }))
      .catch(failure => {
        console.error('Failed to read the study progress:', failure);
        if (!cancelled) setRead({ uid, progress: { status: 'error' } });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const progress: StudyProgress = !uid ? { status: 'none' } : read?.uid === uid ? read.progress : { status: 'loading' };
  return { ...progress, refresh };
};

export const StudyProgressContext = createContext<StudyProgressState>({ status: 'none', refresh: async () => {} });

export const useStudyProgress = (): StudyProgressState => useContext(StudyProgressContext);
