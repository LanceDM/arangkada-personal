import { useNavigate } from 'react-router-dom';
import AppLayout from '@/app/layout/AppLayout';
import { DailyChallenge } from '@/features/daily-challenge';

const DailyChallengePage = () => {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <DailyChallenge onBack={() => navigate('/play')} />
    </AppLayout>
  );
};

export default DailyChallengePage;
