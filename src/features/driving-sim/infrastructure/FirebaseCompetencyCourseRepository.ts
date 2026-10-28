import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { COURSE_SCHEMA_VERSION, type CourseCursor } from '@/domain/competencyRouting/course';
import { applyQLog, statesOf } from '@/domain/study/qLog';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import type {
  AssessmentRepository,
  AssessmentSitting,
  BackgroundFormRepository,
  CompetencyCourseRepository,
} from '@/features/driving-sim/application/ports';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';

/** Firestore rejects `undefined`; every payload here is plain data, so a JSON round trip drops it. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cursorDoc = (uid: string) => doc(db, 'users', uid, 'routing', 'competencyCourse');
const tableDoc = () => doc(db, 'policy', 'competencyQ');

/**
 * `users/{uid}/routing/competencyCourse`, `users/{uid}/courseLog`, and the
 * shared table at `policy/competencyQ`. The table is updated only inside a
 * transaction that re-applies this drive's operations to the newest version,
 * so two participants finishing at once never overwrite each other's learning.
 */
export const firebaseCompetencyCourseRepository: CompetencyCourseRepository = {
  async loadCursor(uid) {
    const snap = await getDoc(cursorDoc(uid));
    if (!snap.exists()) return null;
    const data = snap.data() as CourseCursor & { updatedAt?: number };
    if (data.schemaVersion !== COURSE_SCHEMA_VERSION) return null;
    const cursor: CourseCursor & { updatedAt?: number } = { ...data, quiz: data.quiz ?? null };
    delete cursor.updatedAt;
    return cursor;
  },

  async saveCursor(uid, cursor) {
    await setDoc(cursorDoc(uid), plain({ ...cursor, updatedAt: Date.now() }));
  },

  async loadQTable() {
    const snap = await getDoc(tableDoc());
    return snap.exists() ? ((snap.data().table as QTable) ?? emptyQTable()) : emptyQTable();
  },

  async applyQLog({ items, context, envelope }) {
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(tableDoc());
      const current: QTable = snap.exists() ? (snap.data().table as QTable) : emptyQTable();
      const updates = snap.exists() ? Number(snap.data().updates ?? 0) : 0;
      const applied = applyQLog({ table: current, items, firstGlobalSeq: updates + 1, context, envelope });
      const last = applied.entries.at(-1);
      // The live document the dashboard listens to: the table, each state's
      // warm-up phase and exploring/exploiting tag, and the last change.
      transaction.set(
        tableDoc(),
        plain({
          schemaVersion: 1,
          table: applied.table,
          updates: updates + items.length,
          updatedAt: Date.now(),
          states: statesOf(applied.table),
          lastUpdate: last ? { updateId: last.eventId, globalSeq: last.globalSeq, kind: last.kind, uid: last.uid, participantCode: last.participantCode, at: last.at } : null,
        })
      );
      for (const entry of applied.entries) {
        transaction.set(doc(collection(db, 'policy', 'competencyQ', 'updates'), entry.eventId), { ...plain(entry), serverAt: serverTimestamp() });
      }
      return applied;
    });
  },

  async appendLog(uid, entry) {
    await addDoc(collection(db, 'users', uid, 'courseLog'), plain(entry));
  },
};

/** `users/{uid}/assessmentSittings`, append-only. */
export const firebaseAssessmentRepository: AssessmentRepository = {
  async load(uid) {
    const snap = await getDocs(query(collection(db, 'users', uid, 'assessmentSittings'), orderBy('timestamp', 'asc')));
    return snap.docs.map(d => d.data() as AssessmentSitting);
  },
  async save(uid, sitting) {
    await addDoc(collection(db, 'users', uid, 'assessmentSittings'), plain(sitting));
  },
};

const backgroundDoc = (uid: string) => doc(db, 'users', uid, 'study', 'background');

/** `users/{uid}/study/background`, written once. */
export const firebaseBackgroundFormRepository: BackgroundFormRepository = {
  async load(uid) {
    const snap = await getDoc(backgroundDoc(uid));
    return snap.exists() ? (snap.data() as BackgroundResponse) : null;
  },
  async save(uid, response) {
    await setDoc(backgroundDoc(uid), plain(response));
  },
};
