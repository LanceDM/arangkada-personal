import { useMockExam } from '../application/useMockExam';
import { ExamIntro } from './ExamIntro';
import { ExamPaper } from './ExamPaper';
import { ExamResults } from './ExamResults';

interface MockExamProps {
  onBack: () => void;
  /** Where a weak-area shortcut goes. The exam never navigates on its own. */
  onPractice: (levelId: number) => void;
  /** Every action and answer, for the study log (the page decides where it goes). */
  onEvent?: (action: string, detail?: Record<string, unknown>) => void;
}

export const MockExam = ({ onBack, onPractice, onEvent }: MockExamProps) => {
  const exam = useMockExam();
  const back = () => {
    onEvent?.('mock_exam_back', { phase: exam.phase });
    onBack();
  };

  if (exam.phase === 'intro') {
    return (
      <ExamIntro
        bankSize={exam.bankSize}
        bankStatus={exam.bankStatus}
        requiredScore={exam.requiredScore}
        onStart={() => {
          onEvent?.('mock_exam_started', { bankSize: exam.bankSize, bankStatus: exam.bankStatus });
          exam.start();
        }}
        onBack={back}
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
        onRetake={() => {
          onEvent?.('mock_exam_retake');
          exam.restart();
        }}
        onPractice={levelId => {
          onEvent?.('mock_exam_practice', { levelId });
          onPractice(levelId);
        }}
        onBack={back}
      />
    );
  }

  return (
    <ExamPaper
      questions={exam.questions}
      answers={exam.answers}
      currentIndex={exam.currentIndex}
      timeLeft={exam.timeLeft}
      onGoTo={index => {
        onEvent?.('mock_exam_goto', { from: exam.currentIndex, to: index });
        exam.goTo(index);
      }}
      onAnswer={choiceIndex => {
        const question = exam.questions[exam.currentIndex];
        onEvent?.('mock_exam_answer', {
          position: exam.currentIndex + 1,
          questionId: question?.id ?? null,
          choice: choiceIndex,
          previous: exam.answers[exam.currentIndex] ?? null,
          correct: question ? choiceIndex === question.correctIndex : null,
          timeLeft: exam.timeLeft,
        });
        exam.answer(choiceIndex);
      }}
      onSubmit={() => {
        onEvent?.('mock_exam_submitted', { answered: exam.answers.filter(a => a !== null).length, timeLeft: exam.timeLeft });
        exam.submit();
      }}
    />
  );
};
