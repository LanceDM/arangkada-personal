/**
 * The Routing flow section's data: the machine's graph, read from its table,
 * and the pool accounts from the records store, read once per tab like every
 * section's. Nothing more is read: a path is the account's routing log as the
 * export assembles it, and its attempts' routing records, both already held.
 */
import { useMemo } from 'react';
import { flowPath, poolFlow, type FlowAccount } from '@/features/admin/domain/routingFlow';
import { routingGraph } from '@/features/admin/domain/routingGraph';
import { usePilotRecords, type ParticipantRecordsSnapshot } from './usePilotRecords';

export type RoutingFlowView = 'machine' | 'participant' | 'pool';

export interface RoutingFlowSelection {
  view: RoutingFlowView;
  /** The pool account, by code. */
  code: string | null;
}

/** The pool accounts that have been read, as their flow reads them. */
export const flowAccountsOf = (snapshot: ParticipantRecordsSnapshot | null): FlowAccount[] =>
  (snapshot?.accounts ?? []).flatMap(account =>
    account.source && account.exported
      ? [
          {
            code: account.code,
            cohort: account.cohort,
            group: account.exported.row.group,
            attempts: account.source.attempts,
            routingLog: account.exported.routingLog,
          },
        ]
      : []
  );

export const useRoutingFlow = (enabled: boolean, selection: RoutingFlowSelection, select: (next: RoutingFlowSelection) => void) => {
  const records = usePilotRecords(enabled);
  const graph = useMemo(() => routingGraph(), []);
  const accounts = useMemo(() => flowAccountsOf(records.snapshot), [records.snapshot]);
  const listed = records.snapshot?.accounts ?? [];
  const account = useMemo(() => accounts.find(entry => entry.code === selection.code) ?? null, [accounts, selection.code]);
  const path = useMemo(() => (account ? flowPath(account, graph) : null), [account, graph]);
  const pool = useMemo(() => poolFlow(accounts, graph), [accounts, graph]);
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
    graph,
    accounts: listed.map(entry => ({
      code: entry.code,
      cohort: entry.cohort,
      group: entry.exported?.row.group ?? null,
      moves: entry.exported?.routingLog.length ?? null,
    })),
    account: account && {
      code: account.code,
      cohort: account.cohort,
      group: account.group,
      error: listed.find(entry => entry.code === account.code)?.error ?? null,
    },
    path,
    pool,
    selectView: (view: RoutingFlowView) => select({ ...selection, view }),
    selectAccount: (code: string | null) => select({ view: 'participant', code }),
  };
};

export type RoutingFlowState = ReturnType<typeof useRoutingFlow>;
