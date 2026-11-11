/**
 * The two logs the model evaluation reads beyond the admin report: every
 * player's BKT update log and the shared Q-table's update log. One document
 * per answer and per table update, so they are read only when asked for.
 */
import { useQuery } from '@tanstack/react-query';
import { adminDeps } from './dependencies';

export const useEvaluationLogs = () => {
  const logs = useQuery({
    queryKey: ['admin-evaluation-logs'],
    queryFn: async () => {
      const [bktUpdates, qUpdates] = await Promise.all([adminDeps().logs.bktUpdates(), adminDeps().logs.qUpdates()]);
      return { bktUpdates, qUpdates, loadedAt: Date.now() };
    },
    enabled: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  return {
    data: logs.data ?? null,
    loading: logs.isFetching,
    error: logs.error instanceof Error ? logs.error.message : null,
    load: () => void logs.refetch(),
  };
};

export type EvaluationLogs = ReturnType<typeof useEvaluationLogs>;
