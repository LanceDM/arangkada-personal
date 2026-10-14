import { useMemo, useState } from 'react';

import { buildAdminJSONExport, buildAttemptsCSV, downloadFile, } from '@/features/admin/domain/adminExport';
import { calculateAverageScore, countCompletedLevels, countTotalCorrectDecisions, countTotalViolations, getTopWeakCompetencies, } from '@/features/admin/domain/adminMetrics';
import { buildRuleSummaries } from '@/features/admin/domain/adminRules';
import type { AttemptRow, DailyRow, ExamRow, UserRow } from '@/features/admin/domain/adminReport';

interface UseAdminDashboardOptions {
  users: UserRow[];
  attempts: AttemptRow[];
  examResults: ExamRow[];
  dailyResults: DailyRow[];
}

export const useAdminDashboard = ({
  users,
  attempts,
  examResults,
  dailyResults,
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

  return {
    rules,
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
