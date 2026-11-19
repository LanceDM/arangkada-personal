/**
 * The per-competency course's study export (2026-10-28), for Admin > Course:
 * per-participant BKT (replayed and as logged), decisions, rewards, the
 * shared Q-table and its update log, the background form. Everything is read
 * only when an export is asked for: these are the largest reads an admin makes.
 */
import { useState } from 'react';
import { downloadFile } from '@/features/admin/domain/adminExport';
import {
  buildBKTTrajectoryCSV,
  buildBackgroundCSV,
  buildDecisionsCSV,
  buildLoggedBKTCSV,
  buildQUpdatesCSV,
  buildRewardsCSV,
  buildStudyExport,
} from '@/features/admin/domain/studyExport';
import { adminDeps } from './dependencies';
import { useAdminData } from './useAdminData';
import { useBktSets } from './useBktSets';

export type StudyExportKind = 'json' | 'bkt' | 'decisions' | 'rewards' | 'background' | 'qupdates' | 'bktlog';

export const STUDY_EXPORTS: ReadonlyArray<{ kind: StudyExportKind; label: string }> = [
  { kind: 'json', label: 'Everything (JSON)' },
  { kind: 'bkt', label: 'BKT trajectory (CSV)' },
  { kind: 'bktlog', label: 'BKT update log (CSV)' },
  { kind: 'decisions', label: 'Decisions (CSV)' },
  { kind: 'rewards', label: 'Rewards (CSV)' },
  { kind: 'qupdates', label: 'Q-table updates (CSV)' },
  { kind: 'background', label: 'Background form (CSV)' },
];

export const useStudyExport = (enabled: boolean) => {
  const report = useAdminData(enabled);
  const bkt = useBktSets(enabled);
  const [busy, setBusy] = useState<StudyExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportStudy = async (kind: StudyExportKind) => {
    setBusy(kind);
    setError(null);
    try {
      const now = Date.now();
      const { logs, records } = adminDeps();
      const [bktUpdates, qUpdates, events, participants, roleGrants, configVersions] = await Promise.all([
        logs.bktUpdates().catch(() => []),
        logs.qUpdates().catch(() => []),
        logs.events().catch(() => []),
        records.participants().catch(() => []),
        records.roleGrants().catch(() => []),
        records.configVersions().catch(() => []),
      ]);
      const data = buildStudyExport(
        {
          ...report.study,
          attempts: report.attempts,
          logged: { bktUpdates, qUpdates, events },
          records: { participants, roleGrants, configVersions },
          bktSets: { setOf: bkt.setOf, modelOf: bkt.modelOf, pilotIds: bkt.pilotIds },
        },
        now
      );
      const files: Record<StudyExportKind, () => void> = {
        json: () => downloadFile(`arangkada_study_${now}.json`, JSON.stringify(data, null, 2), 'application/json'),
        bkt: () => downloadFile(`arangkada_bkt_trajectory_${now}.csv`, buildBKTTrajectoryCSV(data), 'text/csv'),
        decisions: () => downloadFile(`arangkada_decisions_${now}.csv`, buildDecisionsCSV(data), 'text/csv'),
        rewards: () => downloadFile(`arangkada_rewards_${now}.csv`, buildRewardsCSV(data), 'text/csv'),
        background: () => downloadFile(`arangkada_background_${now}.csv`, buildBackgroundCSV(data), 'text/csv'),
        qupdates: () => downloadFile(`arangkada_q_updates_${now}.csv`, buildQUpdatesCSV(data), 'text/csv'),
        bktlog: () => downloadFile(`arangkada_bkt_log_${now}.csv`, buildLoggedBKTCSV(data), 'text/csv'),
      };
      files[kind]();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(null);
    }
  };

  return {
    exportStudy,
    busy,
    error: error ?? report.loadError,
    loading: report.isLoading,
    participants: new Set(report.study.courseLogs.map(row => row.userId)).size,
    refresh: report.loadAdminData,
  };
};
