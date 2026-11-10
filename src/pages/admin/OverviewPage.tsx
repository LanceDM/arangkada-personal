/**
 * `/admin`: the Overview. The pool followed live, today's sessions, where the
 * participants stand, and the health of their records.
 */
import { OverviewSection, SiteStatusPanel, useAdminOverview } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const OverviewPage = () => {
  const { isAdmin } = useAuthSession();
  const overview = useAdminOverview(isAdmin);
  return (
    <div className="space-y-6">
      <SiteStatusPanel />
      <OverviewSection {...overview} />
    </div>
  );
};

export default OverviewPage;
