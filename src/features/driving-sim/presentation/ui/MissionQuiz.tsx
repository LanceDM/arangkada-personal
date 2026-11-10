import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage, useText } from '@/shared/i18n/useText';
import { playableQuizItem } from '@/features/driving-sim/application/use-cases/playableLevel';
import { quizMessages as m } from './messages';
import { ArrowLeft, BookOpen, BrainCircuit, CheckCircle2, AlertCircle, RotateCcw, Timer, X } from 'lucide-react';
import { quizTimeLimitSeconds } from '@/features/driving-sim/domain/scenario/lessonModule';
import { orderChoices, seedForQuestion } from '@/features/driving-sim/domain/scenario/choiceOrder';
import {
  drawSitting,
  quizSittingRecord,
  type LevelQuiz,
  type QuizSittingDoc,
} from '@/features/driving-sim/domain/scenario/quizBank';
import { nextAttemptSeed } from '@/features/driving-sim/application/attemptSeed';
import { ActionBar } from '@/shared/ui/ActionBar';

interface MissionQuizProps {
  quiz: LevelQuiz;
  levelId: number;
  onPass: () => void;
  onClose: () => void;
  /** Called once per finished sitting, with what it showed and how it went. */
  onFinish?: (sitting: QuizSittingDoc) => void;
  /**
   * Where a sitting's seed comes from. One is taken when the quiz opens and
   * one on every retry, and held in state so a re-render never moves the
   * answers. The gallery passes 0, the bank's order.
   */
  newSeed?: () => number;
}

/**
 * The last seconds of a sitting: the clock turns red and the warning shows.
 * An assumption: half an item's minute, enough
 * to answer one more question.
 */
const CLOCK_WARNING_SECONDS = 30;

