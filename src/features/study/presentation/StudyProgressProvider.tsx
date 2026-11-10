import type { ReactNode } from 'react';
import { StudyProgressContext, useStudyProgressSource } from '@/features/study/application/studyProgress';

/** Holds where the signed-in participant stands, for the whole app. `uid` is null for anyone else. */
export const StudyProgressProvider = ({ uid, children }: { uid: string | null; children: ReactNode }) => (
  <StudyProgressContext.Provider value={useStudyProgressSource(uid)}>{children}</StudyProgressContext.Provider>
);
