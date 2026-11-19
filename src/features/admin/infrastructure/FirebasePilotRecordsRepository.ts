/**
 * The study's stored records, read for the dashboard with the admin's own
 * sign-in, so every read goes through the rules. The same documents the
 * pilot's export reads with the service account, in the same order, and only
 * read: nothing here writes.
 *
 * An attempt's three records are one query on its `telemetry` collection. An
 * admin cannot query `routing` or `telemetry` across every account, so the
 * dashboard reads the enrolled participants one by one, which is all it shows.
 */
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { isStudyCohort } from '@/domain/study/participantCode';
import type { PilotRecordsRepository, PoolAccountEntry } from '@/features/admin/application/pilotPorts';

const docsOf = async (path: string, ...segments: string[]) => (await getDocs(collection(db, path, ...segments))).docs;

export const firebasePilotRecordsRepository: PilotRecordsRepository = {
  pool: async () =>
    (await docsOf('participants')).flatMap(d => {
      const data = d.data() as Partial<PoolAccountEntry>;
      return data.uid && isStudyCohort(data.cohort) ? [{ code: data.code ?? d.id, cohort: data.cohort, uid: data.uid }] : [];
    }),

  routing: async uid => {
    const docs = await docsOf('users', uid, 'routing');
    const dataOf = (id: string) => docs.find(d => d.id === id)?.data() ?? null;
    return { assignment: dataOf('assignment'), cursor: dataOf('cursor') };
  },

  attemptsFrom: async (uid, from) => {
    const attempts = collection(db, 'users', uid, 'attempts');
    const snap = await getDocs(
      from === null ? query(attempts, orderBy('timestamp', 'asc')) : query(attempts, where('timestamp', '>=', from), orderBy('timestamp', 'asc'))
    );
    return snap.docs.map(d => ({ id: d.id, savedAt: Number(d.data().timestamp), data: d.data() }));
  },

  attemptRecords: async (uid, attemptId) => {
    const docs = await docsOf('users', uid, 'attempts', attemptId, 'telemetry');
    const dataOf = (id: string) => docs.find(d => d.id === id)?.data() ?? null;
    return { fsm: dataOf('fsm'), decisions: dataOf('decisions'), routing: dataOf('routing') };
  },

  fsmLog: async (uid, attemptId) => {
    const snap = await getDoc(doc(db, 'users', uid, 'attempts', attemptId, 'telemetry', 'fsm'));
    return snap.exists() ? snap.data() : null;
  },

  otherModes: async uid => {
    const [exams, daily] = await Promise.all([docsOf('users', uid, 'examAttempts'), docsOf('users', uid, 'dailyAttempts')]);
    return {
      examSittings: exams.map(d => ({ timestamp: Number(d.data().timestamp) })),
      dailyAnswers: daily.map(d => ({ timestamp: Number(d.data().timestamp) })),
    };
  },
};
