/**
 * The study deadline in Firestore (`study_settings/deadline`): after it, the
 * study home offers anyone not yet certified to finish the study (the end
 * path). The rules let an admin write it and any signed-in account read it.
 */
import { doc, onSnapshot, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { StudyDeadlineRepository } from '@/features/admin/application/pilotPorts';

const deadlineDoc = () => doc(db, 'study_settings', 'deadline');

export const firebaseStudyDeadlineRepository: StudyDeadlineRepository = {
  watch: (onChange, onError) =>
    onSnapshot(
      deadlineDoc(),
      snap => {
        const at = snap.exists() ? (snap.data() as { at?: unknown }).at : null;
        onChange(typeof at === 'number' ? at : null);
      },
      (error: FirestoreError) => onError(error.message)
    ),
  set: at => setDoc(deadlineDoc(), { schemaVersion: 1, at, updatedAt: Date.now() }),
};
