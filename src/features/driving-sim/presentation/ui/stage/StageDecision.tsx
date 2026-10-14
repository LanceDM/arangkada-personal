import { useEffect, useRef } from 'react';
import { Car, FileText, Route, TriangleAlert, Wrench } from 'lucide-react';
import type {
  GarageDetailArt,
  GarageHotspot,
  StageScene,
} from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useChoiceOrder } from '../decisions/useChoiceOrder';
import {
  DETAIL_HEIGHT,
  DETAIL_WIDTH,
  drawHotspotDetail,
} from '@/features/driving-sim/presentation/canvas/rendering/renderers/garageRenderer';

/**
 * The question one point on a stage asks, whichever stage it is standing on.
 *
 * Shared deliberately. A pre-drive garage and a crash scene are two different
 * experiences — different pictures, different language, different urgency — but
 * the moment a single point is being judged they are the same thing: some
 * evidence, one question, three answers, a keyboard. Keeping one panel is what
 * stops the two drifting into two standards of legibility, which is how the
 * crash scene ended up as a renamed inspection in the first place.
 */

/** Close-up of the part currently being inspected. */
const DetailArt = ({ art, plate }: { art: GarageDetailArt; plate: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawHotspotDetail(ctx, art, plate);
  }, [art, plate]);

  return (
    <canvas
      ref={ref}
      width={DETAIL_WIDTH}
      height={DETAIL_HEIGHT}
      className="w-full rounded-lg border border-border"
    />
  );
};

/**
 * Modal shown while a single inspection point is being judged.
 *
 * One column at every width. It used to be a two-column grid whose right-hand
 * side carried the question and three answers at 12px while the left carried a
 * document or a close-up — so on a narrow window the thing being asked about
 * and the thing being asked were each too small to read. The evidence now sits
 * above the question at a bounded size, and the question is the largest text on
 * the panel.
 */
export const StageDecision = ({
  hotspot,
  plate,
  scene,
  onAnswer,
  choiceSeed,
}: {
  hotspot: GarageHotspot;
  plate: string;
  scene: StageScene;
  onAnswer: (action: string) => void;
  choiceSeed: number;
}) => {
  // The displayed order, which the number keys follow. Keyed on the point's own
  // id, so two points in one stage are ordered independently.
  const options = useChoiceOrder(hotspot.choices, choiceSeed, hotspot.id);
  // A wrench over a road crash would be the wrong tool and the wrong tone.
  const HeaderIcon = scene === 'crash_scene' ? TriangleAlert : Wrench;
  // The panel takes the screen, so it owns the keyboard: the first answer is
  // focused on open, and Tab is kept inside it.
  const panelRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Without `preventScroll` the browser scrolls the answer into view, which
    // on a panel taller than the window means opening it already scrolled past
    // its own observation and question.
    firstChoiceRef.current?.focus({ preventScroll: true });
  }, [hotspot]);

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

  const evidence = hotspot.document ? (
    <div className="overflow-hidden rounded-lg border border-border bg-gradient-to-br from-secondary/60 to-background">
      <div className="flex items-center gap-2 border-b border-border bg-background/50 px-3 py-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="font-display text-[10px] font-black uppercase tracking-widest text-foreground">
          {hotspot.document.documentType}
        </p>
      </div>
      <div className="p-3">
        <p className="font-display text-sm font-black uppercase tracking-wide text-foreground">
          {hotspot.document.holder}
        </p>
        <dl className="mt-3 grid gap-2">
          {hotspot.document.fields.map((field) => (
            <div key={field.label} className="rounded-md bg-background/70 px-2 py-1.5">
              <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{field.label}</dt>
              <dd className="font-display text-xs font-bold text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  ) : hotspot.detail ? (
    <DetailArt art={hotspot.detail} plate={plate} />
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotspot-title"
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-xl border-2 border-primary/50 bg-card shadow-2xl"
      >
        {/* Two lines on a narrow panel rather than one truncated one. The point's
            own name and the area it covers are both around thirty characters,
            and side by side on a phone the first was clipped to "Rear…". */}
        <header className="shrink-0 gap-x-3 border-b border-border bg-primary/10 px-4 py-2.5 sm:flex sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <HeaderIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p
              id="hotspot-title"
              className="min-w-0 font-display text-[13px] font-black uppercase leading-4 tracking-[0.12em] text-primary"
            >
              {hotspot.label}
            </p>
          </div>
          <p className="mt-1 pl-6 font-display text-[12px] font-bold uppercase leading-4 tracking-wide text-muted-foreground sm:mt-0 sm:shrink-0 sm:pl-0">
            {hotspot.area}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {evidence && (
            <div className="mx-auto w-full max-w-[300px] space-y-3 px-4 pt-4">
              {evidence}
              {hotspot.document && (
                <div className="grid gap-3 rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vehicle</p>
                      <p className="text-[13px] font-semibold leading-5 text-foreground">
                        {hotspot.document.vehicle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Route className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Trip purpose</p>
                      <p className="text-[13px] font-semibold leading-5 text-foreground">
                        {hotspot.document.tripPurpose}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 p-4">
            {/* What you can see, in the quietest voice: it is context for the
                question rather than the question. */}
            <p className="text-[13px] leading-5 text-muted-foreground">{hotspot.observation}</p>

            {/* And the question, which is the loudest thing on the panel. */}
            <h2 className="text-[17px] font-bold leading-6 text-foreground">{hotspot.question}</h2>

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
