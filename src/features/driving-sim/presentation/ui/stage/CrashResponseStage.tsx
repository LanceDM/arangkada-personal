import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Droplets,
  FileText,
  Flame,
  HeartPulse,
  MapPin,
  Search,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import type {
  GarageHotspot,
  GarageStage as GarageStageData,
  StageMarkerKind,
} from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { useStageScale } from '../useStageScale';
import { StageDecision } from './StageDecision';
import {
  GARAGE_HEIGHT,
  GARAGE_WIDTH,
  drawGarage,
  type HotspotStatus,
} from '@/features/driving-sim/presentation/canvas/rendering/renderers/garageRenderer';

interface CrashResponseStageProps {
  stage: GarageStageData;
  levelName: string;
  score: number;
  /** Seeds the order each point's answers are shown in, one per attempt. */
  choiceSeed: number;
  onAnswer: (hotspot: GarageHotspot, action: string) => void;
  onComplete: () => void;
  onExit: () => void;
}

/**
 * The scene the driver is standing in once they have stopped at a crash.
 *
 * ## Why this is not the garage stage with different words
 *
 * It was, and a playtest called it what it was: "a renamed garage inspection".
 * `GarageStage` with `scene: 'crash_scene'` swapped two label strings and one
 * canvas function, and everything a player actually reads stayed an inspection
 * — a readiness checklist down the right, numbered dots on a diagram, and a
 * button that said Resolve All 4 where it used to say Inspect All 8.
 *
 * A pre-drive inspection and a road crash are not the same experience. An
 * inspection is unhurried, ordered and exhaustive: you walk round a stationary
 * car and check everything, and numbering the points is exactly right because
 * the order is arbitrary and the set is the point. A crash is none of those.
 * The order is not arbitrary — fire before water, water before first aid, first
 * aid before paperwork — and a row of identical dots tells a person standing in
 * front of a burning car nothing about which one matters now.
 *
 * So this screen is built around the one thing an emergency has that an
 * inspection does not: a *next* thing to do. It carries one immediate
 * objective, large and on its own; the tableau underneath it is marked with
 * what each point is about rather than with its position in a list; and the
 * remaining steps are a quiet record underneath, not the main event.
 *
 * ## Markers are DOM, not canvas
 *
 * The garage draws its numbered dots onto the canvas, which means they cannot
 * be focused, cannot be reached by keyboard, cannot be read out and cannot
 * carry a label. Here they are absolutely-positioned buttons over the picture:
 * the canvas illustrates and the DOM interacts. That is what makes the whole
 * scene keyboard-navigable and screen-reader-legible for free, and it is why
 * `drawGarage` is handed an empty marker list.
 */

/** What each kind of point looks like, and what a reader is told it is. */
const MARKERS: Record<StageMarkerKind, { Icon: typeof Flame; sr: string }> = {
  fire: { Icon: Flame, sr: 'Fire risk' },
  water: { Icon: Droplets, sr: 'Vehicle in water' },
  casualty: { Icon: HeartPulse, sr: 'Injured person' },
  report: { Icon: FileText, sr: 'Reporting duty' },
  vehicle: { Icon: MapPin, sr: 'Vehicle' },
  inspect: { Icon: Search, sr: 'Inspection point' },
};

const markerOf = (hotspot: GarageHotspot) => MARKERS[hotspot.marker ?? 'vehicle'];

/**
 * One point on the scene, standing on the thing it is about.
 *
 * Four states, and none of them is carried by colour alone: pending shows its
 * own icon and pulses gently, resolved shows a tick or a cross, and the next
 * one to deal with carries a ring and the word "Next" in its accessible name.
 */
