import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { GarageHotspot, GarageStage as GarageStageData } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { useStageScale } from './useStageScale';
import { StageDecision } from './stage/StageDecision';
import { GARAGE_HEIGHT, GARAGE_WIDTH, drawGarage, hitTestHotspot, type HotspotMarker, type HotspotStatus, } from '@/features/driving-sim/presentation/canvas/rendering/renderers/garageRenderer';
interface GarageStageProps {
  garage: GarageStageData;
  levelName: string;
  score: number;
  /**
   * Seeds the order this question's answers are shown in. One per mission
   * attempt, so the correct answer does not sit in the same place every run.
   */
  choiceSeed: number;
  onAnswer: (hotspot: GarageHotspot, action: string) => void;
  onComplete: () => void;
  onExit: () => void;
}

/**
 * What the stage calls itself, per scene.
 *
 * The mechanism is identical either way — a diagram, points on it, nothing left
 * unresolved — but a driver standing at a road crash is not performing a
 * pre-drive inspection, and every visible word here would be wrong if it said
 * so. See `StageScene` in scenarios/types.ts.
 */
const SCENE_COPY = {
  garage: {
    eyebrow: 'Pre-Drive Inspection',
    checklist: 'Readiness Checklist',
    done: 'Start Engine →',
    pending: (n: number) => `Inspect all ${n}`,
  },
  crash_scene: {
    eyebrow: 'At The Scene',
    checklist: 'Crash Response',
    done: 'Finish mission →',
    pending: (n: number) => `Resolve all ${n}`,
  },
} as const;

/**
 * Pre-drive readiness stage. The player inspects every point on the vehicle
 * before the engine may be started. The bay is scaled to its slot so the whole
 * stage fits the viewport without scrolling.
 */
