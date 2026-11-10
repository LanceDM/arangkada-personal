/**
 * `/admin`: the Overview. The pool followed live, today's sessions, where the
 * participants stand, and the health of their records.
 */
import { OverviewSection, useAdminOverview } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const OverviewPage = () => {
  const { isAdmin } = useAuthSession();
  return <OverviewSection {...useAdminOverview(isAdmin)} />;
};

export default OverviewPage;
