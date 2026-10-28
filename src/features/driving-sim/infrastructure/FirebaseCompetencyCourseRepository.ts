import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { COURSE_SCHEMA_VERSION, applyQOperations, type CourseCursor } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import type {
  AssessmentRepository,
  AssessmentSitting,
  CompetencyCourseRepository,
} from '@/features/driving-sim/application/ports';

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

  async applyQOperations(operations) {
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(tableDoc());
      const current: QTable = snap.exists() ? (snap.data().table as QTable) : emptyQTable();
      const updates = snap.exists() ? Number(snap.data().updates ?? 0) : 0;
      const next = applyQOperations(current, operations);
      transaction.set(tableDoc(), plain({ schemaVersion: 1, table: next, updates: updates + operations.length, updatedAt: Date.now() }));
      return next;
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