const SceneMarker = ({
  hotspot,
  status,
  isNext,
  reducedMotion,
  onOpen,
}: {
  hotspot: GarageHotspot;
  status: HotspotStatus | undefined;
  isNext: boolean;
  reducedMotion: boolean;
  onOpen: () => void;
}) => {
  const { Icon, sr } = markerOf(hotspot);
  const resolved = Boolean(status);
  const tone = !status
    ? isNext
      ? 'border-road-yellow bg-road-yellow text-background'
      : 'border-border bg-card text-foreground'
    : status === 'correct'
      ? 'border-accent bg-accent/20 text-accent'
      : 'border-destructive bg-destructive/20 text-destructive';

  return (
    <button
      type="button"
      disabled={resolved}
      onClick={onOpen}
      aria-label={`${sr}: ${hotspot.label}${
        resolved ? ` — ${status === 'correct' ? 'handled correctly' : 'handled wrongly'}` : isNext ? ' — deal with this next' : ''
      }`}
      style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 p-2 shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${tone} ${
        resolved ? 'cursor-default opacity-90' : 'hover:scale-110'
      }`}
    >
      {status === 'correct' ? (
        <CheckCircle2 className="h-5 w-5" aria-hidden />
      ) : status === 'wrong' ? (
        <XCircle className="h-5 w-5" aria-hidden />
      ) : (
        <Icon className="h-5 w-5" aria-hidden />
      )}
      {/* The pulse is an attention cue, never the only one: the ring, the fill
          and the accessible name all say the same thing without it. */}
      {isNext && !resolved && !reducedMotion && (
        <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border-2 border-road-yellow" />
      )}
    </button>
  );
};

const CrashResponseStage = ({
  stage,
  levelName,
  score,
  choiceSeed,
  onAnswer,
  onComplete,
  onExit,
}: CrashResponseStageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [openHotspot, setOpenHotspot] = useState<GarageHotspot | null>(null);
  const reducedMotion = useReducedMotion();
  const { frameRef, scale } = useStageScale(GARAGE_WIDTH, GARAGE_HEIGHT, { heightOnly: true });

  const resolved = stage.hotspots.filter(spot => statuses[spot.id]);
  const remaining = stage.hotspots.filter(spot => !statuses[spot.id]);
  // The order the content is authored in is the order the law wants: fire,
  // then water, then who you attend to, then what you owe before leaving.
  const next = remaining[0] ?? null;
  const allResolved = remaining.length === 0;

  // The tableau, painted once per state change. No markers are drawn onto it:
  // they are DOM over the top, so they can be focused and read out.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const paint = () => {
      drawGarage(ctx, stage.plate, [], null, 'crash_scene');
      frame = requestAnimationFrame(paint);
    };
    drawGarage(ctx, stage.plate, [], null, 'crash_scene');
    // A single paint first, so the scene still shows if frames are throttled.
    if (!reducedMotion) frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [stage.plate, reducedMotion]);

  const answerHotspot = useCallback(
    (action: string) => {
      const hotspot = openHotspot;
      if (!hotspot) return;
      setOpenHotspot(null);
      setStatuses(prev => ({
        ...prev,
        [hotspot.id]: action === hotspot.correctAction ? 'correct' : 'wrong',
      }));
      onAnswer(hotspot, action);
    },
    [onAnswer, openHotspot]
  );

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background lg:overflow-hidden">
      {/* The phase banner. A crash scene announces itself; an inspection does
          not need to. */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-destructive/50 bg-destructive/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <p className="truncate font-display text-[13px] font-black uppercase tracking-[0.18em] text-destructive">
            Crash response
          </p>
          <p className="hidden truncate text-[13px] text-muted-foreground sm:block">{levelName}</p>
        </div>
        <button
          onClick={onExit}
          className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 font-display text-[12px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Exit
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 lg:h-[calc(100%-3.25rem)] lg:flex-row lg:items-stretch">
        <div className="flex w-full flex-col gap-3 lg:w-[440px] lg:min-h-0">
          {/* The immediate objective: one instruction, the largest thing here,
              and the only thing on screen asking to be acted on. */}
          <div
            aria-live="polite"
            className={`rounded-xl border-2 px-4 py-3 ${
              allResolved ? 'border-accent/60 bg-accent/10' : 'border-road-yellow/60 bg-road-yellow/10'
            }`}
          >
            <p
              className={`font-display text-[11px] font-black uppercase tracking-[0.18em] ${
                allResolved ? 'text-accent' : 'text-road-yellow'
              }`}
            >
              {allResolved ? 'Scene handled' : 'Do this now'}
            </p>
            <p className="mt-1 text-[17px] font-bold leading-6 text-foreground">
              {allResolved
                ? 'Everything the law asks of you here is done.'
                : (next?.objective ?? next?.label ?? '')}
            </p>
          </div>

          {/* The tableau, with a marker standing on each thing it is about. */}
          <div ref={frameRef} className="flex justify-center lg:min-h-0 lg:flex-1 lg:items-start">
            <div
              className="relative shrink-0"
              style={{ width: GARAGE_WIDTH * scale, height: GARAGE_HEIGHT * scale }}
            >
              <canvas
                ref={canvasRef}
                width={GARAGE_WIDTH}
                height={GARAGE_HEIGHT}
                aria-hidden
                className="absolute left-0 top-0 origin-top-left rounded-2xl border border-border shadow-2xl"
                style={{ transform: `scale(${scale})` }}
              />
              {/* Positioned in percentages over the scaled picture, so a marker
                  stays on its vehicle at every size. */}
              <div className="absolute inset-0">
                {stage.hotspots.map(hotspot => (
                  <SceneMarker
                    key={hotspot.id}
                    hotspot={hotspot}
                    status={statuses[hotspot.id]}
                    isNext={next?.id === hotspot.id}
                    reducedMotion={reducedMotion}
                    onOpen={() => setOpenHotspot(hotspot)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-3 lg:w-[380px] lg:min-h-0">
          <p className="rounded-lg border border-border bg-card p-3 text-[14px] leading-6 text-muted-foreground">
            {stage.intro}
          </p>

          {/* The record of what is left. Deliberately quieter than the
              objective: it is there to be glanced at, not worked down. */}
          <div className="flex flex-col rounded-lg border border-border bg-card p-3 lg:min-h-0 lg:flex-1">
            <p className="mb-2 font-display text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Response steps
            </p>
            <ul className="grid content-start gap-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {stage.hotspots.map(hotspot => {
                const status = statuses[hotspot.id];
                const { Icon, sr } = markerOf(hotspot);
                const isNext = next?.id === hotspot.id;
                return (
                  <li key={hotspot.id}>
                    <button
                      onClick={() => !status && setOpenHotspot(hotspot)}
                      disabled={Boolean(status)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        status
                          ? 'border-border bg-background/40 opacity-70'
                          : isNext
                            ? 'border-road-yellow/60 bg-road-yellow/10'
                            : 'border-border bg-background/60 hover:border-primary/60 hover:bg-primary/10'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-foreground">
                          {hotspot.label}
                        </span>
                        <span className="block truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                          {sr}
                        </span>
                      </span>
                      {status === 'correct' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-label="Handled correctly" />
                      )}
                      {status === 'wrong' && (
                        <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="Handled wrongly" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Score last and smallest: it is the least urgent thing on a screen
              about a crash. */}
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="shrink-0">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted-foreground">
                Score
              </p>
              <p className="font-display text-lg font-black leading-none text-foreground">{score}</p>
            </div>
            <button
              onClick={onComplete}
              disabled={!allResolved}
              className={`flex-1 rounded-lg py-2.5 font-display text-[13px] font-black uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                allResolved
                  ? 'bg-primary text-primary-foreground'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              }`}
            >
              {allResolved ? 'Leave the scene →' : `${resolved.length} of ${stage.hotspots.length} done`}
            </button>
          </div>
        </aside>
      </div>

      {openHotspot && (
        <StageDecision
          hotspot={openHotspot}
          plate={stage.plate}
          scene="crash_scene"
          onAnswer={answerHotspot}
          choiceSeed={choiceSeed}
        />
      )}
    </div>
  );
};

export default CrashResponseStage;
