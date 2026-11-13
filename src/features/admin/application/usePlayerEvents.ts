/** One player's event stream, read when the admin opens that player (Admin > Players). */
import { useQuery } from '@tanstack/react-query';
import { adminDeps } from './dependencies';

export const usePlayerEvents = (uid: string | null) => {
  const query = useQuery({
    queryKey: ['admin-player-events', uid],
    queryFn: () => adminDeps().logs.eventsOf(uid!),
    enabled: uid !== null,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  return {
    events: query.data ?? null,
    loading: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => void query.refetch(),
  };
};
