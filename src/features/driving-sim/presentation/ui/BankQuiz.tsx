import { useRef, useState } from 'react';
import { AlertCircle, BrainCircuit, CheckCircle2, ClipboardList } from 'lucide-react';
import type { BankItem } from '@/domain/assessment/questionBank';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { CourseConflictError, OutdatedAppError } from '@/features/driving-sim/application/errors';

/** One competency's result on a short quiz attempt. */
export interface BankQuizResult {
  competency: string;
  correct: number;
  total: number;
  passed: boolean;
}

interface BankQuizProps {
  /** The items, already drawn and shuffled. */
  items: readonly BankItem[];
  /** What the sitting is: a short-quiz attempt, or one of the two exams. */
  kind: 'quiz' | 'diagnostic' | 'post_exam';
  title: string;
  /** e.g. "Attempt 2 of 3". */
  subtitle?: string;
  /**
   * Called once, when the last item is answered. A short quiz returns its
   * per-competency results to show; an exam returns nothing (no feedback).
   */
  onSubmit: (choices: (number | null)[], responseMs: (number | null)[]) => Promise<BankQuizResult[] | null>;
  /** After the results: continue (passed, or retake drawn), or close. */
  onDone: () => void;
  onClose?: () => void;
}

/**
 * The bank-drawn quiz and exam paper. No feedback after each answer: whether
 * the quiz should give it is an OPEN decision (it decides whether BKT's
 * learning step applies during the quiz). A short quiz shows its result per
 * competency after the attempt, 2 of 3 to pass; the diagnostic and the
 * post-exam show nothing about the answers.
 */
const BankQuiz = ({ items, kind, title, subtitle, onSubmit, onDone, onClose }: BankQuizProps) => {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState<(number | null)[]>(() => items.map(() => null));
  const [results, setResults] = useState<BankQuizResult[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How long each item was on screen before it was answered, for the logs.
  const shownAt = useRef<number>(Date.now());
  const timings = useRef<(number | null)[]>(items.map(() => null));

  const submit = async (final: (number | null)[]) => {
    setSaving(true);
    setError(null);
    try {
      setResults(await onSubmit(final, [...timings.current]));
      setSubmitted(true);
    } catch (failure) {
      if (failure instanceof OutdatedAppError) setError(failure.message);
      else if (failure instanceof CourseConflictError) setError('These answers were already saved, or your course moved on in another tab. Reload the page to continue.');
      else {
        console.error('Failed to save the answers:', failure);
        setError('Your answers could not be saved. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const answer = (choice: number) => {
    const now = Date.now();
    timings.current[step] = now - shownAt.current;
    shownAt.current = now;
    const next = choices.map((c, i) => (i === step ? choice : c));
    setChoices(next);
    if (step < items.length - 1) setStep(step + 1);
    else void submit(next);
  };

  if (submitted) {
    const passedAll = results ? results.every(r => r.passed) : true;
    return (
      <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#0F0F1A]">
        <div className="flex min-h-full justify-center px-6 py-8">
          <div className="w-full max-w-xl space-y-8">
            <div className="space-y-4 text-center">
              <div
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 ${
                  passedAll ? 'border-accent bg-accent/20 text-accent' : 'border-destructive bg-destructive/20 text-destructive'
                }`}
              >
                {passedAll ? <CheckCircle2 className="h-12 w-12" /> : <AlertCircle className="h-12 w-12" />}
              </div>
              <h2 className="text-3xl font-black uppercase text-foreground">
                {kind === 'quiz' ? (passedAll ? 'Quiz passed' : 'Some competencies to retake') : 'Answers saved'}
              </h2>
              {kind !== 'quiz' && (
                <p className="text-sm text-muted-foreground">
                  {kind === 'diagnostic'
                    ? 'This sets your starting point. Your answers are not marked here.'
                    : 'Thank you. Tell the facilitator you have finished.'}
                </p>
              )}
            </div>
            {results && (
              <div className="space-y-3">
                {results.map(r => (
                  <div
                    key={r.competency}
                    className={`flex items-center justify-between rounded-2xl border p-4 ${
                      r.passed ? 'border-accent/30 bg-accent/10' : 'border-destructive/30 bg-destructive/10'
                    }`}
                  >
                    <span className="text-sm font-bold text-foreground">{getCompetencyLabel(r.competency)}</span>
                    <span className={`font-display text-xs ${r.passed ? 'text-accent' : 'text-destructive'}`}>
                      {r.correct} of {r.total} {r.passed ? 'passed' : 'not passed'}
                    </span>
                  </div>
                ))}
                <p className="text-center text-xs text-muted-foreground">2 of 3 correct passes a competency.</p>
              </div>
            )}
            <button
              onClick={onDone}
              className="w-full rounded-2xl bg-primary py-5 font-display text-lg font-black uppercase tracking-wider text-primary-foreground"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = items[step];
  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center overflow-y-auto bg-[#0F0F1A] p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {kind === 'quiz' ? <BrainCircuit className="h-5 w-5 text-primary" /> : <ClipboardList className="h-5 w-5 text-primary" />}
            <span className="font-display text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {title}
              {subtitle ? ` · ${subtitle}` : ''}
            </span>
          </div>
          <span className="text-xs font-bold text-muted-foreground">
            {step + 1} / {items.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(step / items.length) * 100}%` }} />
        </div>
        {current.image && (
          <img src={`/${current.image}`} alt="" className="mx-auto max-h-48 rounded-lg bg-white object-contain p-2" />
        )}
        <h2 className="text-xl font-semibold leading-snug text-foreground md:text-2xl">{current.question}</h2>
        <div className="grid gap-3">
          {current.choices.map((choice, i) => (
            <button
              key={i}
              disabled={saving}
              onClick={() => answer(i)}
              className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
            >
              <span className="text-base font-semibold text-foreground">{choice}</span>
              <span className="ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-black text-muted-foreground">
                {'ABCD'[i]}
              </span>
            </button>
          ))}
        </div>
        {saving && <p className="text-center text-sm text-muted-foreground">Saving your answers...</p>}
        {error && (
          <div className="space-y-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => void submit(choices)} className="text-sm underline">
              Try again
            </button>
          </div>
        )}
        {onClose && step === 0 && (
          <button onClick={onClose} className="w-full py-2 text-xs text-muted-foreground hover:text-foreground">
            Back
          </button>
        )}
      </div>
    </div>
  );
};

export default BankQuiz;
