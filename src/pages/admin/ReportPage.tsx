/**
 * `/admin/report`: the player report. Every account's activity across the
 * game's three modes, with one player's detail beside the list.
 */
import { PlayerReport, usePlayerReport } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const ReportPage = () => {
  const { isAdmin } = useAuthSession();
  return <PlayerReport report={usePlayerReport(isAdmin)} />;
};

export default ReportPage;
