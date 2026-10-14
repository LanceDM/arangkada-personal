import { useState } from 'react';
import { BrainCircuit, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import type { LevelModule } from '@/features/driving-sim/domain/scenario/lessonModule';

interface MissionQuizProps {
  module: LevelModule;
  onPass: () => void;
  onClose: () => void;
}

const MissionQuiz = ({ module, onPass, onClose }: MissionQuizProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const quiz = module.quiz;
  const passingScore = module.passingScore ?? Math.ceil(quiz.length * 0.5);

  if (quiz.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#0F0F1A] z-[110] flex flex-col p-6 items-center justify-center">
        <div className="max-w-xl w-full space-y-6 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-3xl font-black italic uppercase text-foreground">
            Checkpoint unavailable
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            No quiz items were found for this module. Please review the module content file.
          </p>
          <button
            onClick={onClose}
            className="w-full py-4 bg-muted border border-border rounded-2xl text-foreground font-display font-black uppercase text-sm tracking-widest hover:bg-secondary transition-all"
          >
            Back to Briefing
          </button>
        </div>
      </div>
    );
  }

  const handleAnswer = (idx: number) => {
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    if (currentStep < quiz.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setFinished(true);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setAnswers([]);
    setFinished(false);
  };

  if (finished) {
    const score = answers.reduce(
      (acc, ans, i) => acc + (ans === quiz[i].correct ? 1 : 0), 0
    );
    const passed = score >= passingScore;

    return (
      <div className="fixed inset-0 bg-[#0F0F1A] z-[120] overflow-y-auto">
        <div className="min-h-full px-6 py-8 flex justify-center">
        <div className="max-w-xl w-full space-y-8 animate-in zoom-in duration-500">

          {/* Result icon */}
          <div className="text-center space-y-4">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 ${
              passed
                ? 'bg-accent/20 border-accent text-accent'
                : 'bg-destructive/20 border-destructive text-destructive'
            }`}>
              {passed
                ? <CheckCircle2 className="w-12 h-12" />
                : <AlertCircle className="w-12 h-12" />
              }
            </div>
            <h2 className="text-4xl font-black italic uppercase text-foreground">
              {passed ? 'Checkpoint Cleared!' : 'Checkpoint Failed'}
            </h2>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
              Score: {score} / {quiz.length} | Passing: {passingScore}
            </p>
          </div>

          {/* Answer review */}
          <div className="space-y-4">
            {quiz.map((q, i) => {
              const isCorrect = answers[i] === q.correct;
              return (
                <div
                  key={i}
                  className={`rounded-2xl p-5 border ${
                    isCorrect
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-destructive/10 border-destructive/30'
                  }`}
                >
                  <p className="text-sm font-bold text-foreground mb-2">{q.question}</p>
                  <p className={`text-xs font-display ${isCorrect ? 'text-accent' : 'text-destructive'}`}>
                    {isCorrect ? '✓ Tama' : `✗ Mali — Tamang sagot: ${q.options[q.correct]}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded-lg p-2">
                    ðŸ“– {q.explanation}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {passed ? (
            <button
              onClick={onPass}
              className="w-full py-5 bg-primary text-primary-foreground font-display font-black text-lg rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-wider glow-yellow"
            >
              Proceed to Mission →
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-destructive text-xs font-bold uppercase text-center">
                Score at least {passingScore} out of {quiz.length} to unlock the mission.
              </p>
              <button
                onClick={reset}
                className="w-full py-4 bg-muted border border-border rounded-2xl text-foreground font-display font-black uppercase text-sm tracking-widest hover:bg-secondary transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Checkpoint
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 text-muted-foreground text-xs hover:text-foreground transition-colors"
              >
                Back to Briefing
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  // Question screen
  const current = quiz[currentStep];

  return (
    <div className="fixed inset-0 bg-[#0F0F1A] z-[110] flex flex-col p-6 items-center justify-center">
      <div className="max-w-2xl w-full space-y-10 animate-in slide-in-from-bottom-8 duration-500">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="font-display text-xs text-muted-foreground uppercase tracking-[0.2em]">
              Mission Checkpoint
            </span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {currentStep + 1} / {quiz.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((currentStep) / quiz.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <h2 className="text-2xl md:text-3xl font-semibold leading-snug text-foreground">
          {current.question}
        </h2>

        {/* Options */}
        <div className="grid gap-4">
          {current.options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              className="group w-full p-5 bg-card border border-border rounded-2xl text-left hover:border-primary/60 hover:bg-primary/5 transition-all flex items-center justify-between"
            >
              <span className="text-foreground font-bold italic text-lg">{option}</span>
              <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:text-primary group-hover:border-primary/60 transition-all flex-shrink-0">
                {i + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MissionQuiz;
