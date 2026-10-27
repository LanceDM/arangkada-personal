import { useNavigate } from 'react-router-dom';
import { MockExam } from '@/features/mock-exam';

const MockExamPage = () => {
  const navigate = useNavigate();
  return (
    <MockExam
      onBack={() => navigate('/play')}
      // The weak-area shortcut lands on the level map rather than jumping
      // straight into a briefing: the map is what enforces the unlock ladder,
      // and a suggested level is not necessarily one the player has reached.
      onPractice={() => navigate('/play/story')}
    />
  );
};

export default MockExamPage;
