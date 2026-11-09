/**
 * The Players tab's data: every signed-in account outside the pilot pool, the
 * chosen player's attempts, and the opened attempt's three records.
 *
 * Nothing here goes through the pilot's records store, which reads the pool
 * alone. The list of players and a player's attempts are read when the tab
 * and the player are chosen, and kept for the tab like the player report's
 * reads. The opened attempt's records, its whole FSM log among them, are read
 * when it is opened and held only while it is (`useOnDemandRead`).
 *
 * Every read goes through the rules with the admin's sign-in: an admin lists
 * `users`, and reads any account's attempts and their `telemetry`.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attemptKind, type StoredAttempt } from '@/features/driving-sim';
import {
  attemptSummary,
  decisionRows,
  levelEntrySummary,
  playerAttemptList,
  replayPlayers,
  routingSummary,
  type AttemptDocumentRead,
} from '@/features/admin/domain/attemptReplay';
import { fsmLogOf, fsmReplay } from '@/features/admin/domain/replayTimeline';
import { adminDeps } from './dependencies';
import { useOnDemandRead, type FsmLogState } from './useOnDemandRead';

const loadPlayers = async () => {
  const { report, pilotRecords } = adminDeps();
  const [users, pool] = await Promise.all([report.users(), pilotRecords.pool()]);
  return replayPlayers(users, new Set(pool.map(entry => entry.uid)));
};

const readRecords = (uid: string, attemptId: string) => adminDeps().pilotRecords.attemptRecords(uid, attemptId);

const NO_ATTEMPTS: AttemptDocumentRead[] = [];

const message = (error: unknown) => (error instanceof Error ? error.message : error ? String(error) : null);

export const usePlayerReplay = (enabled: boolean, uid: string | null, attemptId: string | null) => {
  const players = useQuery({
    queryKey: ['admin-replay-players'],
    queryFn: loadPlayers,
    enabled,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const player = (enabled && players.data?.find(entry => entry.uid === uid)) || null;

  const attempts = useQuery({
    queryKey: ['admin-replay-attempts', player?.uid ?? null],
    queryFn: () => adminDeps().pilotRecords.attemptsFrom(player!.uid, null),
    enabled: player !== null,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const docs = (player && attempts.data) || NO_ATTEMPTS;
  const list = useMemo(() => playerAttemptList(docs), [docs]);
  const position = docs.findIndex(doc => doc.id === attemptId);
  const doc = position >= 0 ? docs[position] : null;

  const read = useOnDemandRead(doc && player ? player.uid : null, doc?.id ?? null, readRecords);
  const records = read?.status === 'done' ? read.value : null;

  const stored = useMemo<StoredAttempt | null>(
    () =>
      doc && records
        ? {
            id: doc.id,
            attempt: doc.data as StoredAttempt['attempt'],
            fsm: fsmLogOf(records.fsm),
            decisions: (records.decisions ?? null) as StoredAttempt['decisions'],
            routing: (records.routing ?? null) as StoredAttempt['routing'],
          }
        : null,
    [doc, records]
  );
  const opened = useMemo(
    () =>
      stored && {
        summary: attemptSummary(stored, { ...list[position], kind: attemptKind(stored) }),
        decisions: decisionRows(stored),
        levelEntry: levelEntrySummary(stored),
        routing: routingSummary(stored),
      },
    [stored, list, position]
  );
  const fsm = useMemo<FsmLogState | null>(
    () => (stored ? (stored.fsm ? { status: 'ready', replay: fsmReplay(stored.fsm) } : { status: 'missing' }) : null),
    [stored]
  );
  const { refetch: refetchPlayers } = players;
  const { refetch: refetchAttempts } = attempts;

  return {
    records: {
      loading: players.isFetching || attempts.isFetching,
      progress: null,
      error: message(players.error) ?? message(attempts.error),
      readAt: players.dataUpdatedAt > 0 ? players.dataUpdatedAt : null,
      refresh: () => {
        void refetchPlayers();
        if (player) void refetchAttempts();
      },
    },
    list: players.data ?? [],
    player,
    attempts: list,
    attemptsLoading: attempts.isFetching,
    opened,
    /** Reading the opened attempt's records. */
    opening: doc && read && read.status !== 'done' ? read : null,
    fsm,
  };
};
