/**
 * The dashboard's records, bound to Driving Sim's participant definitions: the
 * same functions the pilot's export computes its rows with. One store per
 * tab, so moving between sections reads nothing again; Refresh reads what was
 * saved since.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  fsmAsRead,
  participantExport,
  participantSourceOf,
  type ParticipantExport,
  type ParticipantSource,
} from '@/features/driving-sim';
import { adminDeps } from './dependencies';
import { createPilotRecordsStore, type PilotRecordsSnapshot, type PilotRecordsStore } from './pilotRecords';

export type ParticipantRecordsSnapshot = PilotRecordsSnapshot<ParticipantSource, ParticipantExport>;

let store: PilotRecordsStore<ParticipantSource, ParticipantExport> | null = null;

const recordsStore = () =>
  (store ??= createPilotRecordsStore(adminDeps().pilotRecords, {
    sourceOf: participantSourceOf,
    exportOf: participantExport,
    keepFsm: fsm => fsmAsRead(fsm as Parameters<typeof fsmAsRead>[0]),
  }));

export interface PilotRecords {
  snapshot: ParticipantRecordsSnapshot | null;
  loading: boolean;
  /** Accounts read so far in the read under way. */
  progress: { done: number; total: number } | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export const usePilotRecords = (enabled: boolean): PilotRecords => {
  const [snapshot, setSnapshot] = useState<ParticipantRecordsSnapshot | null>(() => store?.current() ?? null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<PilotRecords['progress']>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await recordsStore().refresh((done, total) => setProgress({ done, total })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    // Read once per tab; a Strict Mode replay joins the read already under way.
    if (enabled && !recordsStore().current()) void refresh();
  }, [enabled, refresh]);

  return { snapshot, loading, progress, error, refresh };
};
