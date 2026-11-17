/**
 * `/admin/pilot`: Participants. Follows the study's enrolled participants
 * live, by code, name and stage, and shows progress, never a
 * score; and the invites they join with. The admin area's layout checks the
 * admin.
 */
import { PilotDashboard, studyDeadlineRepository, usePilotSessions, useStudyInvites } from '@/features/admin';
import { useAuthSession } from '@/features/auth';

const Pilot = () => {
  const { isAdmin } = useAuthSession();
  return <PilotDashboard sessions={usePilotSessions(isAdmin)} invites={useStudyInvites(isAdmin)} deadline={isAdmin ? studyDeadlineRepository() : undefined} />;
};

export default Pilot;
