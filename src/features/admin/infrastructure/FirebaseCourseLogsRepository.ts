/**
 * The course views' logs, read with the admin's own sign-in, so every read
 * goes through the rules. A participant's logs are read under their own
 * account, one participant at a time; the table and its update log are a
 * cohort's. Nothing here writes.
 */
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { CourseLogsRepository } from '@/features/admin/application/courseLogsPorts';

const dataOf = async (path: string, ...segments: string[]) =>
  (await getDocs(collection(db, path, ...segments))).docs.map(d => d.data() as Record<string, unknown>);

export const firebaseCourseLogsRepository: CourseLogsRepository = {
  bktUpdates: uid => dataOf('users', uid, 'bktUpdates'),
  courseLog: uid => dataOf('users', uid, 'courseLog'),
  watchTable: (cohort, onChange, onError) =>
    onSnapshot(
      doc(db, 'q_tables', cohort),
      snap => onChange(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
      error => onError(error.message)
    ),
  watchUpdates: (cohort, count, onChange, onError) =>
    onSnapshot(
      query(collection(db, 'q_tables', cohort, 'updates'), orderBy('globalSeq', 'desc'), limit(count)),
      snap => onChange(snap.docs.map(d => d.data() as Record<string, unknown>)),
      error => onError(error.message)
    ),
};
