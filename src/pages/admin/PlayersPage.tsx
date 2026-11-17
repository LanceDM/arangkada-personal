/** `/admin/players`: find any account and read it in one place. Reads only. */
import { PlayersSection } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const PlayersPage = () => {
  const { isAdmin } = useAuthSession();
  return <PlayersSection enabled={isAdmin} />;
};

export default PlayersPage;
