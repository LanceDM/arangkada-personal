import { useState } from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { CATEGORY_LABELS, type ExamQuestion } from '../domain/questionBank';

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

interface ExamPaperProps {
  questions: ExamQuestion[];
  answers: (number | null)[];
  currentIndex: number;
  timeLeft: number;
  onGoTo: (index: number) => void;
  onAnswer: (choiceIndex: number) => void;
  onSubmit: () => void;
}

export const ExamPaper = ({
  questions,
  answers,
  currentIndex,
  timeLeft,
  onGoTo,
  onAnswer,
  onSubmit,
}: ExamPaperProps) => {
  const [confirming, setConfirming] = useState(false);
  const current = questions[currentIndex];
  const answered = answers.filter(a => a !== null).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <span className="font-display text-xs font-bold">
          {currentIndex + 1} / {questions.length}
        </span>
        <div
          className={`flex items-center gap-1 font-display text-sm font-bold ${timeLeft < 60 ? 'text-destructive animate-pulse' : ''}`}
        >
          <Clock className="w-4 h-4" />
          {formatTime(timeLeft)}
        </div>
        <span className="text-xs text-muted-foreground">{answered} answered</span>
      </div>

      <div className="px-4 py-2 flex gap-1 flex-wrap">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => onGoTo(i)}
            className={`w-6 h-6 rounded-full text-[9px] font-bold border transition-all ${
              i === currentIndex
                ? 'bg-primary text-primary-foreground border-primary'
                : answers[i] !== null
                  ? 'bg-accent/20 border-accent/40 text-accent'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-6 space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <span className="text-xs text-muted-foreground mb-2 block">
            {CATEGORY_LABELS[current.category]}
          </span>
          <p className="text-base font-medium leading-relaxed">{current.question}</p>
        </div>

        <div className="space-y-3">
          {current.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className={`w-full text-left p-4 rounded-xl border text-sm transition-all ${
                answers[currentIndex] === i
                  ? 'bg-primary/10 border-primary text-foreground'
                  : 'bg-card border-border hover:border-primary/40 text-foreground'
              }`}
            >
              <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
              {choice}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 border-t border-border flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={currentIndex === 0}
          onClick={() => onGoTo(currentIndex - 1)}
        >
          Previous
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button className="flex-1" onClick={() => onGoTo(currentIndex + 1)}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            className="flex-1 bg-accent hover:bg-accent/90"
            onClick={() => setConfirming(true)}
          >
            Submit Exam
          </Button>
        )}
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Exam?</DialogTitle>
              <DialogDescription>
                You still have {questions.length - answered} unanswered question(s). Are you sure
                you want to submit?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90"
                onClick={() => {
                  setConfirming(false);
                  onSubmit();
                }}
              >
                Yes, Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
