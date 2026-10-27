/**
 * The call made at a checkpoint window, with the drive frozen.
 *
 * The car has already been brought to a full stop — that is the driving half,
 * and the world does not open this until it has happened. What is left is a
 * judgment: read what the officer has handed over, match it against the vehicle
 * and the trip, and decide.
 *
 * One column on a phone and two on anything wider. It used to be two columns at
 * every width, with the question and its answers at 12px in a 300px gutter and
 * the document at 9px beside them — so the thing being asked about and the thing
 * being asked were each too small to read, and on a narrow window they were
 * side by side as well. The type is the readable scale now, and the split only
 * happens where there is genuinely room for it; stacked, the document is above
 * the question, because evidence comes before the call.
 *
 * The sim is frozen for the duration, so this takes the screen as a modal
 * rather than competing for room beside the road.
 */
import { useEffect, useRef } from 'react';
import { Car, FileText, Route, ShieldAlert } from 'lucide-react';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useChoiceOrder } from './useChoiceOrder';

interface CheckpointInspectionProps {
  event: ScenarioEvent;
  onAnswer: (action: string) => void;
  /** Shown before the player answers, only when this event matches their current weak competency. */
  hintText?: string;
  /**
   * Seeds the order this question's answers are shown in. One per mission
   * attempt, so the correct answer does not sit in the same place every run.
   */
  choiceSeed: number;
}

const CheckpointInspection = ({ event, onAnswer, hintText, choiceSeed }: CheckpointInspectionProps) => {
  // The displayed order, which is what the number keys have to follow: a
  // shortcut keyed off the authored array would submit a different answer from
  // the one under the player's finger.
  const options = useChoiceOrder(event.choices, choiceSeed, event.id);
  // The panel takes the screen, so it owns the keyboard: the first answer is
  // focused on open, and Tab is kept inside it.
  const panelRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Without `preventScroll` the browser scrolls the answer into view, which
    // on a panel taller than the window means opening it already scrolled past
    // the document and the question.
    firstChoiceRef.current?.focus({ preventScroll: true });
  }, [event.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        e.preventDefault();
        onAnswer(options[index].choice.action);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onAnswer]);

  const inspection = event.inspection;
  if (!inspection) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
      data-testid="checkpoint-inspection"
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkpoint-title"
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border-2 border-primary/50 bg-card shadow-2xl sm:max-w-[760px]"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p
              id="checkpoint-title"
              className="truncate font-display text-[13px] font-black uppercase tracking-[0.12em] text-primary"
            >
              {inspection.pullOver ? 'Traffic stop' : 'LTO checkpoint'}
            </p>
          </div>
          <p className="shrink-0 font-display text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Stopped
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row sm:items-stretch">
          {/* The evidence, and the only part that scrolls. On a phone the
              document is taller than the window, and a panel that scrolled as a
              whole opened with the question and its answers below the fold —
              the player had to scroll past the paperwork to find out what they
              were being asked. Bounded rather than stretched, too: a document
              card as wide as a laptop is one nobody reads across. */}
          <div className="mx-auto min-h-0 w-full max-w-[320px] shrink space-y-3 overflow-y-auto px-4 pt-4 sm:mx-0 sm:w-1/2 sm:max-w-none sm:pb-4">
            <div className="overflow-hidden rounded-lg border border-border bg-gradient-to-br from-secondary/60 to-background">
              <div className="flex items-center gap-2 border-b border-border bg-background/50 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <p className="font-display text-[11px] font-black uppercase tracking-wider text-foreground">
                  {inspection.documentType}
                </p>
              </div>
              <div className="p-3">
                <p className="font-display text-sm font-black uppercase tracking-wide text-foreground">
                  {inspection.holder}
                </p>
                <dl className="mt-3 grid gap-2">
                  {inspection.fields.map(field => (
                    <div key={field.label} className="rounded-md bg-background/70 px-2.5 py-1.5">
                      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="font-display text-[13px] font-bold text-foreground">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-start gap-2">
                <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vehicle</p>
                  <p className="text-[13px] font-semibold leading-5 text-foreground">
                    {inspection.vehicle}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Route className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Trip purpose
                  </p>
                  <p className="text-[13px] font-semibold leading-5 text-foreground">
                    {inspection.tripPurpose}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* The ask, which never scrolls away. */}
          <div className="grid shrink-0 content-start gap-3 border-t border-border p-4 sm:min-h-0 sm:w-1/2 sm:overflow-y-auto sm:border-l sm:border-t-0">
            {/* What the officer said, and then what is happening — both in the
                quieter voice, because neither is the question. */}
            <p className="border-l-2 border-primary/50 pl-3 text-[14px] italic leading-6 text-muted-foreground">
              &ldquo;{inspection.officerLine}&rdquo;
            </p>
            <p className="text-[13px] leading-5 text-muted-foreground">{event.description}</p>

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
                  onClick={() => onAnswer(choice.action)}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
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
          </div>
        </div>
      </section>
    </div>
  );
};

export default CheckpointInspection;
