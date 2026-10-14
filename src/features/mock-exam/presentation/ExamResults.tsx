import { AlertTriangle, BookOpen, CheckCircle2, Gauge, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import type { ExamQuestion } from '../domain/questionBank';
import { CATEGORY_TO_LEVEL, type WeakArea } from '../domain/grading';

interface ExamResultsProps {
  questions: ExamQuestion[];
  answers: (number | null)[];
  score: number;
  passed: boolean;
  weakAreas: WeakArea[];
  estimatedAbility: number | null;
  onRetake: () => void;
  onPractice: (levelId: number) => void;
  onBack: () => void;
}

export const ExamResults = ({
  questions,
  answers,
  score,
  passed,
  weakAreas,
  estimatedAbility,
  onRetake,
  onPractice,
  onBack,
}: ExamResultsProps) => (
  <div className="min-h-screen bg-background text-foreground px-4 py-8">
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="text-6xl">{passed ? '🎉' : '😔'}</div>
        <h1 className="font-display text-3xl font-bold">
          {passed ? 'PUMASA KA!' : 'HINDI PUMASA'}
        </h1>
        <p className="text-muted-foreground">
          {passed
            ? 'Congratulations! You passed the mock exam.'
            : "Don't worry — review your weak areas and try again."}
        </p>
        <div
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-2xl font-display font-bold ${passed ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}
        >
          {score}/{questions.length}
        </div>
      </div>

      {estimatedAbility !== null && (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Gauge className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">
              Estimated Ability:{' '}
              <span className="font-display">{estimatedAbility.toFixed(2)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Provisional — calibrated on simulated data, weighs harder questions more than easy
              ones. Pass/fail above is unaffected.
            </p>
          </div>
        </div>
      )}

      {weakAreas.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 font-display text-sm font-bold">
            <AlertTriangle className="w-4 h-4 text-signal-amber" />
            WEAK AREAS
          </div>
          <div className="space-y-3">
            {weakAreas.map(area => {
              const levelId = CATEGORY_TO_LEVEL[area.category];
              return (
                <div key={area.category} className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{area.label}</span>
                    <span className="text-xs text-destructive ml-2">
                      {area.wrong}/{area.total} wrong
                    </span>
                  </div>
                  {levelId !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => onPractice(levelId)}
                    >
                      Practice Level {levelId} →
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-display text-sm font-bold flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> REVIEW WRONG ANSWERS
        </h2>
        {questions.map((q, i) => {
          if (answers[i] === q.correctIndex) return null;
          const given = answers[i];

          return (
            <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium">
                Q{q.id}. {q.question}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <XCircle className="w-3 h-3 text-destructive" />
                <span className="text-destructive">
                  Your answer: {given !== null ? q.choices[given] : 'Not answered'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-3 h-3 text-accent" />
                <span className="text-accent">Correct: {q.choices[q.correctIndex]}</span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mt-1">
                📖 {q.lawCitation}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 pb-8">
        <Button size="lg" className="font-display" onClick={onRetake}>
          <RotateCcw className="w-4 h-4 mr-2" /> RETAKE EXAM
        </Button>
        <Button variant="outline" onClick={onBack}>
          Back to Modes
        </Button>
      </div>
    </div>
  </div>
);
