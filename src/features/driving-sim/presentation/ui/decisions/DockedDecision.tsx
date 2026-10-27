/**
 * A decision taken with the drive frozen, docked over the board rather than
 * covering it.
 *
 * Two panels were this, twice. `RoadDecision` asks what the road is asking and
 * `ParkingDecision` asks which technique gets the car into the space, and every
 * line between the two of them was the same: a header, the situation, the
 * question, the answers, the number keys, the wait while the canvas plays the
 * answer out, the verdict, the rule behind it, and a way back to the drive.
 * They drifted anyway — one folded its citation away and one printed it at
 * 10px, one trapped Tab and one let it leak onto the road behind — which is the
 * argument for one shell rather than two files agreeing by inspection.
 *
 * What is genuinely different between them is copy, and copy is what they pass
 * in.
 *
 * ## It docks, and it never covers the thing it is about
 *
 * Both of its callers freeze a road the player is supposed to be looking at:
 * the junction with the other vehicle in it, the car swinging into the bay.
 * Both stand low on the board, because the drive freezes just short of them:
 * the car is drawn at 78–88% of the board's height, a bay and its two parked
 * cars from 62%, a junction's cross street from 47%. So the panel docks at the
 * top, under the HUD strip, under a wash rather than a blur, and never reaches
 * the car: it ends at 78%, which is room for a question and three answers on
 * a full-size board. A full-screen prompt belongs to the decisions that have nothing to watch —
 * see `EmergencyDecision`, which takes the screen and draws its own diagram.
 *
 * And while the answer plays out it is a header and a status line and nothing
 * else: the verdict waits for the manoeuvre to finish, and the road it is
 * playing on is the whole board.
 *
 * ## The phase is derived, never stored
 *
 * The canvas owns the timing: the verdict appears when the manoeuvre has
 * actually finished, however long that took. That is fully described by "has an
 * answer been given" plus "has the canvas finished", so holding it in state as
 * well would be a second source of truth for a fact neither half owns.
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { BookOpen, Check, ChevronDown, X } from 'lucide-react';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useChoiceOrder } from './useChoiceOrder';

/** The words one kind of docked decision uses for the beats every one has. */
export interface DockedDecisionCopy {
  /** What this panel is, in two or three words, for the header. */
  eyebrow: string;
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Said while the answer is playing out on the canvas. */
  resolving: string;
  /** The verdict line, in two or three words, each way. */
  verdictOk: string;
  verdictBad: string;
  /** What the button back to the drive says. */
  continueLabel: string;
}

interface DockedDecisionProps {
  event: ScenarioEvent;
  /** The scenario's own short name, for the header. */
  title: string;
  copy: DockedDecisionCopy;
  /** Start the chosen answer playing out on the driving canvas. */
  onPlay: (action: string) => void;
  /** True once the canvas has finished playing it. */
  played: boolean;
  /** Commit the answer to scoring and release the car. */
  onAnswer: (action: string) => void;
  /**
   * Commit straight through `onAnswer` instead of playing anything out.
   *
   * For the one scene whose resolution *is* the drive: a roundabout plays its
   * full trip round the rotunda as the answer, so there is no separate hold to
   * watch and no verdict panel to sit over the animation.
   */
  skipResolution?: boolean;
  /** Shown before the player answers, only when this matches their weak competency. */
  hintText?: string;
  /**
   * Seeds the order this question's answers are shown in. One per mission
   * attempt, so the correct answer does not sit in the same place every run.
   */
  choiceSeed: number;
  testId: string;
}

type Phase = 'deciding' | 'resolving' | 'verdict';

