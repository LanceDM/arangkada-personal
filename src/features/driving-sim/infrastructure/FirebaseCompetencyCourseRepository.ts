import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { CourseConflictError } from '@/features/driving-sim/application/errors';
import { db } from '@/shared/infrastructure/firebase/client';
import { COURSE_SCHEMA_VERSION, sameCursor, type CourseCursor } from '@/domain/competencyRouting/course';
import { applyQLog, pairQOperations, statesOf } from '@/domain/study/qLog';
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

/** How often a step is retried when other participants keep changing the table under it. */
const MAX_COMMIT_ATTEMPTS = 12;

const storedCursor = (data: (CourseCursor & { updatedAt?: number }) | undefined): CourseCursor | null => {
  if (!data || data.schemaVersion !== COURSE_SCHEMA_VERSION) return null;
  const cursor: CourseCursor & { updatedAt?: number } = { ...data, quiz: data.quiz ?? null };
  delete cursor.updatedAt;
  return cursor;
};

/**
 * `users/{uid}/routing/competencyCourse`, `users/{uid}/courseLog`, and the
 * shared table at `policy/competencyQ` with its log.
 *
 * Every course step is one transaction: the participant's cursor is compared
 * with the one the step started from, the decisions are taken on the table as
 * it is inside the transaction, and the table, its log, the course-log entry
 * and the cursor are written together. Firestore retries the transaction when
 * another participant changed the table first, so updates are applied one
 * after another in `globalSeq` order and none is lost; a step from a stale
 * cursor (a second tab, a double submit) is refused and writes nothing.
 */
export const firebaseCompetencyCourseRepository: CompetencyCourseRepository = {
  async loadCursor(uid) {
    const snap = await getDoc(cursorDoc(uid));
    return snap.exists() ? storedCursor(snap.data() as CourseCursor & { updatedAt?: number }) : null;
  },

  async loadQTable() {
    const snap = await getDoc(tableDoc());
    return snap.exists() ? ((snap.data().table as QTable) ?? emptyQTable()) : emptyQTable();
  },

  async commitStep(uid, { expected, compute, context, envelope }) {
    return runTransaction(
      db,
      async transaction => {
        const [cursorSnap, tableSnap] = await Promise.all([transaction.get(cursorDoc(uid)), transaction.get(tableDoc())]);
        const stored = cursorSnap.exists() ? storedCursor(cursorSnap.data() as CourseCursor & { updatedAt?: number }) : null;
        // No stored cursor yet: the course starts here. Otherwise it must be
        // exactly the cursor this step was computed from.
        if (stored && !sameCursor(stored, plain(expected))) throw new CourseConflictError(stored);

        const current: QTable = tableSnap.exists() ? (tableSnap.data().table as QTable) : emptyQTable();
        const updates = tableSnap.exists() ? Number(tableSnap.data().updates ?? 0) : 0;
        const step = compute(current);
        const items = pairQOperations(step.operations, step.decisions, step.rewards);
        const applied =
          items.length > 0
            ? applyQLog({ table: current, items, firstGlobalSeq: updates + 1, context, envelope })
            : { table: current, entries: [] };

        if (applied.entries.length > 0) {
          const last = applied.entries.at(-1)!;
          transaction.set(
            tableDoc(),
            plain({
              schemaVersion: 1,
              table: applied.table,
              updates: updates + applied.entries.length,
              updatedAt: Date.now(),
              states: statesOf(applied.table),
              lastUpdate: { updateId: last.eventId, globalSeq: last.globalSeq, kind: last.kind, uid: last.uid, participantCode: last.participantCode, at: last.at },
            })
          );
          for (const entry of applied.entries) {
            transaction.set(doc(collection(db, 'policy', 'competencyQ', 'updates'), entry.eventId), { ...plain(entry), serverAt: serverTimestamp() });
          }
        }
        if (step.log) {
          transaction.set(
            doc(collection(db, 'users', uid, 'courseLog')),
            plain({ ...step.log, decisions: step.decisions, rewards: step.rewards, tableAfter: applied.table })
          );
        }
        transaction.set(cursorDoc(uid), plain({ ...step.cursor, updatedAt: Date.now() }));
        return { step, entries: applied.entries, table: applied.table };
      },
      { maxAttempts: MAX_COMMIT_ATTEMPTS }
    );
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