const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const MissionQuiz = ({ quiz, levelId, onPass, onClose, onFinish, newSeed = nextAttemptSeed }: MissionQuizProps) => {
  const t = useText();
  // Taken once: a sitting's words and its record do not change part-way.
  const [language] = useState(useLanguage().language);
  const [seed, setSeed] = useState(newSeed);
  const [currentStep, setCurrentStep] = useState(0);
  // Keyed by item id, holding the authored choice index: the shown order
  // never reaches the score.
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const reported = useRef(false);

  const passingScore = quiz.passingScore;

  // A seeded draw from the module's served items, each item's choices in an
  // order seeded by its own id.
  const sitting = useMemo(
    () =>
      drawSitting(quiz, seed).map(authored => playableQuizItem(authored, language)).map(item => ({
        item,
        choices: orderChoices(
          item.options.map((option, optionIndex) => ({ option, optionIndex })),
          seedForQuestion(seed, item.id)
        ),
      })),
    [quiz, seed, language]
  );

  // The clock is a deadline against the wall clock, not a count of ticks, so a
  // throttled background tab cannot stretch the sitting.
  const limitMs = quizTimeLimitSeconds(sitting.length) * 1000;
  const [deadline, setDeadline] = useState(() => Date.now() + limitMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finished || sitting.length === 0) return;
    const tick = () => {
      const at = Date.now();
      setNow(at);
      if (at >= deadline) {
        setTimedOut(true);
        setConfirmingLeave(false);
        setFinished(true);
      }
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [finished, deadline, sitting.length]);

  // One record per finished sitting; a retry starts another.
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinish?.(
      quizSittingRecord({
        quiz,
        levelId,
        seed,
        items: sitting.map(({ item }) => item),
        language,
        answers,
        timedOut,
        startedAt,
        finishedAt: Date.now(),
      })
    );
  }, [finished, onFinish, quiz, levelId, seed, sitting, answers, timedOut, startedAt, language]);

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));

  const handleAnswer = (itemId: string, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [itemId]: optionIndex }));
    if (currentStep < sitting.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setFinished(true);
    }
  };

  const reset = () => {
    setSeed(newSeed());
    setCurrentStep(0);
    setAnswers({});
    setTimedOut(false);
    setStartedAt(Date.now());
    reported.current = false;
    setDeadline(Date.now() + limitMs);
    setNow(Date.now());
    setFinished(false);
  };

  if (finished) {
    const score = sitting.reduce((acc, { item }) => acc + (answers[item.id] === item.correctIndex ? 1 : 0), 0);
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
            {timedOut && (
              <p className="text-sm font-bold uppercase tracking-widest text-destructive flex items-center justify-center gap-2">
                <Timer className="w-4 h-4" />
                {t(m.timesUp)}
              </p>
            )}
            <h2 className="text-4xl font-black italic uppercase text-foreground">
              {t(passed ? m.cleared : m.failed)}
            </h2>
            <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">
              {t(m.score(score, sitting.length, passingScore))}
            </p>
          </div>

          {/* Answer review, in the order the questions were asked */}
          <div className="space-y-4">
            {sitting.map(({ item: q }) => {
              const chosen = answers[q.id];
              const isCorrect = chosen === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className={`rounded-2xl p-5 border ${
                    isCorrect
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-destructive/10 border-destructive/30'
                  }`}
                >
                  <p className="text-sm font-bold text-foreground mb-2">{q.question}</p>
                  <p className={`text-xs font-display ${isCorrect ? 'text-accent' : 'text-destructive'}`}>
                    {t(isCorrect ? m.right : m.wrong)} — {t(chosen === undefined ? m.noAnswer : m.yourAnswer(q.options[chosen]))}
                  </p>
                  {!isCorrect && (
                    <p className="text-xs font-display text-accent mt-1">
                      {t(m.correctAnswer(q.options[q.correctIndex]))}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 bg-muted/40 rounded-lg p-2 flex gap-2">
                    <BookOpen className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
                    <span>
                      {q.explanation && <>{q.explanation} </>}
                      <span className="italic">{t(m.source(q.source))}</span>
                    </span>
                  </p>
                </div>
              );
            })}
          </div>

          <ActionBar className="-mx-6 px-6 bg-[#0F0F1A]">
            {passed ? (
              <button
                onClick={onPass}
                className="w-full py-5 bg-primary text-primary-foreground font-display font-black text-lg rounded-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-wider glow-yellow"
              >
                {t(m.proceed)}
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-destructive text-xs font-bold uppercase text-center">
                  {t(m.scoreAtLeast(passingScore, sitting.length))}
                </p>
                <button
                  onClick={reset}
                  className="w-full py-4 bg-muted border border-border rounded-2xl text-foreground font-display font-black uppercase text-sm tracking-widest hover:bg-secondary transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t(m.retry)}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 text-muted-foreground text-xs hover:text-foreground transition-colors"
                >
                  {t(m.backToBriefing)}
                </button>
              </div>
            )}
          </ActionBar>
        </div>
        </div>
      </div>
    );
  }

  // Question screen
  const current = sitting[currentStep];
  const previousAnswer = answers[current.item.id];
  const runningOut = secondsLeft <= CLOCK_WARNING_SECONDS;

  return (
    <div className="fixed inset-0 bg-[#0F0F1A] z-[110] overflow-y-auto">
      <div className="min-h-full p-6 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-10 animate-in slide-in-from-bottom-8 duration-500">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setConfirmingLeave(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-primary/60 transition-all"
          >
            <X className="w-4 h-4" />
            {t(m.backToBriefing)}
          </button>
          <div className="flex items-center gap-3">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="hidden sm:inline font-display text-xs text-muted-foreground uppercase tracking-[0.2em]">
              {t(m.checkpoint)}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {currentStep + 1} / {sitting.length}
            </span>
            <span
              role="timer"
              aria-label={t(m.timeLeft)}
              className={`flex items-center gap-1 text-xs font-bold tabular-nums ${
                runningOut ? 'text-destructive motion-safe:animate-pulse' : 'text-muted-foreground'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              {clockText(secondsLeft)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / sitting.length) * 100}%` }}
          />
        </div>

        {/* Static text, so a screen reader announces it once, when it appears. */}
        {runningOut && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
          >
            <Timer className="w-5 h-5 flex-shrink-0" />
            {t(m.runningOut(CLOCK_WARNING_SECONDS))}
          </div>
        )}

        {/* Question */}
        {current.item.image && (
          <img
            src={current.item.image}
            alt={t(m.pictureAlt)}
            className="mx-auto max-h-48 w-auto object-contain"
          />
        )}
        <h2 className="text-2xl md:text-3xl font-semibold leading-snug text-foreground">
          {current.item.question}
        </h2>

        {/* Options */}
        <div className="grid gap-4">
          {current.choices.map(({ option, optionIndex }, i) => {
            const picked = previousAnswer === optionIndex;
            return (
              <button
                key={optionIndex}
                onClick={() => handleAnswer(current.item.id, optionIndex)}
                aria-pressed={picked}
                className={`group w-full p-5 bg-card border rounded-2xl text-left hover:border-primary/60 hover:bg-primary/5 transition-all flex items-center justify-between ${
                  picked ? 'border-primary' : 'border-border'
                }`}
              >
                <span className="text-foreground font-bold italic text-lg">{option}</span>
                <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-[10px] font-black text-muted-foreground group-hover:text-primary group-hover:border-primary/60 transition-all flex-shrink-0">
                  {i + 1}
                </div>
              </button>
            );
          })}
        </div>

        {currentStep > 0 && (
          <button
            onClick={() => setCurrentStep(s => s - 1)}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t(m.previous)}
          </button>
        )}
      </div>
      </div>

      {/* Drawn inside the quiz: the shared Dialog sits below this overlay's layer. */}
      {confirmingLeave && (
        <div className="fixed inset-0 z-[130] bg-black/70 flex items-center justify-center p-6">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-quiz-title"
            className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 space-y-5"
          >
            <div className="space-y-2">
              <h3 id="leave-quiz-title" className="text-lg font-black text-foreground">
                {t(m.leaveTitle)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(m.leaveNote)}
              </p>
              <p className={`flex items-center gap-1 text-sm font-bold tabular-nums ${runningOut ? 'text-destructive' : 'text-foreground'}`}>
                <Timer className="w-4 h-4" />
                {t(m.left(clockText(secondsLeft)))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                autoFocus
                onClick={() => setConfirmingLeave(false)}
                className="py-3 rounded-xl bg-primary text-primary-foreground font-display font-black uppercase text-xs tracking-widest"
              >
                {t(m.stay)}
              </button>
              <button
                onClick={onClose}
                className="py-3 rounded-xl border border-border text-foreground font-display font-black uppercase text-xs tracking-widest hover:bg-secondary"
              >
                {t(m.leave)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionQuiz;
