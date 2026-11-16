/**
 * Resetting the shared Q-table (Admin > Q-learning, 2026-11-16).
 *
 * The table goes back to empty: every state unvisited, every value unlearned,
 * so the warm-up starts again from the first decision after it. Nothing is
 * lost. The table as it stood is kept whole at `policy/competencyQ/resets/{id}`
 * with who reset it, when and why; the update log is append-only and stays as
 * it is, and its counter is not reset either, so `fromGlobalSeq` marks the
 * first log entry that belongs to the fresh table. An analysis splits the log
 * there, the way it splits it by settings version.
 */
import { emptyQTable, type QTable } from '@/domain/competencyRouting/qLearning';

export interface QTableResetRecord {
  at: number;
  by: { uid: string; email: string | null };
  note: string;
  /** The update counter when the table was reset; the fresh table's first update is the next one. */
  updatesBefore: number;
  fromGlobalSeq: number;
  /** The table, its states and its settings versions exactly as they stood. */
  tableBefore: QTable;
  statesBefore: Record<string, unknown> | null;
  versionsBefore: Record<string, unknown> | null;
  configVersionBefore: string | null;
}

export const qTableResetIdAt = (at: number): string => `reset-${at}`;

/** The fields the table document changes to, and the record kept of what it was. */
export const qTableReset = (
  current: { table?: QTable; updates?: number; states?: Record<string, unknown> | null; versions?: Record<string, unknown> | null; configVersion?: string | null } | null,
  admin: { uid: string; email: string | null },
  note: string,
  at: number
): { resetId: string; record: QTableResetRecord; table: QTable } => {
  const updates = Number(current?.updates ?? 0);
  return {
    resetId: qTableResetIdAt(at),
    table: emptyQTable(),
    record: {
      at,
      by: admin,
      note: note.trim().slice(0, 500),
      updatesBefore: updates,
      fromGlobalSeq: updates + 1,
      tableBefore: current?.table ?? emptyQTable(),
      statesBefore: current?.states ?? null,
      versionsBefore: current?.versions ?? null,
      configVersionBefore: current?.configVersion ?? null,
    },
  };
};

/** Whether a table holds anything a reset would clear. */
export const tableIsEmpty = (table: QTable | null | undefined): boolean =>
  !table || Object.values(table).every(actions => Object.keys(actions ?? {}).length === 0);
