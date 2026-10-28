/**
 * Implementation A (Firestore) of the study logs:
 *
 * - `users/{uid}/events/{eventId}`, numbered from `users/{uid}/state/events`;
 * - `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates/{updateId}`.
 *
 * Every document id is the record's own `eventId`: made on the device for
 * events, fixed (`{settings version}_{userSeq}`) for BKT entries, so a second
 * writer of the same entry is refused instead of adding a duplicate.
 */
import { collection, doc, getDoc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { BKTProfileDoc } from '@/domain/study/bktLog';
import type {
  BKTLogRepository,
  StudyEventRepository,
} from '@/features/driving-sim/application/ports';

/** Firestore rejects `undefined`; every payload here is plain data, so a JSON round trip drops it. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Firestore allows 500 writes per batch or transaction; leave room for the counter and profile. */
const CHUNK = 400;
const chunks = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

const counterDoc = (uid: string) => doc(db, 'users', uid, 'state', 'events');
const eventDoc = (uid: string, eventId: string) => doc(collection(db, 'users', uid, 'events'), eventId);

export const firebaseStudyEventRepository: StudyEventRepository = {
  async append(uid, events) {
    for (const part of chunks(events)) {
      try {
        await runTransaction(db, async transaction => {
          const snap = await transaction.get(counterDoc(uid));
          const next = snap.exists() ? Number(snap.data().nextSeq ?? 1) : 1;
          part.forEach((event, i) => {
            transaction.set(eventDoc(uid, event.eventId), { ...plain({ ...event, seq: next + i }), serverAt: serverTimestamp() });
          });
          transaction.set(counterDoc(uid), { nextSeq: next + part.length, updatedAt: Date.now() });
        });
      } catch (failure) {
        // A transaction needs the network. Offline, the events still go in a
        // batch (Firestore queues it) without a sequence number; the replay
        // orders those by device time and event id.
        console.warn('Event counter unreachable; writing events without seq.', failure);
        const batch = writeBatch(db);
        part.forEach(event => batch.set(eventDoc(uid, event.eventId), { ...plain({ ...event, seq: null }), serverAt: serverTimestamp() }));
        await batch.commit();
      }
    }
  },
};

const profileDoc = (uid: string) => doc(db, 'users', uid, 'bkt', 'profile');

export const firebaseBKTLogRepository: BKTLogRepository = {
  async loadProfile(uid) {
    const snap = await getDoc(profileDoc(uid));
    return snap.exists() ? (snap.data() as BKTProfileDoc) : null;
  },
  /**
   * Each entry's id is fixed: `{settings version}_{userSeq}`. Each chunk is a
   * transaction that first checks its first and last entry are not there yet;
   * when another tab already wrote them, it writes nothing and the call
   * reports 'skipped' (the other tab wrote the same entries, from the same
   * answers). The profile goes with the last chunk, so it never runs ahead of
   * the log.
   */
  async record(uid, profile, entries) {
    const entryDoc = (id: string) => doc(collection(db, 'users', uid, 'bktUpdates'), id);
    const parts = entries.length === 0 ? [[]] : chunks(entries);
    for (const [i, part] of parts.entries()) {
      const written = await runTransaction(db, async transaction => {
        const ends = part.length === 0 ? [] : [...new Set([part[0].eventId, part.at(-1)!.eventId])];
        const found = await Promise.all(ends.map(id => transaction.get(entryDoc(id))));
        if (found.some(snap => snap.exists())) return false;
        part.forEach(entry => transaction.set(entryDoc(entry.eventId), { ...plain(entry), serverAt: serverTimestamp() }));
        if (i === parts.length - 1) transaction.set(profileDoc(uid), plain(profile));
        return true;
      });
      if (!written) return 'skipped';
    }
    return 'written';
  },
};
