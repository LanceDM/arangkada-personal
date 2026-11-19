/** `/admin/players`: search any account and read its history. */
import { PlayersSection, useCourseAdmin } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const PlayersPage = () => {
  const { isAdmin } = useAuthSession();
  return <PlayersSection course={useCourseAdmin(isAdmin)} />;
};

export default PlayersPage;
