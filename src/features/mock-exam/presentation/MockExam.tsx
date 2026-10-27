import { useMockExam } from '../application/useMockExam';
import { ExamIntro } from './ExamIntro';
import { ExamPaper } from './ExamPaper';
import { ExamResults } from './ExamResults';

interface MockExamProps {
  onBack: () => void;
  /** Where a weak-area shortcut goes. The exam never navigates on its own. */
  onPractice: (levelId: number) => void;
}

export const MockExam = ({ onBack, onPractice }: MockExamProps) => {
  const exam = useMockExam();

  if (exam.phase === 'intro') {
    return (
      <ExamIntro
        bankSize={exam.bankSize}
        bankStatus={exam.bankStatus}
        requiredScore={exam.requiredScore}
        onStart={exam.start}
        onBack={onBack}
      />
    );
  }

  if (exam.phase === 'results') {
    return (
      <ExamResults
        questions={exam.questions}
        answers={exam.answers}
        score={exam.score}
        passed={exam.passed}
        weakAreas={exam.weakAreas}
        estimatedAbility={exam.estimatedAbility}
        onRetake={exam.restart}
        onPractice={onPractice}
        onBack={onBack}
      />
    );
  }

  return (
    <ExamPaper
      questions={exam.questions}
      answers={exam.answers}
      currentIndex={exam.currentIndex}
      timeLeft={exam.timeLeft}
      onGoTo={exam.goTo}
      onAnswer={exam.answer}
      onSubmit={exam.submit}
    />
  );
};
