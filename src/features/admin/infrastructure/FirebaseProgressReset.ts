/**
 * Resets an account's course in Firestore (domain/progressReset.ts): copies
 * every record the reset clears to `users/{uid}/archive/{resetId}/...`, then
 * removes the originals. The archive record is written first, as `copying`,
 * and marked `done` last, so an interrupted reset is visible and can be run
 * again (copies are idempotent: same path, same data).
 */
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { ProgressResetRepository } from '@/features/admin/application/ports';
import {
  ATTEMPT_TELEMETRY,
  RESET_COLLECTIONS,
  RESET_DOCUMENTS,
  RESET_SITTING_KINDS,
  resetIdAt,
  type ProgressResetRecord,
  type ResetCounts,
} from '@/features/admin/domain/progressReset';

/** Firestore allows 500 writes a batch; stay under it. */
const BATCH = 400;

interface Move {
  from: DocumentReference;
  /** The path under the archive, e.g. `attempts/abc` or `attempts/abc/telemetry/fsm`. */
  to: string[];
  data: Record<string, unknown>;
}

const runInBatches = async (refsAndWrites: ((batch: ReturnType<typeof writeBatch>) => void)[]) => {
  for (let i = 0; i < refsAndWrites.length; i += BATCH) {
    const batch = writeBatch(db);
    refsAndWrites.slice(i, i + BATCH).forEach(write => write(batch));
    await batch.commit();
  }
};

const collect = async (uid: string): Promise<{ moves: Move[]; counts: ResetCounts }> => {
  const moves: Move[] = [];
  const counts: ResetCounts = {};
  const add = (kind: string, move: Move) => {
    moves.push(move);
    counts[kind] = (counts[kind] ?? 0) + 1;
  };

  for (const name of RESET_COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', uid, name));
    for (const record of snap.docs) {
      add(name, { from: record.ref, to: [name, record.id], data: record.data() });
      if (name === 'attempts') {
        for (const kind of ATTEMPT_TELEMETRY) {
          const telemetry = await getDoc(doc(db, 'users', uid, 'attempts', record.id, 'telemetry', kind));
          if (telemetry.exists()) add('attempts/telemetry', { from: telemetry.ref, to: ['attempts', record.id, 'telemetry', kind], data: telemetry.data() });
        }
      }
    }
  }

  const sittings = await getDocs(collection(db, 'users', uid, 'assessmentSittings'));
  for (const sitting of sittings.docs) {
    if ((RESET_SITTING_KINDS as readonly string[]).includes(String(sitting.data().kind))) {
      add('assessmentSittings (quiz)', { from: sitting.ref, to: ['assessmentSittings', sitting.id], data: sitting.data() });
    }
  }

  for (const [name, id] of RESET_DOCUMENTS) {
    const single = await getDoc(doc(db, 'users', uid, name, id));
    if (single.exists()) add(`${name}/${id}`, { from: single.ref, to: [name, id], data: single.data() });
  }
  return { moves, counts };
};

export const firebaseProgressReset: ProgressResetRepository = {
  async isEnrolled(uid) {
    const [enrolment, profile] = await Promise.all([getDoc(doc(db, 'users', uid, 'study', 'enrolment')), getDoc(doc(db, 'users', uid))]);
    return enrolment.exists() || typeof profile.data()?.participantCode === 'string';
  },

  async reset(uid, admin, note) {
    const at = Date.now();
    const resetId = resetIdAt(at);
    const recordRef = doc(db, 'users', uid, 'archive', resetId);
    const { moves, counts } = await collect(uid);
    const record: ProgressResetRecord = {
      schemaVersion: 1,
      kind: 'progress_reset',
      uid,
      status: 'copying',
      at,
      finishedAt: null,
      by: { uid: admin.uid, email: admin.email },
      note: note.trim().slice(0, 500),
      counts,
    };
    await setDoc(recordRef, record);
    // Copy everything first; remove only once every copy is saved.
    await runInBatches(moves.map(move => batch => batch.set(doc(recordRef, ...(move.to as [string, ...string[]])), move.data)));
    // Telemetry before its drive, so no removed drive is left with a document under it.
    const removals = [...moves].sort((a, b) => b.to.length - a.to.length);
    await runInBatches(removals.map(move => batch => batch.delete(move.from)));
    const finishedAt = Date.now();
    await updateDoc(recordRef, { status: 'done', finishedAt });
    return { ...record, status: 'done', finishedAt, resetId };
  },

  async history(uid) {
    const snap = await getDocs(collection(db, 'users', uid, 'archive'));
    return snap.docs
      .map(d => ({ ...(d.data() as ProgressResetRecord), resetId: d.id }))
      .filter(record => record.kind === 'progress_reset')
      .sort((a, b) => b.at - a.at);
  },
};
