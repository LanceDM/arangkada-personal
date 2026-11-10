/**
 * The Q-learning mapping's data: the Optimized group's table as the game
 * reads it, and the pool accounts from the records store, read once per tab
 * like every section's. A choice is read from the attempt's routing record,
 * which the store already holds; nothing more is read.
 */
import { useMemo } from 'react';
import { qChoices, qDimensionLabels, qGrid, qPoolVisits, type QPoolAccount } from '@/features/admin/domain/qMapping';
import { routingGraph } from '@/features/admin/domain/routingGraph';
import { useDesignatedTable } from './useDesignatedTable';
import { usePilotRecords } from './usePilotRecords';

export type QMappingView = 'table' | 'participant' | 'pool';

export interface QMappingSelection {
  view: QMappingView;
  /** The pool account, by code: an Optimized one. */
  code: string | null;
}

export const useQMapping = (enabled: boolean, selection: QMappingSelection, select: (next: QMappingSelection) => void) => {
  const records = usePilotRecords(enabled);
  const designated = useDesignatedTable(enabled);
  const table = designated.status === 'ready' ? designated.table : null;
  const graph = useMemo(() => routingGraph(), []);
  const grid = useMemo(() => (table ? qGrid(table.table) : []), [table]);
  const labels = useMemo(() => (table ? qDimensionLabels(table.budgetSize) : null), [table]);

  const accounts = useMemo<QPoolAccount[]>(
    () =>
      (records.snapshot?.accounts ?? []).flatMap(account =>
        account.source && account.exported
          ? [{ code: account.code, cohort: account.cohort, group: account.exported.row.group, attempts: account.source.attempts }]
          : []
      ),
    [records.snapshot]
  );
  const optimized = useMemo(() => accounts.filter(account => account.group === 'optimized'), [accounts]);
  const account = useMemo(() => optimized.find(entry => entry.code === selection.code) ?? null, [optimized, selection.code]);
  const choices = useMemo(() => (account && table ? qChoices(account.attempts, table, graph) : null), [account, table, graph]);
  const pool = useMemo(() => (table ? qPoolVisits(accounts, table, graph) : null), [accounts, table, graph]);
  const { refresh } = records;

  return {
    view: selection.view,
    records: {
      loading: records.loading,
      progress: records.progress,
      error: records.error,
      readAt: records.snapshot?.readAt ?? null,
      refresh: () => void refresh(),
    },
    designated,
    grid,
    labels,
    /** The Optimized group's pool accounts: the only ones whose moves the table decides. */
    accounts: optimized.map(entry => ({ code: entry.code, cohort: entry.cohort })),
    account: account && { code: account.code, cohort: account.cohort },
    choices,
    pool,
    selectView: (view: QMappingView) => select({ ...selection, view }),
    selectAccount: (code: string | null) => select({ view: 'participant', code }),
  };
};

export type QMappingState = ReturnType<typeof useQMapping>;