const DockedDecision = ({
  event,
  title,
  copy,
  onPlay,
  played,
  onAnswer,
  skipResolution = false,
  hintText,
  choiceSeed,
  testId,
}: DockedDecisionProps) => {
  // The displayed order, which the number keys follow. Memoized on the seed and
  // the event, so it holds still across the pick, the resolution and the
  // verdict — the three phases this panel steps through.
  const options = useChoiceOrder(event.choices, choiceSeed, event.id);
  const [chosen, setChosen] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const correct = chosen !== null && chosen === event.correctAction;
  const phase: Phase = chosen === null ? 'deciding' : played ? 'verdict' : 'resolving';
  const { Icon } = copy;

  const choose = useCallback(
    (action: string) => {
      if (skipResolution) {
        onAnswer(action);
        return;
      }
      setChosen(action);
      onPlay(action);
    },
    [onAnswer, onPlay, skipResolution]
  );

  const commit = useCallback(() => {
    if (chosen !== null) onAnswer(chosen);
  }, [chosen, onAnswer]);

  useEffect(() => {
    // `preventScroll` throughout: the browser would otherwise scroll the newly
    // focused control into view, and on a panel taller than its dock that means
    // opening already scrolled past the situation and the question.
    if (phase === 'deciding') firstChoiceRef.current?.focus({ preventScroll: true });
    if (phase === 'verdict') continueRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Kept inside the panel. The drive is frozen, so Tab leaking out lands on
      // a control that does nothing — or worse, on the exit button.
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      if (phase === 'deciding') {
        // The displayed order, not the authored one: a shortcut keyed off the
        // level's own array would submit a different answer from the one under
        // the player's finger.
        const index = Number(e.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < options.length) {
          e.preventDefault();
          choose(options[index].choice.action);
        }
        return;
      }
      if (phase === 'verdict' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        commit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, phase, choose, commit]);

  const titleId = `docked-decision-${event.id}`;

  return (
    // Docked to the top of the board and ending above the car, so the car and,
    // once the panel is short, what it froze in front of stay visible below.
    // `items-start` keeps the panel high even while it is short.
    <div
      // Clear of the HUD strip, which is drawn at the board's own scale — so
      // the strip is shorter on a phone and the panel may start higher there.
      className="absolute inset-x-0 top-[48px] bottom-[22%] z-40 flex items-start justify-center p-2 sm:top-[64px] sm:p-3"
      data-testid={testId}
    >
      {/* A barely-there scrim: enough to lift the panel off the road, not
          enough to hide the thing the question is about. */}
      <div className="pointer-events-none absolute inset-0 bg-background/30" />

      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-xl border-2 border-primary/50 bg-card/95 shadow-2xl backdrop-blur-md"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p
              id={titleId}
              className="truncate font-display text-[13px] font-black uppercase tracking-[0.12em] text-primary"
            >
              {title}
            </p>
          </div>
          <p className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            {copy.eyebrow}
          </p>
        </header>

        {phase !== 'resolving' && (
          <div className="grid min-h-0 flex-1 gap-2.5 overflow-y-auto p-3.5 sm:gap-3 sm:p-4">
            {phase === 'deciding' && (
              <>
                {/* The situation, in the quietest voice on the panel: it is
                    context for the question, not the question. */}
                <p className="text-[13px] leading-5 text-muted-foreground">{event.description}</p>

                {/* And the question, which is the loudest. */}
                {event.question && (
                  <h2 className="text-[17px] font-bold leading-6 text-foreground">{event.question}</h2>
                )}

                {hintText && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
                    <p className="font-display text-[12px] font-black uppercase tracking-[0.12em] text-primary">
                      Extra guidance
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-foreground">{hintText}</p>
                  </div>
                )}

                <div className="grid gap-2">
                  {options.map(({ choice }, i) => (
                    <button
                      key={choice.label}
                      ref={i === 0 ? firstChoiceRef : undefined}
                      onClick={() => choose(choice.action)}
                      className="group flex items-center gap-2.5 rounded-lg border border-border bg-background/60 p-2.5 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:gap-3 sm:p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card font-display text-[13px] font-black text-muted-foreground transition-colors group-hover:border-primary/60 group-hover:text-primary">
                        {i + 1}
                      </span>
                      <span className="text-[15px] font-semibold leading-5 text-foreground">
                        {choice.label}
                      </span>
                    </button>
                  ))}
                </div>

                <p className="text-center text-[12px] text-muted-foreground">
                  Click an answer, or press its number key
                </p>
              </>
            )}

            {phase === 'verdict' && (
              <>
                {/* The verdict: an icon, a word and a color, so it reads without
                    any one of the three. */}
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    correct
                      ? 'border-signal-green/50 bg-signal-green/10 text-signal-green'
                      : 'border-destructive/50 bg-destructive/10 text-destructive'
                  }`}
                >
                  {correct ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <X className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <p className="font-display text-[13px] font-black uppercase tracking-[0.12em]">
                    {correct ? copy.verdictOk : copy.verdictBad}
                  </p>
                </div>

                <p className="text-[15px] font-medium leading-6 text-foreground">
                  {correct ? event.rewardMessage : event.penaltyMessage}
                </p>

                {/* The rule behind it, folded away. Nobody reading a verdict over
                    a road they are about to drive has asked for four sentences of
                    statute yet. */}
                {event.lawCitation && (
                  <div className="rounded-md border border-border bg-background/60">
                    <button
                      type="button"
                      onClick={() => setDetailOpen(open => !open)}
                      aria-expanded={detailOpen}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                        Why this matters
                      </span>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          detailOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                    </button>
                    {detailOpen && (
                      <p className="px-3 pb-3 text-[13px] leading-5 text-muted-foreground">
                        {event.lawCitation}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase !== 'deciding' && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background/50 px-4 py-3">
            <p className="text-[12px] leading-5 text-muted-foreground" aria-live="polite">
              {phase === 'verdict' ? 'The drive is paused.' : copy.resolving}
            </p>
            <button
              ref={continueRef}
              onClick={commit}
              disabled={phase !== 'verdict'}
              className="shrink-0 rounded-lg border border-primary/60 bg-primary/10 px-4 py-2 font-display text-[13px] font-black uppercase tracking-[0.12em] text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40"
            >
              {phase === 'verdict' ? copy.continueLabel : 'Watching…'}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
};

export default DockedDecision;
