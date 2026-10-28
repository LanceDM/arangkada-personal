import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronDown, X } from 'lucide-react';
import type { EmergencyKind, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useChoiceOrder } from './useChoiceOrder';

interface EmergencyDecisionProps {
  event: ScenarioEvent;
  onAnswer: (action: string) => void;
  /** Called the moment an answer is picked, before it plays out (stops the question's clock). */
  onChoose?: () => void;
  /** Shown before the player answers, only when this event matches their current weak competency. */
  hintText?: string;
  /**
   * Seeds the order this question's answers are shown in. One per mission
   * attempt, so the correct answer does not sit in the same place every run.
   */
  choiceSeed: number;
}

/**
 * The frozen prompt for a failure of the driver's own vehicle.
 *
 * `RoadDecision` already had the three beats this needs — pick, watch it
 * play out, read why — but everything else about it is a junction: the header
 * says Right Of Way, and the two diagrams it can draw are a roundabout and a
 * crossroads. Put a brake failure through it and the player is shown a give-way
 * line while their car is running away down a hill.
 *
 * So this is its sibling rather than a flag on it. Same structure, same
 * contract with `answerCutscene`, different subject: a stretch of road with the
 * driver's own car on it, going wrong in the specific way this emergency goes
 * wrong.
 *
 * ## One column, and one thing to read at a time
 *
 * This used to be a two-column grid: the diagram on the left, and on the right
 * a 300px column carrying the question, the choices, then the verdict, the
 * correction and the entire law citation — all of it at once, at 11 and 12px.
 * The situation, the instruction, the feedback and the legal text were on
 * screen together, which is the one arrangement that guarantees none of them is
 * read.
 *
 * It is now a single column at every width, with exactly one job per phase:
 * decide, watch, then read the verdict — and the citation is folded away behind
 * a disclosure, the same one `ScenarioBriefing` and `ResultCard` use, because
 * long-form reference belongs where somebody has asked for it.
 */
type Phase = 'deciding' | 'resolving' | 'verdict';

/** How long the emergency takes to play itself out, in milliseconds. */
const RESOLUTION_MS = 2400;

/** A 0..1 clock that runs once while `active`, then holds at 1 and reports done. */
const useResolutionClock = (active: boolean, reduced: boolean, onDone: () => void) => {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!active) return;

    // A player who has asked for less motion still needs the outcome, just not
    // the travel — the same accommodation the right-of-way prompt makes.
    const duration = reduced ? 0 : RESOLUTION_MS;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = duration > 0 ? Math.min((now - start) / duration, 1) : 1;
      setT(progress);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, onDone]);

  return t;
};

/** Eases a sub-range of the clock into its own 0..1, so beats can overlap. */
const beat = (t: number, from: number, to: number) =>
  Math.min(Math.max((t - from) / (to - from), 0), 1);

type Outcome = 'pending' | 'correct' | 'wrong';

interface DiagramProps {
  t: number;
  outcome: Outcome;
}

/** How each emergency is titled and framed, so the panel names what it draws. */
const EMERGENCY_COPY: Record<EmergencyKind, { aside: string; verdictOk: string; verdictBad: string }> = {
  blowout: {
    aside: 'Tire blowout',
    verdictOk: 'Vehicle held straight',
    verdictBad: 'Control lost',
  },
  brake_loss: {
    aside: 'Loss of brake',
    verdictOk: 'Speed brought down',
    verdictBad: 'Ran out of road',
  },
  skid: {
    aside: 'Skid — traction loss',
    verdictOk: 'Traction regained',
    verdictBad: 'Spun out',
  },
  jammed_pedal: {
    aside: 'Jammed accelerator',
    verdictOk: 'Vehicle brought to rest',
    verdictBad: 'Kept accelerating',
  },
};

/** The carriageway every diagram below is drawn on: curbs, center line, shoulder. */
const RoadStrip = ({ shoulder = true }: { shoulder?: boolean }) => (
  <>
    <rect x="52" y="0" width="96" height="200" className="fill-muted" />
    <line
      x1="100"
      y1="0"
      x2="100"
      y2="200"
      strokeDasharray="10 9"
      className="stroke-road-yellow"
      strokeWidth="2"
      opacity="0.8"
    />
    {shoulder && <rect x="148" y="0" width="22" height="200" className="fill-border/40" />}
  </>
);

