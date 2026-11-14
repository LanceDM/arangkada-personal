/**
 * The BKT value sets and pilot marks in Firestore (firestore.rules):
 * `bktCalibration/state`, `bktSets/cal-N` (the values, which players read),
 * `bktSetLogs/cal-N` (the full log, admins only), `bktPilots/{uid}`,
 * `bktPilotLog/{id}`, and every player's `users/{uid}/bkt/profile` for the
 * set they run on.
 */
import { collection, collectionGroup, doc, getDoc, getDocs, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { calibratedSetId, editedStartSetId, readCalibrationState, setIdOf } from '@/domain/learner/mastery/bktValueSets';
import type { BktSetsRepository } from '@/features/admin/application/ports';
import type { PilotLogEntry, PilotMark, SavedValueSet, ValueSetRecord } from '@/features/admin/domain/bktSetsAdmin';

/** Firestore rejects `undefined` and NaN; a JSON round trip drops the one and turns the other into null. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const stateDoc = () => doc(db, 'bktCalibration', 'state');

/**
 * Saves a set and points new players at it, in one transaction: the values
 * (`bktSets`, which players read), the log (`bktSetLogs`, admins only) and the
 * state. Refused when another set was saved since `expectedNumber` was read.
 */
const saveSet = (record: ValueSetRecord, idOf: (number: number) => string, expectedNumber: number, admin: { uid: string; email: string | null }) =>
  runTransaction(db, async transaction => {
    const state = readCalibrationState((await transaction.get(stateDoc())).data());
    if (state.number !== expectedNumber) {
      throw new Error(`${state.number === 0 ? 'A value set' : `Set ${state.number}`} was saved while this page was open. Reload and try again.`);
    }
    const number = state.number + 1;
    const setId = idOf(number);
    const appliedAt = Date.now();
    const saved = plain({ ...record, setId, number, appliedAt, appliedBy: admin.uid, appliedByEmail: admin.email }) as SavedValueSet;
    // Players read the values only; the log, with names in it, is the admins'.
    transaction.set(doc(db, 'bktSets', setId), { setId, number, model: saved.model, appliedAt });
    transaction.set(doc(db, 'bktSetLogs', setId), saved);
    transaction.set(stateDoc(), { activeSetId: setId, number, appliedAt, appliedBy: admin.uid });
    return saved;
  });

export const firebaseBktSets: BktSetsRepository = {
  async load() {
    const [state, sets, pilots, log, profiles] = await Promise.all([
      getDoc(stateDoc()),
      getDocs(collection(db, 'bktSetLogs')),
      getDocs(collection(db, 'bktPilots')),
      getDocs(collection(db, 'bktPilotLog')),
      getDocs(collectionGroup(db, 'bkt')),
    ]);
    const playerSets: Record<string, string> = {};
    for (const d of profiles.docs) {
      if (d.id !== 'profile') continue;
      const uid = d.ref.parent.parent?.id;
      if (uid) playerSets[uid] = setIdOf(d.data().modelSet as string | undefined);
    }
    return {
      state: readCalibrationState(state.data()),
      sets: sets.docs.map(d => d.data() as SavedValueSet).sort((a, b) => a.number - b.number),
      pilots: pilots.docs.map(d => d.data() as PilotMark),
      pilotLog: log.docs.map(d => d.data() as PilotLogEntry).sort((a, b) => b.at - a.at),
      playerSets,
    };
  },

  async setPilot(player, on, adminUid) {
    const at = Date.now();
    const batch = writeBatch(db);
    const mark = doc(db, 'bktPilots', player.uid);
    if (on) batch.set(mark, { uid: player.uid, label: player.label, markedAt: at, markedBy: adminUid });
    else batch.delete(mark);
    batch.set(doc(collection(db, 'bktPilotLog')), { uid: player.uid, label: player.label, action: on ? 'marked' : 'unmarked', at, by: adminUid });
    await batch.commit();
  },

  apply: (record, expectedNumber, admin) => saveSet(record, calibratedSetId, expectedNumber, admin),

  editStart: (record, expectedNumber, admin) => saveSet(record, editedStartSetId, expectedNumber, admin),
};
