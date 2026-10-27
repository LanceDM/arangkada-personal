import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { QuestionBankStatus } from '../application/useMockExam';

const BANK_LABEL: Record<QuestionBankStatus, string> = {
  loading: 'Loading...',
  firebase: 'Firebase',
  fallback: 'Local fallback',
};

interface ExamIntroProps {
  bankSize: number;
  bankStatus: QuestionBankStatus;
  requiredScore: number;
  onStart: () => void;
  onBack: () => void;
}

export const ExamIntro = ({
  bankSize,
  bankStatus,
  requiredScore,
  onStart,
  onBack,
}: ExamIntroProps) => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
    <div className="max-w-md w-full text-center space-y-6">
      <div className="text-6xl mb-4">📝</div>
      <h1 className="font-display text-3xl font-bold">EKSAMEN MODE</h1>
      <p className="text-muted-foreground">LTO Theoretical Exam Simulation</p>
      <div className="bg-card border border-border rounded-2xl p-6 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Questions</span>
          <span className="font-bold">{bankSize} items</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Time Limit</span>
          <span className="font-bold">15 minutes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Passing Score</span>
          <span className="font-bold">
            {requiredScore}/{bankSize} (75%)
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Question Bank</span>
          <span className="font-bold">{BANK_LABEL[bankStatus]}</span>
        </div>
      </div>
      <Button
        size="lg"
        className="w-full font-display text-lg py-6"
        disabled={bankStatus === 'loading'}
        onClick={onStart}
      >
        {bankStatus === 'loading' ? 'LOADING QUESTIONS' : 'START EXAM'}
      </Button>
      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Modes
      </Button>
    </div>
  </div>
);
