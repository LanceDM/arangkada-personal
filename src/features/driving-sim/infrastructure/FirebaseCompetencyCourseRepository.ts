import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, setDoc, type DocumentSnapshot, type Transaction } from 'firebase/firestore';
import { CourseConflictError, OutdatedAppError } from '@/features/driving-sim/application/errors';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { db } from '@/shared/infrastructure/firebase/client';
import { COURSE_SCHEMA_VERSION, sameCursor, type CourseCursor } from '@/domain/competencyRouting/course';
import { applyQLog, pairQOperations, statesOf } from '@/domain/study/qLog';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import type {
  AssessmentRepository,
  ActiveActivity,
  AssessmentSitting,
  BackgroundFormRepository,
  CompetencyCourseRepository,
  EvidenceWrite,
} from '@/features/driving-sim/application/ports';
import type { BackgroundResponse } from '@/domain/study/backgroundForm';

/** Firestore rejects `undefined`; every payload here is plain data, so a JSON round trip drops it. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cursorDoc = (uid: string) => doc(db, 'users', uid, 'routing', 'competencyCourse');
const tableDoc = () => doc(db, 'policy', 'competencyQ');
const configDoc = () => doc(db, 'policy', 'config');
const evidenceCounterDoc = (uid: string) => doc(db, 'users', uid, 'state', 'evidence');
const activeDoc = (uid: string) => doc(db, 'users', uid, 'state', 'active');
const recordDoc = (uid: string, evidence: EvidenceWrite) =>
  doc(db, 'users', uid, evidence.kind === 'attempt' ? 'attempts' : 'assessmentSittings', evidence.id);

/** How often a step is retried when other participants keep changing the table under it. */
const MAX_COMMIT_ATTEMPTS = 12;

const storedCursor = (data: (CourseCursor & { updatedAt?: number }) | undefined): CourseCursor | null => {
  if (!data || data.schemaVersion !== COURSE_SCHEMA_VERSION) return null;
  const cursor: CourseCursor & { updatedAt?: number } = { ...data, quiz: data.quiz ?? null };
  delete cursor.updatedAt;
  return cursor;
};

/** The settings version in force must be this app's: an old tab writes nothing. */
const requireCurrentSettings = (config: DocumentSnapshot) => {
  const tag = config.exists() ? (config.data().tag as string | undefined) : undefined;
  if (!tag) throw new Error('The database has no settings version (policy/config): run npm run db:init.');
  if (tag !== RUN_CONFIG_VERSION) throw new OutdatedAppError(RUN_CONFIG_VERSION, tag);
};

const nextEvidenceSeq = (counter: DocumentSnapshot): number => (counter.exists() ? Number(counter.data().nextSeq ?? 1) : 1);

/** Writes a record of graded answers with its evidence number, and moves the counter on. */
const writeEvidence = (transaction: Transaction, uid: string, evidence: EvidenceWrite, evidenceSeq: number) => {
  const data = evidence.kind === 'attempt' ? evidence.attempt : evidence.sitting;
  transaction.set(recordDoc(uid, evidence), plain({ ...data, evidenceSeq, savedAt: serverTimestamp() }));
  transaction.set(evidenceCounterDoc(uid), { nextSeq: evidenceSeq + 1 });
};

/**
 * `users/{uid}/routing/competencyCourse`, `users/{uid}/courseLog`, and the
 * shared table at `policy/competencyQ` with its log.
 *
 * Every course step is one transaction: the participant's cursor is compared
 * with the one the step started from, the settings version with the one in
 * force, the decisions are taken on the table as it is inside the transaction,
 * and the step's record (drive or sitting), the table, its log, the
 * course-log entry and the cursor are written together. Firestore retries the
 * transaction when another participant changed the table first, so updates are
 * applied one after another in `globalSeq` order and none is lost; a step from
 * a stale cursor (a second tab, a double submit, a retry after a lost reply)
 * is refused and writes nothing.
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

  async commitStep(uid, { expected, compute, context, envelope, evidence }) {
    return runTransaction(
      db,
      async transaction => {
        const [cursorSnap, tableSnap, configSnap, counterSnap] = await Promise.all([
          transaction.get(cursorDoc(uid)),
          transaction.get(tableDoc()),
          transaction.get(configDoc()),
          transaction.get(evidenceCounterDoc(uid)),
        ]);
        requireCurrentSettings(configSnap);
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

        let evidenceSeq: number | null = null;
        if (evidence) {
          evidenceSeq = nextEvidenceSeq(counterSnap);
          writeEvidence(transaction, uid, evidence, evidenceSeq);
        }
        if (applied.entries.length > 0) {
          const last = applied.entries.at(-1)!;
          // The table is never reset: each settings version is recorded with the
          // first update made under it, so the log can be split by version.
          const versions = { ...((tableSnap.exists() ? tableSnap.data().versions : null) ?? {}) } as Record<string, { fromGlobalSeq: number; firstAt: number }>;
          if (!versions[RUN_CONFIG_VERSION]) versions[RUN_CONFIG_VERSION] = { fromGlobalSeq: updates + 1, firstAt: Date.now() };
          transaction.set(
            tableDoc(),
            plain({
              schemaVersion: 1,
              table: applied.table,
              updates: updates + applied.entries.length,
              updatedAt: Date.now(),
              states: statesOf(applied.table),
              configVersion: RUN_CONFIG_VERSION,
              versions,
              lastUpdate: {
                updateId: last.eventId, globalSeq: last.globalSeq, kind: last.kind, uid: last.uid,
                participantCode: last.participantCode, at: last.at, configVersion: last.configVersion,
              },
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
        return { step, entries: applied.entries, table: applied.table, evidenceSeq };
      },
      { maxAttempts: MAX_COMMIT_ATTEMPTS }
    );
  },

  async saveEvidence(uid, evidence) {
    return runTransaction(db, async transaction => {
      const [configSnap, counterSnap, existing] = await Promise.all([
        transaction.get(configDoc()),
        transaction.get(evidenceCounterDoc(uid)),
        transaction.get(recordDoc(uid, evidence)),
      ]);
      requireCurrentSettings(configSnap);
      if (existing.exists()) return 'exists' as const;
      writeEvidence(transaction, uid, evidence, nextEvidenceSeq(counterSnap));
      return 'saved' as const;
    });
  },

  async openActivity(uid, fresh) {
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(activeDoc(uid));
      const open = snap.exists() ? (snap.data() as ActiveActivity) : null;
      const activity: ActiveActivity =
        open && open.kind === fresh.kind && open.position === fresh.position ? { ...open, opens: open.opens + 1 } : { ...fresh, opens: 1 };
      transaction.set(activeDoc(uid), plain(activity));
      return activity;
    });
  },
};

/** `users/{uid}/assessmentSittings`: written with their step (see commitStep and saveEvidence), never changed. */
export const firebaseAssessmentRepository: AssessmentRepository = {
  async load(uid) {
    const snap = await getDocs(query(collection(db, 'users', uid, 'assessmentSittings'), orderBy('timestamp', 'asc')));
    return snap.docs.map(d => ({ ...(d.data() as AssessmentSitting), id: d.id }));
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
