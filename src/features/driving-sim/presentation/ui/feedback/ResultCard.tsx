import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle, ChevronDown, X } from 'lucide-react';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { actionLabel, expectedLabel } from '../actionCopy';

/** What was decided at one scenario, as the screen shows it back. */
export interface ScenarioResult {
  /** The scenario's own short name, so the card says what it is about. */
  label: string;
  correct: boolean;
  /** One short line. Twenty words for a pass, thirty for a correction. */
  message: string;
  /** What the score actually moved by. Never parsed out of `message`. */
  points: number;
  /** What the vehicle did, and what it should have done. Corrections only. */
  action?: string;
  expectedAction?: string;
  /** The rule behind it, collapsed. Never open while the car is moving. */
  citation?: string;
  /**
   * The move the scenario wanted, on a correction to one answered with the car.
   * Shown whatever support level the scenario was presented at: every mistake
   * is explained in full.
   */
  move?: string;
  /** What a real vehicle would also need, beside the rule. Corrections only. */
  realWorldNote?: string;
}

/** How long each verdict stays up before it makes way for the road again. */
const HOLD_MS = { correct: 2600, incorrect: 5200 };

/**
 * One verdict, in one card.
 *
 * There used to be three — a reward toast, a correction card and a law card —
 * which could be on screen together, in a column narrower than any of them
 * wanted, while the next scenario was already being announced above them. The
 * player is driving; they get one thing to read.
 *
 * The score change is passed in as a number rather than written into the
 * message, so it is stated once, in one place, and nothing has to parse a
 * sentence to find out what the run is worth.
 */
const ResultCard = ({
  result,
  onDismiss,
}: {
  result: ScenarioResult;
  onDismiss: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  // Folded away again for each new verdict, by reading the state against the
  // verdict it was opened for rather than by clearing it from an effect. The
  // card is never remounted — one verdict replaces another in the same
  // element — so an effect would be a second render every time one lands.
  const verdict = `${result.label}|${result.correct}|${result.message}`;
  const [detail, setDetail] = useState({ verdict, open: false });
  const detailOpen = detail.verdict === verdict && detail.open;
  const setDetailOpen = (open: boolean) => setDetail({ verdict, open });
  const reducedMotion = useReducedMotion();

  // The parent re-renders on every animation frame while the car is moving, so
  // `onDismiss` is a fresh closure ~60x a second. Reading it from a ref is what
  // keeps the auto-dismiss timer below stable: as a dependency it would be
  // cleared and restarted every frame, and never reach its hold.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismissRef.current(), 220);
  }, []);

  // Keyed on the content, not on identity, so the timer is set once per verdict
  // and reset only when a genuinely different one replaces it.
  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const auto = setTimeout(handleDismiss, result.correct ? HOLD_MS.correct : HOLD_MS.incorrect);
    return () => {
      cancelAnimationFrame(show);
      clearTimeout(auto);
    };
  }, [handleDismiss, result.message, result.label, result.correct]);

  const tone = result.correct
    ? { frame: 'border-accent/40', head: 'border-accent/25 bg-accent/10', accent: 'text-accent' }
    : { frame: 'border-destructive/40', head: 'border-destructive/25 bg-destructive/10', accent: 'text-destructive' };
  const Icon = result.correct ? CheckCircle : AlertTriangle;

  return (
    <div
      data-testid="result-card"
      data-correct={result.correct}
      className={
        reducedMotion
          ? 'w-full'
          : `w-full transition-all duration-200 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0'}`
      }
    >
      <div className={`overflow-hidden rounded-xl border-2 bg-card/95 shadow-2xl backdrop-blur-md ${tone.frame}`}>
        <div className={`flex items-center justify-between gap-2 border-b px-3 py-2 ${tone.head}`}>
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${tone.accent}`} aria-hidden />
            <p className={`truncate font-display text-[13px] font-black uppercase tracking-[0.12em] ${tone.accent}`}>
              {result.label}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* The score change, stated once. */}
            <span
              data-testid="result-points"
              className={`font-display text-[15px] font-black tabular-nums ${tone.accent}`}
            >
              {result.points > 0 ? `+${result.points}` : result.points}
            </span>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-2 p-3">
          <p className="text-[14px] font-medium leading-5 text-foreground">{result.message}</p>

          {!result.correct && result.action && result.expectedAction && (
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] leading-5">
              <span className="text-muted-foreground">You</span>
              <span className="font-semibold text-destructive">{actionLabel(result.action)}</span>
              <span className="text-muted-foreground">— this one wanted</span>
              <span className="font-semibold text-accent">{expectedLabel(result.expectedAction)}</span>
            </div>
          )}

          {!result.correct && result.move && (
            <p className="text-[13px] leading-5 text-foreground" data-testid="result-move">
              <span className="font-display text-[12px] font-black uppercase tracking-[0.12em] text-accent">
                Do this{' '}
              </span>
              {result.move}
            </p>
          )}

          {(result.citation || (!result.correct && result.realWorldNote)) && (
            <div className="rounded-md border border-border bg-background/60">
              <button
                type="button"
                onClick={() => setDetailOpen(!detailOpen)}
                aria-expanded={detailOpen}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                <span className="font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                  Why this matters
                </span>
                <ChevronDown
                  className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                    detailOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {detailOpen && (
                <div className="space-y-1.5 px-2.5 pb-2.5 text-[13px] leading-5 text-muted-foreground">
                  {result.citation && <p>{result.citation}</p>}
                  {!result.correct && result.realWorldNote && (
                    <p>
                      <span className="font-semibold text-foreground">In a real vehicle: </span>
                      {result.realWorldNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
