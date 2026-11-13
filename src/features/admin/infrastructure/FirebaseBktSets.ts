/**
 * The BKT value sets and pilot marks in Firestore (firestore.rules):
 * `bktCalibration/state`, `bktSets/cal-N`, `bktPilots/{uid}`,
 * `bktPilotLog/{id}`, and every player's `users/{uid}/bkt/profile` for the
 * set they run on.
 */
import { collection, collectionGroup, doc, getDoc, getDocs, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import { calibratedSetId, readCalibrationState, setIdOf } from '@/domain/learner/mastery/bktValueSets';
import type { BktSetsRepository } from '@/features/admin/application/ports';
import type { PilotLogEntry, PilotMark, SavedValueSet } from '@/features/admin/domain/bktSetsAdmin';

/** Firestore rejects `undefined` and NaN; a JSON round trip drops the one and turns the other into null. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const stateDoc = () => doc(db, 'bktCalibration', 'state');

export const firebaseBktSets: BktSetsRepository = {
  async load() {
    const [state, sets, pilots, log, profiles] = await Promise.all([
      getDoc(stateDoc()),
      getDocs(collection(db, 'bktSets')),
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

  async apply(record, expectedNumber, admin) {
    return runTransaction(db, async transaction => {
      const state = readCalibrationState((await transaction.get(stateDoc())).data());
      if (state.number !== expectedNumber) {
        throw new Error(`Calibration ${state.number} was applied while this page was open. Reload and calibrate again.`);
      }
      const number = state.number + 1;
      const setId = calibratedSetId(number);
      const appliedAt = Date.now();
      const saved: SavedValueSet = plain({ ...record, setId, number, appliedAt, appliedBy: admin.uid, appliedByEmail: admin.email });
      transaction.set(doc(db, 'bktSets', setId), saved);
      transaction.set(stateDoc(), { activeSetId: setId, number, appliedAt, appliedBy: admin.uid });
      return saved;
    });
  },
};
