/**
 * The study's invites in Firestore, for the admin's
 * Invites panel. The code is the document's id and the secret, drawn here from
 * the browser's cryptographic randomness. The rules let an admin create one
 * open and close it once, and let nobody else list them.
 */
import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { isStudyCohort, newInviteCode } from '@/domain/study/participantCode';
import { newInvite, type StudyInviteDoc } from '@/domain/study/studyRecords';
import type { InviteEntry, StudyInvitesRepository } from '@/features/admin/application/pilotPorts';

const randomByte = () => crypto.getRandomValues(new Uint8Array(1))[0];

export const firebaseStudyInvitesRepository: StudyInvitesRepository = {
  watch: (onChange, onError) =>
    onSnapshot(
      collection(db, 'study_invites'),
      snap =>
        onChange(
          snap.docs.flatMap((d): InviteEntry[] => {
            const data = d.data() as Partial<StudyInviteDoc>;
            if (!isStudyCohort(data.cohort)) return [];
            return [{ code: d.id, cohort: data.cohort, open: data.open === true, createdAt: Number(data.createdAt ?? 0), closedAt: data.closedAt ?? null }];
          })
        ),
      (error: FirestoreError) => onError(error.message)
    ),

  async create(cohort) {
    // A collision is one in 2^50; it is drawn again rather than ever overwritten.
    for (;;) {
      const code = newInviteCode(randomByte);
      if ((await getDoc(doc(db, 'study_invites', code))).exists()) continue;
      await setDoc(doc(db, 'study_invites', code), newInvite(cohort, Date.now()));
      return code;
    }
  },

  async close(code) {
    await updateDoc(doc(db, 'study_invites', code), { open: false, closedAt: Date.now() });
  },
};
