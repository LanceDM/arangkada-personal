import { useMemo, useState } from 'react';

import { buildAdminJSONExport, buildAttemptsCSV, downloadFile, } from '@/features/admin/domain/adminExport';
import { calculateAverageScore, countCompletedLevels, countTotalCorrectDecisions, countTotalViolations, getTopWeakCompetencies, } from '@/features/admin/domain/adminMetrics';
import { buildRuleSummaries } from '@/features/admin/domain/adminRules';
import type { AttemptRow, DailyRow, ExamRow, StudyData, UserRow } from '@/features/admin/domain/adminReport';
import { adminDeps } from './dependencies';
import {
  buildBKTTrajectoryCSV,
  buildBackgroundCSV,
  buildLoggedBKTCSV,
  buildQUpdatesCSV,
  buildDecisionsCSV,
  buildRewardsCSV,
  buildStudyExport,
} from '@/features/admin/domain/studyExport';

export type StudyExportKind = 'json' | 'bkt' | 'decisions' | 'rewards' | 'background' | 'qupdates' | 'bktlog';

interface UseAdminDashboardOptions {
  users: UserRow[];
  attempts: AttemptRow[];
  examResults: ExamRow[];
  dailyResults: DailyRow[];
  study: StudyData;
}

export const useAdminDashboard = ({
  users,
  attempts,
  examResults,
  dailyResults,
  study,
}: UseAdminDashboardOptions) => {
  const [levelFilter, setLevelFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const rules = useMemo(() => buildRuleSummaries(), []);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((session) => !levelFilter || String(session.levelId) === levelFilter);
  }, [levelFilter, attempts]);

  const selectedUser = useMemo(() => {
    return users.find((row) => row.id === selectedUserId) ?? null;
  }, [selectedUserId, users]);

  const selectedUserResults = useMemo(() => {
    if (!selectedUser?.progress?.levelResults) return [];
    return Object.values(selectedUser.progress.levelResults).sort((a, b) => a.levelId - b.levelId);
  }, [selectedUser]);

  const selectedUserAttempts = useMemo(() => {
    if (!selectedUser) return [];
    return attempts.filter((session) => session.userId === selectedUser.id);
  }, [selectedUser, attempts]);

  const selectedUserDailyResults = useMemo(() => {
    if (!selectedUser) return [];
    return dailyResults.filter((result) => result.userId === selectedUser.id);
  }, [dailyResults, selectedUser]);

  const selectedUserLogs = useMemo(() => {
    return selectedUserResults
      .flatMap((result) =>
        result.logs.map((log) => ({
          ...log,
          levelId: result.levelId,
        }))
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 12);
  }, [selectedUserResults]);

  const completedLevelCount = useMemo(() => countCompletedLevels(users), [users]);
  const totalViolations = useMemo(() => countTotalViolations(attempts), [attempts]);
  const totalCorrect = useMemo(() => countTotalCorrectDecisions(attempts), [attempts]);
  const averageScore = useMemo(() => calculateAverageScore(attempts), [attempts]);
  const topWeakCompetencies = useMemo(() => getTopWeakCompetencies(users), [users]);

  const exportJSON = () => {
    downloadFile(
      `arangkada_admin_${Date.now()}.json`,
      buildAdminJSONExport({ users, attempts, examResults, dailyResults }, rules),
      'application/json'
    );
  };

  const exportAttemptsCSV = () => {
    downloadFile(`arangkada_fsm_sessions_${Date.now()}.csv`, buildAttemptsCSV(attempts), 'text/csv');
  };

  /** The per-competency course's study data: per-user BKT, the shared Q-table, decisions, rewards; no IRT. */
  const exportStudy = async (kind: StudyExportKind) => {
    const now = Date.now();
    // The logs and the people/settings records are read only when exporting:
    // they are the largest reads in the report.
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
      { ...study, attempts, logged: { bktUpdates, qUpdates, events }, records: { participants, roleGrants, configVersions } },
      now
    );
    const files = {
      json: () => downloadFile(`arangkada_study_${now}.json`, JSON.stringify(data, null, 2), 'application/json'),
      bkt: () => downloadFile(`arangkada_bkt_trajectory_${now}.csv`, buildBKTTrajectoryCSV(data), 'text/csv'),
      decisions: () => downloadFile(`arangkada_decisions_${now}.csv`, buildDecisionsCSV(data), 'text/csv'),
      rewards: () => downloadFile(`arangkada_rewards_${now}.csv`, buildRewardsCSV(data), 'text/csv'),
      background: () => downloadFile(`arangkada_background_${now}.csv`, buildBackgroundCSV(data), 'text/csv'),
      qupdates: () => downloadFile(`arangkada_q_updates_${now}.csv`, buildQUpdatesCSV(data), 'text/csv'),
      bktlog: () => downloadFile(`arangkada_bkt_log_${now}.csv`, buildLoggedBKTCSV(data), 'text/csv'),
    };
    files[kind]();
  };

  return {
    rules,
    exportStudy,
    studyParticipants: new Set([...study.courseLogs, ...study.sittings, ...study.backgrounds].map(row => row.userId)).size,
    levelFilter,
    setLevelFilter,
    selectedUser,
    setSelectedUserId,
    filteredAttempts,
    selectedUserResults,
    selectedUserAttempts,
    selectedUserDailyResults,
    selectedUserLogs,
    completedLevelCount,
    totalViolations,
    totalCorrect,
    averageScore,
    topWeakCompetencies,
    exportJSON,
    exportAttemptsCSV,
  };
};
