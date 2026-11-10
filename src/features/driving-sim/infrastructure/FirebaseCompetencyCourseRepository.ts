/**
 * The per-competency course's store, adapted from
 * the groupmate's (arangkada-personal) to this repository's paths:
 *
 * - `users/{uid}/course/cursor`, `active`, `evidence` (the counter), `preTestSeed`;
 * - `users/{uid}/attempts/{id}` and `users/{uid}/courseQuizSittings/{id}`;
 * - `users/{uid}/courseLog/{auto}`;
 * - `q_tables/{table}` and `q_tables/{table}/updates/{eventId}`;
 * - `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates/{id}`.
 *
 * `firestore.rules` holds every one of them: a table change only with its log
 * entry, a record only with the counter that numbers it, a seed only with the
 * pre-test it comes from.
 */
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, writeBatch, type Transaction } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { CourseConflictError } from '@/features/driving-sim/application/errors';
import { COURSE_SCHEMA_VERSION, sameCursor, type CourseCursor } from '@/domain/competencyRouting/course';
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';
import { applyQLog, pairQOperations, statesOf } from '@/domain/study/qLog';
import type { EvidenceRecord, PreTestSeed } from '@/domain/study/evidence';
import type { BKTProfileDoc } from '@/domain/study/bktLog';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type {
  ActiveActivity,
  BKTLogRepository,
  CompetencyCourseRepository,
  CourseQuizSitting,
  EvidenceWrite,
  QTableId,
} from '@/features/driving-sim/application/ports';

/** Firestore takes no `undefined`: written values go through JSON first. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const courseDoc = (uid: string, id: 'cursor' | 'active' | 'evidence' | 'preTestSeed') => doc(db, 'users', uid, 'course', id);
const tableDoc = (table: QTableId) => doc(db, 'q_tables', table);
const recordDoc = (uid: string, evidence: EvidenceWrite) =>
  doc(db, 'users', uid, evidence.kind === 'attempt' ? 'attempts' : 'courseQuizSittings', evidence.id);

/** Every participant's step changes the same table, so a commit may be retried while others write. */
const MAX_COMMIT_ATTEMPTS = 12;

const storedCursor = (data: (CourseCursor & { updatedAt?: number }) | undefined): CourseCursor | null => {
  if (!data || data.schemaVersion !== COURSE_SCHEMA_VERSION) return null;
  const cursor: CourseCursor & { updatedAt?: number } = { ...data, quiz: data.quiz ?? null };
  delete cursor.updatedAt;
  return cursor;
};

const writeEvidence = (transaction: Transaction, uid: string, evidence: EvidenceWrite, evidenceSeq: number) => {
  const data = evidence.kind === 'attempt' ? evidence.attempt : evidence.sitting;
  transaction.set(recordDoc(uid, evidence), plain({ ...data, evidenceSeq }));
  transaction.set(courseDoc(uid, 'evidence'), { nextSeq: evidenceSeq + 1 });
};

