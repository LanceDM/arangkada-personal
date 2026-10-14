/**
 * The scenario, read before it is driven.
 *
 * A road event answered with the car announces itself while the car is still
 * moving, which is the right place for the situation and the wrong place for
 * the reading. At speed the two collapse into one another: the driver is still
 * working out what the sign means when the window to act on it closes, and what
 * gets measured is how fast they read rather than whether they know the rule.
 * Holding the drive once — here, at the point the scenario becomes the active
 * one and while the whole of its action window is still ahead — separates them.
 *
 * It does not cover the road it is describing. The panel is docked to the lower
 * half and the scene above it is only dimmed, because a briefing that blurs
 * away the thing it is explaining is asking the player to learn the hazard from
 * prose — which is the one thing this game is built not to do.
 *
 * What it must never be is a trap. It takes a click, Enter or Space; it closes
 * exactly once however many of those arrive; it holds no focus; and the drive
 * it releases resumes from a keyboard the player has to press again, because
 * Space is also the brake and a key leaned on while reading would otherwise be
 * applied the instant the panel closed.
 *
 * How much of the answer it carries is the support level's, not this
 * component's: it renders what `scenarioSupport` returns and decides nothing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Eye } from 'lucide-react';
import type { SupportLevel } from '@/domain/learner/competency';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { Button } from '@/shared/ui/button';
import SignPlateCard from './SignPlateCard';
import { scenarioLabel } from '@/features/driving-sim/domain/scenario/scenarioCopy';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';

interface ScenarioBriefingProps {
  event: ScenarioEvent;
  /** How much of the answer this level's scenarios are presented with. */
  support: SupportLevel;
  onContinue: () => void;
}

/** The keys that release the drive. Space is one of them, and also the brake. */
const RELEASE_KEYS = new Set(['Enter', ' ', 'Spacebar']);

const ScenarioBriefing = ({ event, support, onContinue }: ScenarioBriefingProps) => {
  const shown = scenarioSupport(event, support);
  // Guards the component's own half of "exactly once": a key repeat fires
  // `keydown` every few milliseconds while the key is down, and the session
  // call is idempotent but the release of held keys is not free. Reset by
  // setup rather than latched by cleanup, so Strict Mode's replay re-arms it.
  const releasedRef = useRef(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const release = useCallback(() => {
    if (releasedRef.current) return;
    releasedRef.current = true;
    onContinue();
    // Whatever was clicked gives focus back, so the drive is being played
    // rather than a button being held. The keyboard listener is on `window`,
    // so nothing needs focus for the car to answer.
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, [onContinue]);

  useEffect(() => {
    releasedRef.current = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!RELEASE_KEYS.has(e.key)) return;
      // Space scrolls a page and Enter re-fires whatever is focused; neither is
      // wanted, and the panel is the only thing listening right now.
      e.preventDefault();
      release();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [release]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      data-testid="scenario-briefing"
    >
      {/* The scene stays visible above the panel, dimmed rather than blurred:
          the hazard being explained is on it. */}
      <div className="pointer-events-none flex-1 bg-background/25" />
      <div className="pointer-events-auto flex justify-center bg-gradient-to-t from-background/95 via-background/90 to-transparent p-3 pt-8">
        <section className="w-full max-w-[460px] overflow-hidden rounded-xl border-2 border-primary/50 bg-card shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p className="truncate font-display text-[13px] font-black uppercase tracking-[0.12em] text-primary">
                {scenarioLabel(event)}
              </p>
            </div>
            <p className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              Paused
            </p>
          </header>

          <div className="space-y-3 p-4">
            {shown.sign && <SignPlateCard sign={shown.sign} compact />}
            {/* What is happening. Shown here and nowhere else, at every level. */}
            <p className="text-[15px] leading-6 text-foreground">{shown.situation}</p>
            {/* And the one thing to do about it, authored by the scenario. */}
            {shown.instruction && (
              <div className="rounded-md border border-accent/50 bg-accent/10 px-3 py-2">
                <p className="font-display text-[12px] font-black uppercase tracking-[0.12em] text-accent">
                  Do this
                </p>
                <p className="mt-1 text-[15px] font-semibold leading-5 text-foreground">
                  {shown.instruction}
                </p>
              </div>
            )}
            {/* Or only where to look, in the quieter box: a pointer, not a move. */}
            {shown.cue && (
              <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                <p className="font-display text-[12px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Where to look
                </p>
                <p className="mt-1 text-[15px] leading-5 text-foreground">{shown.cue}</p>
              </div>
            )}

            {/* What a real vehicle would also need, which this one cannot ask
                for. Outside the instruction box and in the quieter voice, so it
                reads as the note it is rather than as a fourth thing to press. */}
            {shown.realWorldNote && (
              <p className="text-[13px] leading-5 text-muted-foreground">
                <span className="font-semibold text-foreground">In a real vehicle: </span>
                {shown.realWorldNote}
              </p>
            )}

            {/* The rule behind it, collapsed. Long-form reference belongs where
                the car is stationary, not beside a moving windscreen. */}
            {shown.lawCitation && (
              <div className="rounded-md border border-border bg-background/60">
                <button
                  type="button"
                  onClick={() => setDetailOpen(open => !open)}
                  aria-expanded={detailOpen}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
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
                    {shown.lawCitation}
                  </p>
                )}
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/50 px-4 py-3">
            <p className="text-[12px] leading-5 text-muted-foreground">
              The drive is paused.
            </p>
            <Button onClick={release} className="font-display tracking-wide">
              Continue driving
            </Button>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default ScenarioBriefing;
