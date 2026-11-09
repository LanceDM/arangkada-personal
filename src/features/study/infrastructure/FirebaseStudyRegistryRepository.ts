/** The study's registry in Firestore: invites, enrolments, and enrolling. */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { isStudyCohort } from '@/domain/study/participantCode';
import type { StudyInviteDoc } from '@/domain/study/studyRecords';
import type { StudyRegistryRepository } from '@/features/study/application/ports';
import { enrolInRegistry, readEnrolment } from './studyEnrolment';

export const firebaseStudyRegistryRepository: StudyRegistryRepository = {
  async invite(code) {
    const snap = await getDoc(doc(db, 'study_invites', code));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<StudyInviteDoc>;
    return isStudyCohort(data.cohort) ? (data as StudyInviteDoc) : null;
  },

  async enrolmentOf(uid) {
    const snap = await getDoc(doc(db, 'users', uid, 'study', 'enrolment'));
    return snap.exists() ? readEnrolment(snap.data()) : null;
  },

  enrol: input => enrolInRegistry(db, input),
};
