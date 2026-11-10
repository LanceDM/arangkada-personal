import { useNavigate } from 'react-router-dom';
import { MockExam } from '@/features/mock-exam';
import { useAuthSession } from '@/features/auth';
import { logUiAction } from '@/features/driving-sim';

const MockExamPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const log = (action: string, detail: Record<string, unknown> = {}) => {
    if (user) void logUiAction(user.uid, action, detail);
  };
  return (
    <MockExam
      onBack={() => navigate('/play')}
      onEvent={log}
      // The weak-area shortcut lands on the level map rather than jumping
      // straight into a briefing: the map is what enforces the unlock ladder,
      // and a suggested level is not necessarily one the player has reached.
      onPractice={() => navigate('/play/story')}
    />
  );
};

export default MockExamPage;