/** The player's vehicle: a nose-up wedge that can be rotated and displaced. */
const PlayerCar = ({
  x = 100,
  y = 168,
  angle = 0,
  flatTire = false,
}: {
  x?: number;
  y?: number;
  angle?: number;
  flatTire?: boolean;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <rect x="-9" y="-16" width="18" height="32" rx="4" className="fill-primary" />
    <rect x="-6" y="-10" width="12" height="8" rx="2" className="fill-background/50" />
    {/* The failed corner, drawn flat and dark so the diagram says which wheel. */}
    {flatTire && (
      <>
        <rect x="-13" y="6" width="6" height="9" rx="1" className="fill-destructive" />
        <path d="M -14 15 L -6 15" className="stroke-destructive" strokeWidth="2.5" strokeLinecap="round" />
      </>
    )}
  </g>
);

/**
 * A tire blowout: the wheel drags the car toward the shoulder, and the whole
 * question is whether it is allowed to slow down straight or is braked and
 * steered into a spin.
 */
const BlowoutDiagram = ({ t, outcome }: DiagramProps) => {
  // Correct: it tracks straight while the speed bleeds off, then eases onto the
  // shoulder and stops. Wrong: the drag wins, the car yaws, and it leaves the
  // road sideways.
  const travel = beat(t, 0, 0.75);
  const y = outcome === 'correct' ? 168 - travel * 96 : 168 - beat(t, 0, 0.5) * 52;
  const x =
    outcome === 'correct'
      ? 100 + beat(t, 0.45, 1) * 42
      : 100 + beat(t, 0.3, 1) * 34;
  const angle = outcome === 'correct' ? beat(t, 0.5, 1) * 12 : beat(t, 0.3, 1) * 96;

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <RoadStrip />
      {/* The debris that caused it, left behind on the carriageway. */}
      <g className="fill-muted-foreground/70">
        <polygon points="88,182 97,178 100,186 90,189" />
        <polygon points="104,186 112,183 114,190 106,192" />
      </g>
      {/* Where a controlled slowdown is heading: off the lane, onto the shoulder. */}
      {outcome !== 'wrong' && (
        <path
          d="M 100 150 Q 118 110 142 76"
          fill="none"
          className="stroke-signal-green/60"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      )}
      <PlayerCar x={x} y={y} angle={angle} flatTire />
      {outcome === 'wrong' && beat(t, 0.55, 1) > 0 && (
        <text
          x="100"
          y="30"
          textAnchor="middle"
          className="fill-destructive"
          style={{ font: 'bold 13px sans-serif' }}
          opacity={beat(t, 0.55, 1)}
        >
          SPIN
        </text>
      )}
    </svg>
  );
};

/**
 * Brake failure on a descent: the road runs downhill into a bend, and the car
 * either sheds its speed by other means or arrives at the bend with all of it.
 */
const BrakeLossDiagram = ({ t, outcome }: DiagramProps) => {
  // Correct: the speed comes off in stages — gear, then parking brake — and it
  // stops short of the bend. Wrong: it keeps gathering and leaves the road at
  // the corner.
  const progress = outcome === 'correct' ? beat(t, 0, 0.85) * 0.62 : beat(t, 0, 0.65);
  const y = 168 - progress * 150;

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <RoadStrip shoulder={false} />
      {/* The gradient, marked as chevrons running down the slope. */}
      {[0.18, 0.34, 0.5].map((at) => (
        <polygon
          key={at}
          points={`92,${at * 200} 108,${at * 200} 100,${at * 200 + 11}`}
          className="fill-signal-amber/70"
        />
      ))}
      {/* The bend at the bottom of the grade — the thing there is no room for. */}
      <path d="M 52 34 Q 100 8 148 34" fill="none" className="stroke-border" strokeWidth="3" />
      <rect x="52" y="16" width="96" height="4" className="fill-destructive/50" />
      {/* Speed reading, which is the only thing actually changing here. */}
      <text
        x="166"
        y="150"
        textAnchor="middle"
        className={outcome === 'wrong' ? 'fill-destructive' : 'fill-muted-foreground'}
        style={{ font: 'bold 11px sans-serif' }}
      >
        {outcome === 'wrong'
          ? Math.round(60 + beat(t, 0, 0.65) * 45)
          : Math.round(60 - beat(t, 0, 0.85) * 52)}
      </text>
      <PlayerCar y={y} />
      {outcome === 'correct' && beat(t, 0.6, 1) > 0 && (
        <text
          x="100"
          y="60"
          textAnchor="middle"
          className="fill-signal-green"
          style={{ font: 'bold 11px sans-serif' }}
          opacity={beat(t, 0.6, 1)}
        >
          STOPPED SHORT
        </text>
      )}
    </svg>
  );
};

