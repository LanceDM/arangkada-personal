/**
 * The Replay section's data, from one of two tabs.
 *
 * - **Pilot accounts**: the pool accounts and their attempts from the records
 *   store, read once per tab like every section's, and the opened attempt's
 *   whole FSM log. The store keeps only the start of each log, so it is read
 *   again, alone, when the attempt is opened.
 * - **Players**: every other signed-in account (`usePlayerReplay`).
 *
 * Each tab reads only while it is open. An opened attempt's log is held for as
 * long as it is open and nowhere else (`useOnDemandRead`).
 */
import { useMemo } from 'react';
import { drivingFsmGraph } from '@/features/driving-sim';
import {
  attemptList,
  attemptSummary,
  decisionRows,
  levelEntrySummary,
  routingSummary,
} from '@/features/admin/domain/attemptReplay';
import { fsmLogOf, fsmReplay } from '@/features/admin/domain/replayTimeline';
import { adminDeps } from './dependencies';
import { useOnDemandRead, type FsmLogState } from './useOnDemandRead';
import { usePilotRecords } from './usePilotRecords';
import { usePlayerReplay } from './usePlayerReplay';

export type { FsmLogState } from './useOnDemandRead';

export type ReplayView = 'pilot' | 'players';

export interface ReplaySelection {
  view: ReplayView;
  /** The pool account, by code (Pilot accounts). */
  code: string | null;
  /** The player, by account id (Players). */
  player: string | null;
  attemptId: string | null;
}

const readFsmLog = (uid: string, attemptId: string) => adminDeps().pilotRecords.fsmLog(uid, attemptId).then(fsmLogOf);

const usePilotReplay = (enabled: boolean, code: string | null, attemptId: string | null) => {
  const records = usePilotRecords(enabled);
  const accounts = useMemo(() => records.snapshot?.accounts ?? [], [records.snapshot]);
  const account = accounts.find(entry => entry.code === code) ?? null;
  const attempts = useMemo(() => account?.source?.attempts ?? [], [account]);
  const list = useMemo(() => attemptList(attempts), [attempts]);
  const position = attempts.findIndex(stored => stored.id === attemptId);
  const stored = position >= 0 ? attempts[position] : null;

  const opened = useMemo(
    () =>
      stored && {
        summary: attemptSummary(stored, list[position]),
        decisions: decisionRows(stored),
        levelEntry: levelEntrySummary(stored),
        routing: routingSummary(stored),
      },
    [stored, list, position]
  );
  // An attempt the store found no FSM record for is not read.
  const read = useOnDemandRead(stored?.fsm ? account!.uid : null, stored?.id ?? null, readFsmLog);
  const fsm = useMemo<FsmLogState | null>(() => {
    if (!stored) return null;
    if (!stored.fsm || (read?.status === 'done' && !read.value)) return { status: 'missing' };
    if (!read || read.status === 'loading') return { status: 'loading' };
    if (read.status === 'error') return read;
    return { status: 'ready', replay: fsmReplay(read.value!) };
  }, [stored, read]);
  const { refresh } = records;

  return {
    records: {
      loading: records.loading,
      progress: records.progress,
      error: records.error,
      readAt: records.snapshot?.readAt ?? null,
      refresh: () => void refresh(),
    },
    accounts: accounts.map(entry => ({ code: entry.code, cohort: entry.cohort, attempts: entry.attempts, error: entry.error })),
    account: account && { code: account.code, cohort: account.cohort, error: account.error, read: account.source !== null },
    attempts: list,
    opened,
    fsm,
  };
};

export const useAttemptReplay = (enabled: boolean, selection: ReplaySelection, select: (next: ReplaySelection) => void) => {
  const graph = useMemo(() => drivingFsmGraph(), []);
  const pilot = usePilotReplay(enabled && selection.view === 'pilot', selection.code, selection.attemptId);
  const players = usePlayerReplay(enabled && selection.view === 'players', selection.player, selection.attemptId);
  const onPlayers = selection.view === 'players';
  const opened = onPlayers ? players.opened : pilot.opened;

  return {
    view: selection.view,
    records: onPlayers ? players.records : pilot.records,
    pilot: { accounts: pilot.accounts, account: pilot.account },
    players: { list: players.list, player: players.player },
    attempts: onPlayers ? players.attempts : pilot.attempts,
    attemptsLoading: onPlayers && players.attemptsLoading,
    /** The attempt chosen, whether or not its records have arrived. */
    attemptId: selection.attemptId,
    opened,
    /** Reading the opened attempt's records: a player's, whose records are read only when it is opened. */
    opening: onPlayers ? players.opening : null,
    fsm: opened ? (onPlayers ? players.fsm : pilot.fsm) : null,
    graph,
    selectView: (view: ReplayView) => select({ view, code: null, player: null, attemptId: null }),
    selectAccount: (code: string | null) => select({ ...selection, view: 'pilot', code, attemptId: null }),
    selectPlayer: (player: string | null) => select({ ...selection, view: 'players', player, attemptId: null }),
    selectAttempt: (attemptId: string | null) => select({ ...selection, attemptId }),
  };
};

export type AttemptReplayState = ReturnType<typeof useAttemptReplay>;
