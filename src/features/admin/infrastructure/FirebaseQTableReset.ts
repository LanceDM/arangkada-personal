/**
 * Resets one Q-table in Firestore (domain/qTableReset.ts). One transaction:
 * the table as it stood is written to `policy/{table}/resets/{resetId}`, and
 * the table document is emptied, or started from a copy of the study's table,
 * with `lastReset` naming that record. The rules accept it only from an admin,
 * only with the table's update counter unchanged, and only with the reset
 * record written in the same transaction.
 */
import { collection, doc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/client';
import type { QTableResetRepository } from '@/features/admin/application/ports';
import { qTableReset, type QTableResetRecord } from '@/features/admin/domain/qTableReset';
import { qTableDocId, type QTableId } from '@/domain/competencyRouting/qTables';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import { statesOf } from '@/domain/study/qLog';

const tableDoc = (id: QTableId) => doc(db, 'policy', qTableDocId(id));
const resetDoc = (id: QTableId, resetId: string) => doc(db, 'policy', qTableDocId(id), 'resets', resetId);

/** Firestore takes no undefined values. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const firebaseQTableReset: QTableResetRepository = {
  async reset(tableId, admin, note, start = 'empty') {
    if (start === 'study' && tableId === 'study') throw new Error('The study table cannot start from itself.');
    return runTransaction(db, async transaction => {
      const snap = await transaction.get(tableDoc(tableId));
      const source = start === 'study' ? await transaction.get(tableDoc('study')) : null;
      const current = snap.exists() ? snap.data() : null;
      const at = Date.now();
      const copied = source?.exists() ? ((source.data().table as QTable) ?? null) : null;
      const { resetId, record, table } = qTableReset(current, admin, note, at, { from: start, table: copied });
      transaction.set(resetDoc(tableId, resetId), plain(record));
      transaction.set(
        tableDoc(tableId),
        plain({
          ...(current ?? {}),
          schemaVersion: 1,
          table,
          // The log's counter carries on: the fresh table's first update is fromGlobalSeq.
          updates: record.updatesBefore,
          updatedAt: at,
          states: statesOf(table),
          lastReset: { resetId, at, fromGlobalSeq: record.fromGlobalSeq, by: admin.uid, startedFrom: start },
        })
      );
      return { ...record, resetId };
    });
  },

  async history(tableId) {
    const snap = await getDocs(query(collection(db, 'policy', qTableDocId(tableId), 'resets'), orderBy('at', 'desc')));
    return snap.docs.map(entry => ({ ...(entry.data() as QTableResetRecord), resetId: entry.id }));
  },
};