/**
 * A skid: the car is already travelling at an angle to the road, and the
 * question is whether the steering follows where the driver wants to go or
 * fights it.
 */
const SkidDiagram = ({ t, outcome }: DiagramProps) => {
  // It starts crossed up either way. Correct: the angle unwinds and it tracks
  // straight again. Wrong: the angle keeps growing until it is broadside.
  const START_ANGLE = 26;
  const angle =
    outcome === 'correct'
      ? START_ANGLE * (1 - beat(t, 0.1, 0.8))
      : START_ANGLE + beat(t, 0, 0.8) * 64;
  const y = 168 - beat(t, 0, 0.8) * (outcome === 'correct' ? 108 : 62);
  const x = outcome === 'correct' ? 100 - beat(t, 0.1, 0.8) * 6 : 100 - beat(t, 0, 0.8) * 40;

  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <RoadStrip shoulder={false} />
      {/* Wet sheen on the surface, which is why there is no grip to begin with. */}
      <g className="fill-primary/15">
        <ellipse cx="80" cy="120" rx="20" ry="7" />
        <ellipse cx="120" cy="86" rx="24" ry="8" />
        <ellipse cx="92" cy="52" rx="18" ry="6" />
      </g>
      {/* Where the driver wants to go — the line the eyes and the wheel follow. */}
      {outcome !== 'wrong' && (
        <path
          d="M 100 150 L 100 34"
          fill="none"
          className="stroke-signal-green/60"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      )}
      {/* The path already travelled sideways, so the skid reads as motion. */}
      <path
        d={`M 100 176 L ${x} ${y + 8}`}
        fill="none"
        className="stroke-destructive/40"
        strokeWidth="2"
        strokeDasharray="3 4"
      />
      <PlayerCar x={x} y={y} angle={angle} />
    </svg>
  );
};

/** A jammed throttle, for completeness: the pedal is down and stays down. */
const JammedPedalDiagram = ({ t, outcome }: DiagramProps) => {
  const progress = outcome === 'correct' ? beat(t, 0, 0.8) * 0.55 : beat(t, 0, 0.7);
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <RoadStrip shoulder={false} />
      <PlayerCar y={168 - progress * 140} />
      <text
        x="166"
        y="150"
        textAnchor="middle"
        className={outcome === 'wrong' ? 'fill-destructive' : 'fill-muted-foreground'}
        style={{ font: 'bold 11px sans-serif' }}
      >
        {outcome === 'wrong'
          ? Math.round(60 + beat(t, 0, 0.7) * 50)
          : Math.round(60 - beat(t, 0, 0.8) * 56)}
      </text>
    </svg>
  );
};

const DIAGRAMS: Record<EmergencyKind, (props: DiagramProps) => ReactElement> = {
  blowout: BlowoutDiagram,
  brake_loss: BrakeLossDiagram,
  skid: SkidDiagram,
  jammed_pedal: JammedPedalDiagram,
};

/**
 * Shown the instant one of the driver's own systems fails, whatever speed they
 * were doing. The answer is not committed to the simulation when it is clicked:
 * the emergency plays out first, and `onAnswer` runs only once the player has
 * dismissed the verdict — so the score, the FSM transition and the car being
 * released all happen after the consequence has been watched.
 */
