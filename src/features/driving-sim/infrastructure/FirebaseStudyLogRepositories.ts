/**
 * Implementation A (Firestore) of the study logs:
 *
 * - `users/{uid}/events/{eventId}`, numbered from `users/{uid}/state/events`;
 * - `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates/{updateId}`;
 * - `users/{uid}/surveys/{instrument}`.
 *
 * Every document id is the record's own `eventId`, made on the device, so a
 * retried write overwrites itself instead of adding a duplicate.
 */
import { collection, doc, getDoc, runTransaction, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { BKTProfileDoc } from '@/domain/study/bktLog';
import type { SurveyResponse } from '@/domain/study/survey';
import type {
  BKTLogRepository,
  StudyEventRepository,
  SurveyRepository,
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
  async record(uid, profile, entries) {
    const parts = entries.length === 0 ? [[]] : chunks(entries);
    for (const [i, part] of parts.entries()) {
      const batch = writeBatch(db);
      part.forEach(entry => batch.set(doc(collection(db, 'users', uid, 'bktUpdates'), entry.eventId), { ...plain(entry), serverAt: serverTimestamp() }));
      // The profile goes with the last chunk, so it never runs ahead of the log.
      if (i === parts.length - 1) batch.set(profileDoc(uid), plain(profile));
      await batch.commit();
    }
  },
};

export const firebaseSurveyRepository: SurveyRepository = {
  async load(uid, instrument) {
    const snap = await getDoc(doc(db, 'users', uid, 'surveys', instrument));
    return snap.exists() ? (snap.data() as SurveyResponse) : null;
  },
  async save(uid, response) {
    await setDoc(doc(db, 'users', uid, 'surveys', response.instrument), plain(response));
  },
};
