import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { DailyChallenge } from '@/features/daily-challenge';
import { useAuthSession } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';

const DailyChallengePage = () => {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const log = (action: string, detail: Record<string, unknown> = {}) => {
    if (user) void logUiAction(user.uid, action, detail);
  };
  return (
    <AppLayout>
      <DailyChallenge onBack={() => navigate('/play')} onEvent={log} />
    </AppLayout>
  );
};

export default DailyChallengePage;
