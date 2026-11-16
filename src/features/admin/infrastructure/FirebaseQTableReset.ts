/**
 * Resets the shared Q-table in Firestore (domain/qTableReset.ts). One
 * transaction: the table as it stood is written to
 * `policy/competencyQ/resets/{resetId}`, and the table document is emptied
 * with `lastReset` naming that record. The rules accept the emptied table only
 * from an admin, only with its update counter unchanged, and only with the
 * reset record written in the same transaction.
 */
import { collection, doc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { QTableResetRepository } from '@/features/admin/application/ports';
import { qTableReset, type QTableResetRecord } from '@/features/admin/domain/qTableReset';
import { statesOf } from '@/domain/study/qLog';

const tableDoc = () => doc(db, 'policy', 'competencyQ');
const resetDoc = (resetId: string) => doc(db, 'policy', 'competencyQ', 'resets', resetId);

/** Firestore takes no undefined values. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const firebaseQTableReset: QTableResetRepository = {
  async reset(admin, note) {
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(tableDoc());
      const current = snap.exists() ? snap.data() : null;
      const at = Date.now();
      const { resetId, record, table } = qTableReset(current, admin, note, at);
      transaction.set(resetDoc(resetId), plain(record));
      transaction.set(
        tableDoc(),
        plain({
          ...(current ?? {}),
          schemaVersion: 1,
          table,
          // The log's counter carries on: the fresh table's first update is fromGlobalSeq.
          updates: record.updatesBefore,
          updatedAt: at,
          states: statesOf(table),
          lastReset: { resetId, at, fromGlobalSeq: record.fromGlobalSeq, by: admin.uid },
        })
      );
      return { ...record, resetId };
    });
  },

  async history() {
    const snap = await getDocs(query(collection(db, 'policy', 'competencyQ', 'resets'), orderBy('at', 'desc')));
    return snap.docs.map(entry => ({ ...(entry.data() as QTableResetRecord), resetId: entry.id }));
  },
};
