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
  BKTValueSetRepository,
  StudyEventRepository,
} from '@/features/driving-sim/application/ports';
import type { BKTModel } from '@/domain/learner/mastery/buildBKTProfile';
import { NO_CALIBRATION, readCalibrationState, readModel, type BKTCalibrationState } from '@/domain/learner/mastery/bktValueSets';

/** Firestore rejects `undefined`; every payload here is plain data, so a JSON round trip drops it. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Firestore allows 500 writes per batch or transaction; leave room for the counter and profile. */
const CHUNK = 400;
const chunks = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

const counterDoc = (uid: string) => doc(db, 'users', uid, 'state', 'events');
const eventDoc = (uid: string, eventId: string) => doc(collection(db, 'users', uid, 'events'), eventId);

/**
 * One append at a time per account. Two appends at once (an answer and a
 * button logged in the same moment) contend for the same counter, and a
 * transaction that loses five times gives up, which left those events without
 * a sequence number (db:validate, 2026-11-10). Queued, each append reads the
 * counter the previous one wrote; offline is then the only fallback.
 */
const queues = new Map<string, Promise<void>>();
const inTurn = (uid: string, work: () => Promise<void>): Promise<void> => {
  const next = (queues.get(uid) ?? Promise.resolve()).then(work, work);
  queues.set(uid, next.catch(() => {}));
  return next;
};

export const firebaseStudyEventRepository: StudyEventRepository = {
  append: (uid, events) => inTurn(uid, () => appendNow(uid, events)),
};

const appendNow = async (uid: string, events: Parameters<StudyEventRepository['append']>[1]): Promise<void> => {
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

/**
 * The BKT value sets (bktValueSets): `bktCalibration/state` names the set new
 * players get, `bktSets/{setId}` holds each applied calibration. A saved set
 * never changes, so it is read once per load of the app; the state is read
 * again at most every 30 seconds.
 */
const STATE_TTL_MS = 30_000;
let stateCache: { at: number; value: Promise<BKTCalibrationState> } | null = null;
const setCache = new Map<string, Promise<BKTModel | null>>();

export const firebaseBKTValueSets: BKTValueSetRepository = {
  state() {
    const now = Date.now();
    if (!stateCache || now - stateCache.at > STATE_TTL_MS) {
      const value = getDoc(doc(db, 'bktCalibration', 'state')).then(
        snap => readCalibrationState(snap.data()),
        // Before the rules for the value sets are deployed nothing can read
        // them, and nothing can have been applied either: no calibration yet.
        (failure: unknown) => {
          if ((failure as { code?: string } | null)?.code === 'permission-denied') return NO_CALIBRATION;
          throw failure;
        }
      );
      stateCache = { at: now, value };
      value.catch(() => {
        stateCache = null;
      });
    }
    return stateCache.value;
  },
  load(setId) {
    let cached = setCache.get(setId);
    if (!cached) {
      cached = getDoc(doc(db, 'bktSets', setId)).then(snap => (snap.exists() ? readModel(snap.data().model) : null));
      setCache.set(setId, cached);
      cached.catch(() => setCache.delete(setId));
    }
    return cached;
  },
};