const GarageStage = ({ garage, levelName, score, choiceSeed, onAnswer, onComplete, onExit }: GarageStageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [statuses, setStatuses] = useState<Record<string, HotspotStatus>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openHotspot, setOpenHotspot] = useState<GarageHotspot | null>(null);
  // Height-only: the slot's width is the diagram's own width, so folding width
  // in would make the scale chase itself. Stays at 1 unless the window is too
  // short for the bay at full size.
  const { frameRef, scale } = useStageScale(GARAGE_WIDTH, GARAGE_HEIGHT, { heightOnly: true });
  const scene = garage.scene ?? 'garage';
  const copy = SCENE_COPY[scene];

  const markers: HotspotMarker[] = garage.hotspots.map(h => ({
    id: h.id,
    label: h.label,
    x: h.x,
    y: h.y,
    status: statuses[h.id] ?? 'pending',
  }));
  // Kept in a ref so the paint loop and pointer handlers read current markers
  // without re-subscribing. Assigned in an effect, never during render.
  const markersRef = useRef(markers);
  useEffect(() => {
    markersRef.current = markers;
  });

  const resolvedCount = garage.hotspots.filter(h => statuses[h.id]).length;
  const allResolved = resolvedCount === garage.hotspots.length;

  // Paint once on every state change, then keep a RAF running for the pulse.
  // The single paint means the scene still shows if RAF is throttled.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const paint = () => {
      drawGarage(ctx, garage.plate, markersRef.current, hoveredId, scene);
      frame = requestAnimationFrame(paint);
    };
    drawGarage(ctx, garage.plate, markersRef.current, hoveredId, scene);
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [garage.plate, hoveredId, scene, statuses]);

  const toCanvasPoint = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handleMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(e);
    if (!point) return;
    setHoveredId(hitTestHotspot(markersRef.current, point.x, point.y));
  };

  const handleClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const point = toCanvasPoint(e);
    if (!point) return;
    const id = hitTestHotspot(markersRef.current, point.x, point.y);
    if (!id || statuses[id]) return;
    setOpenHotspot(garage.hotspots.find(h => h.id === id) ?? null);
  };

  const answerHotspot = useCallback((action: string) => {
    const hotspot = openHotspot;
    if (!hotspot) return;
    setOpenHotspot(null);
    setStatuses(prev => ({
      ...prev,
      [hotspot.id]: action === hotspot.correctAction ? 'correct' : 'wrong',
    }));
    onAnswer(hotspot, action);
  }, [onAnswer, openHotspot]);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background lg:overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-stretch lg:justify-center">
        {/* Diagram column, pinned to the bay's width so the header above it
            lines up with the canvas edges. */}
        <div className="flex w-full flex-col lg:w-[440px] lg:min-h-0">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                {copy.eyebrow}
              </p>
              <h1 className="truncate text-lg font-black uppercase leading-tight text-foreground">
                {levelName}
              </h1>
            </div>
            <button
              onClick={onExit}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              Exit
            </button>
          </div>

          <div ref={frameRef} className="flex justify-center lg:min-h-0 lg:flex-1 lg:items-start">
            <div
              className="relative shrink-0"
              style={{ width: GARAGE_WIDTH * scale, height: GARAGE_HEIGHT * scale }}
            >
              <canvas
                ref={canvasRef}
                width={GARAGE_WIDTH}
                height={GARAGE_HEIGHT}
                onMouseMove={handleMove}
                onMouseLeave={() => setHoveredId(null)}
                onClick={handleClick}
                className="absolute left-0 top-0 origin-top-left cursor-pointer rounded-2xl border border-border shadow-2xl"
                style={{ transform: `scale(${scale})` }}
              />
            </div>
          </div>
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-[420px] lg:min-h-0">
          <p className="shrink-0 rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
            {garage.intro}
          </p>

          {/* The only scrollable region: the list takes whatever height is left
              and scrolls internally instead of growing the page. */}
          <div className="flex flex-col rounded-lg border border-border bg-card p-4 lg:min-h-0 lg:flex-1">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {copy.checklist}
              </p>
              <p className="font-display text-xs font-black text-foreground">
                {resolvedCount} / {garage.hotspots.length}
              </p>
            </div>

            <div className="mb-3 h-1.5 shrink-0 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(resolvedCount / garage.hotspots.length) * 100}%` }}
              />
            </div>

            <ul className="grid content-start gap-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {garage.hotspots.map((hotspot, i) => {
                const status = statuses[hotspot.id];
                return (
                  <li key={hotspot.id}>
                    <button
                      onClick={() => !status && setOpenHotspot(hotspot)}
                      disabled={Boolean(status)}
                      onMouseEnter={() => setHoveredId(hotspot.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all ${
                        status
                          ? 'border-border bg-background/40 opacity-70'
                          : 'border-border bg-background/60 hover:border-primary/60 hover:bg-primary/10'
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card font-display text-[10px] font-black text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-foreground">
                          {hotspot.label}
                        </span>
                        <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                          {hotspot.area}
                        </span>
                      </span>
                      {status === 'correct' && <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />}
                      {status === 'wrong' && <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="shrink-0">
              <p className="font-display text-[9px] uppercase tracking-wider text-muted-foreground">Score</p>
              <p className="font-display text-xl font-black leading-none text-foreground">{score}</p>
            </div>
            <button
              onClick={onComplete}
              disabled={!allResolved}
              className={`flex-1 rounded-lg py-3 font-display text-sm font-black uppercase tracking-widest transition-all ${
                allResolved
                  ? 'bg-primary text-primary-foreground hover:scale-[1.02] active:scale-95'
                  : 'cursor-not-allowed bg-muted text-muted-foreground'
              }`}
            >
              {allResolved ? copy.done : copy.pending(garage.hotspots.length)}
            </button>
          </div>
        </aside>
      </div>

      {openHotspot && (
        <StageDecision
          hotspot={openHotspot}
          plate={garage.plate}
          scene={scene}
          onAnswer={answerHotspot}
          choiceSeed={choiceSeed}
        />
      )}
    </div>
  );
};

export default GarageStage;