export const firebaseCompetencyCourseRepository: CompetencyCourseRepository = {
  async loadCursor(uid) {
    const snap = await getDoc(courseDoc(uid, 'cursor'));
    return snap.exists() ? storedCursor(snap.data() as CourseCursor & { updatedAt?: number }) : null;
  },

  async loadQTable(table) {
    const snap = await getDoc(tableDoc(table));
    return snap.exists() ? ((snap.data().table as QTable) ?? emptyQTable()) : emptyQTable();
  },

  async loadEvidence(uid) {
    const [attempts, sittings] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'attempts')),
      getDocs(collection(db, 'users', uid, 'courseQuizSittings')),
    ]);
    return [
      ...attempts.docs.map((d): EvidenceRecord => {
        const a = d.data() as LevelAttempt & { evidenceSeq?: number };
        return { kind: 'attempt', levelId: a.levelId, attempt: null, evidenceSeq: a.evidenceSeq ?? null, timestamp: a.timestamp ?? 0, logs: a.logs ?? [], ref: d.id };
      }),
      ...sittings.docs.map((d): EvidenceRecord => {
        const s = d.data() as CourseQuizSitting & { evidenceSeq?: number };
        return { kind: 'quiz', levelId: s.levelId, attempt: s.attempt, evidenceSeq: s.evidenceSeq ?? null, timestamp: s.timestamp, logs: s.answers ?? [], ref: d.id };
      }),
    ];
  },

  async loadPreTestSeed(uid) {
    const snap = await getDoc(courseDoc(uid, 'preTestSeed'));
    return snap.exists() ? (snap.data() as PreTestSeed) : null;
  },

  async commitStep(uid, { table, expected, compute, context, envelope, evidence }) {
    return runTransaction(
      db,
      async transaction => {
        const [cursorSnap, tableSnap, counterSnap] = await Promise.all([
          transaction.get(courseDoc(uid, 'cursor')),
          transaction.get(tableDoc(table)),
          transaction.get(courseDoc(uid, 'evidence')),
        ]);
        const stored = cursorSnap.exists() ? storedCursor(cursorSnap.data() as CourseCursor & { updatedAt?: number }) : null;
        if (stored && !sameCursor(stored, plain(expected))) throw new CourseConflictError(stored);

        const current: QTable = tableSnap.exists() ? (tableSnap.data().table as QTable) : emptyQTable();
        const updates = tableSnap.exists() ? Number(tableSnap.data().updates ?? 0) : 0;
        const step = compute(current);
        const items = pairQOperations(step.operations, step.decisions, step.rewards);
        const applied = items.length > 0
          ? applyQLog({ table: current, items, firstGlobalSeq: updates + 1, context, envelope })
          : { table: current, entries: [] };

        let evidenceSeq: number | null = null;
        if (evidence) {
          evidenceSeq = counterSnap.exists() ? Number(counterSnap.data().nextSeq ?? 1) : 1;
          writeEvidence(transaction, uid, evidence, evidenceSeq);
        }
        if (applied.entries.length > 0) {
          const last = applied.entries.at(-1)!;
          transaction.set(tableDoc(table), plain({
            schemaVersion: 1,
            table: applied.table,
            updates: updates + applied.entries.length,
            updatedAt: Date.now(),
            states: statesOf(applied.table),
            configVersion: last.configVersion,
            lastUpdate: {
              updateId: last.eventId, globalSeq: last.globalSeq, kind: last.kind, uid: last.uid,
              participantCode: last.participantCode, at: last.at, configVersion: last.configVersion,
            },
          }));
          for (const entry of applied.entries) {
            transaction.set(doc(db, 'q_tables', table, 'updates', entry.eventId), { ...plain(entry), serverAt: serverTimestamp() });
          }
        }
        if (step.log) {
          transaction.set(doc(collection(db, 'users', uid, 'courseLog')), plain({ ...step.log, decisions: step.decisions, rewards: step.rewards, tableAfter: applied.table }));
        }
        transaction.set(courseDoc(uid, 'cursor'), plain({ ...step.cursor, updatedAt: Date.now() }));
        return { step, entries: applied.entries, table: applied.table, evidenceSeq };
      },
      { maxAttempts: MAX_COMMIT_ATTEMPTS }
    );
  },

  async openActivity(uid, fresh) {
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(courseDoc(uid, 'active'));
      const open = snap.exists() ? (snap.data() as ActiveActivity) : null;
      const activity: ActiveActivity =
        open && open.kind === fresh.kind && open.position === fresh.position ? { ...open, opens: open.opens + 1 } : { ...fresh, opens: 1 };
      transaction.set(courseDoc(uid, 'active'), plain(activity));
      return activity;
    });
  },
};

/** At most 500 writes go in one batch; a long backlog of BKT entries is written in parts. */
const BATCH_LIMIT = 450;

export const firebaseBKTLogRepository: BKTLogRepository = {
  async loadProfile(uid) {
    const snap = await getDoc(doc(db, 'users', uid, 'bkt', 'profile'));
    return snap.exists() ? (snap.data() as BKTProfileDoc) : null;
  },

  async save(uid, profile, entries) {
    for (let start = 0; start < entries.length; start += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const entry of entries.slice(start, start + BATCH_LIMIT)) {
        batch.set(doc(db, 'users', uid, 'bktUpdates', entry.eventId), { ...plain(entry), serverAt: serverTimestamp() });
      }
      // The profile goes with the last part, so it never claims entries not yet written.
      if (start + BATCH_LIMIT >= entries.length) batch.set(doc(db, 'users', uid, 'bkt', 'profile'), plain(profile));
      await batch.commit();
    }
  },
};