const EmergencyDecision = ({ event, onAnswer, onChoose, hintText, choiceSeed }: EmergencyDecisionProps) => {
  const [phase, setPhase] = useState<Phase>('deciding');
  const [chosen, setChosen] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const kind: EmergencyKind = event.emergency ?? 'blowout';
  const copy = EMERGENCY_COPY[kind];
  const Diagram = DIAGRAMS[kind];
  // The displayed order, which the number keys follow. Memoized on the seed and
  // the event, so it holds still across deciding, resolving and the verdict —
  // and so the drive re-rendering this panel every painted frame cannot move
  // the answers under the player's cursor.
  const choices = useChoiceOrder(event.choices, choiceSeed, event.id);

  // Where the keyboard is. The panel takes the screen while the drive is held,
  // so it owns focus outright: the first choice is focused on open and the
  // Continue button on the verdict, and Tab is kept inside the dialog.
  const panelRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const outcome: Outcome =
    chosen === null ? 'pending' : chosen === event.correctAction ? 'correct' : 'wrong';

  const finishResolving = useCallback(() => setPhase('verdict'), []);
  const t = useResolutionClock(phase === 'resolving', reducedMotion, finishResolving);

  const choose = useCallback((action: string) => {
    setChosen(action);
    setPhase('resolving');
    onChoose?.();
  }, [onChoose]);

  const commit = useCallback(() => {
    if (chosen !== null) onAnswer(chosen);
  }, [chosen, onAnswer]);

  useEffect(() => {
    // `preventScroll` throughout: the browser would otherwise scroll the newly
    // focused control into view, and on a panel taller than the window that
    // means opening already scrolled past the situation and the question.
    if (phase === 'deciding') firstChoiceRef.current?.focus({ preventScroll: true });
    if (phase === 'verdict') continueRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Kept inside the panel. Nothing behind it is reachable while the drive
      // is frozen, and Tab leaking out lands on a control that does nothing.
      if (e.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        );
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
        const index = Number(e.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < choices.length) {
          e.preventDefault();
          choose(choices[index].choice.action);
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
  }, [choices, phase, choose, commit]);

  const correct = outcome === 'correct';
  const verdictTone = correct
    ? 'border-signal-green/50 bg-signal-green/10 text-signal-green'
    : 'border-destructive/50 bg-destructive/10 text-destructive';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="emergency-title"
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border-2 border-destructive/50 bg-card shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-destructive/10 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <p
              id="emergency-title"
              className="truncate font-display text-[13px] font-black uppercase tracking-[0.12em] text-destructive"
            >
              {copy.aside}
            </p>
          </div>
          <p className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Emergency
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* What is happening, drawn. Bounded rather than square-by-column, so
              it keeps its shape on a phone instead of eating the panel. */}
          <div className="mx-auto w-full max-w-[220px] px-4 pt-4">
            <div
              className={`overflow-hidden rounded-lg border bg-gradient-to-br from-secondary/60 to-background transition-colors ${
                phase === 'deciding'
                  ? 'border-border'
                  : correct
                    ? 'border-signal-green/60'
                    : 'border-destructive/60'
              }`}
            >
              <div className="aspect-square p-2.5">
                <Diagram t={t} outcome={outcome} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4">
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
                  {choices.map(({ choice }, i) => (
                    <button
                      key={choice.label}
                      ref={i === 0 ? firstChoiceRef : undefined}
                      onClick={() => choose(choice.action)}
                      className="group flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:border-destructive/60 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card font-display text-[13px] font-black text-muted-foreground transition-colors group-hover:border-destructive/60 group-hover:text-destructive">
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

            {phase !== 'deciding' && (
              <>
                {/* The verdict: an icon, a word and a color, so it reads without
                    any one of the three. */}
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${verdictTone}`}>
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

                {/* The rule behind it, folded away. Nobody reading a verdict has
                    asked for four sentences of statute yet. */}
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
        </div>

        {phase !== 'deciding' && (
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-background/50 px-4 py-3">
            <p className="text-[12px] leading-5 text-muted-foreground" aria-live="polite">
              {phase === 'verdict' ? 'The drive is paused.' : 'Watching what happens…'}
            </p>
            <button
              ref={continueRef}
              onClick={commit}
              disabled={phase !== 'verdict'}
              className="rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-2 font-display text-[13px] font-black uppercase tracking-[0.12em] text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-40"
            >
              {phase === 'verdict' ? 'Continue driving' : 'Watching…'}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
};

export default EmergencyDecision;
