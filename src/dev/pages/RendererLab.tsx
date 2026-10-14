// Dev-only. Composes the world and paints it with the real renderer, one
// static frame per control change - no
// physics, no requestAnimationFrame loop. Two tabs: Swatch previews one
// catalog event in isolation; Scrub drags a distance slider across a whole
// (possibly forced) level's route. Only registered as a route when
// import.meta.env.DEV (see app/router/AppRouter.tsx) - never reachable in production.
import { useMemo, useState } from 'react';
import type { LevelConfig, ScenarioEvent, StageScene } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { RoadScene } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { drawCar, drawRoad } from '@/features/driving-sim/presentation/canvas/rendering/renderers/roadRenderer';
import { generateEnvObjects } from '@/features/driving-sim/domain/world/roadsideScenery';
import { renderScene } from '@/features/driving-sim/presentation/canvas/rendering/renderScene';
import { roadAtFor } from '@/features/driving-sim/domain/world/eventPlacement';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { CANVAS_HEIGHT, laneCentreX, roadXAt, type CarState, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { DETAIL_HEIGHT, DETAIL_WIDTH, GARAGE_HEIGHT, GARAGE_WIDTH, drawGarage, drawHotspotDetail, type HotspotMarker, type HotspotStatus, } from '@/features/driving-sim/presentation/canvas/rendering/renderers/garageRenderer';
import { allScenarioEvents, garageStages, labelForEvent } from '@/dev/fixtures/scenarioCatalog';
import { useStagedLevel } from '@/dev/fixtures/useStagedLevel';
import LevelStagingControls from '@/dev/components/LevelStagingControls';
import RendererCanvas from '@/dev/components/RendererCanvas';
import CarControls from '@/dev/components/CarControls';
import Stepper from '@/dev/components/Stepper';

// Computed once at module scope - both lists are static imports, so there's
// no reason to re-map them on every render.
const ALL_EVENT_LABELS = allScenarioEvents.map(labelForEvent);
const GARAGE_STAGE_LABELS = garageStages.map(s => s.label);

/** Two columns from ~560px up (comfortably below a typical dev-pane width) so the canvas sits beside the controls instead of stacking below a full page-height of them. */
const LAB_GRID_CLASS = 'grid gap-4 min-[560px]:grid-cols-[minmax(0,300px)_minmax(0,1fr)]';

const ROAD_SCENES: RoadScene[] = [
  'intersection', 'side_road', 'junction_t', 'merge', 'signal', 'roundabout',
  'bend', 'narrows', 'divided_start', 'divided_end', 'bridge', 'two_way',
  'hump', 'uneven', 'wet', 'flood', 'gradient_up', 'gradient_down',
  'crosswalk', 'animal', 'rockfall', 'roadwork', 'railway', 'lay_by', 'open_road',
];

/** A minimal LevelConfig wrapper around one event - everything the world and curvesForLevel actually read. */
const wrapEvent = (event: ScenarioEvent): LevelConfig => ({
  id: 1,
  name: 'Swatch preview',
  description: '',
  roadLength: event.triggerAtDistance + 2000,
  speedLimit: 60,
  events: [event],
  requiredScore: 0,
  stars3: 0,
  stars2: 0,
  moduleId: '',
});

const SwatchTab = () => {
  const [index, setIndex] = useState(0);
  const [sceneOverride, setSceneOverride] = useState<RoadScene | ''>('');
  const [handled, setHandled] = useState(false);
  const [lane, setLane] = useState<LaneIndex>(1);
  const [speed, setSpeed] = useState(30);

  const baseEvent = allScenarioEvents[index];
  // Memoised because the override rebuilds the object every render, which would
  // otherwise make `level` a fresh value on each keystroke.
  const event: ScenarioEvent = useMemo(
    () => (sceneOverride ? { ...baseEvent, scene: sceneOverride } : baseEvent),
    [baseEvent, sceneOverride]
  );
  const level = useMemo(() => wrapEvent(event), [event]);
  // Regenerated only on mount, not per control tweak - generateEnvObjects is
  // Math.random()-based, so redrawing with the same env array keeps scenery
  // from jittering every time a control changes.
  const envObjects = useMemo(() => generateEnvObjects(6000), []);

  // Frame the event mid-approach (or just past it, once "handled"), derived
  // from distanceToScreenY's own formula (vehiclePhysics) rather than a slider -
  // there's only one event in view, so there's nothing else to scrub to.
  const distance = handled ? event.triggerAtDistance + 150 : Math.max(0, event.triggerAtDistance - 600);
  const curves = curvesForLevel(level);
  const roadX = roadXAt(distance, curves);
  const car: CarState = { x: laneCentreX(lane, roadX), y: CANVAS_HEIGHT - 120, speed, lane, distance, heading: 0 };
  const handledSet = useMemo(() => new Set(handled ? [event.triggerAtDistance] : []), [handled, event.triggerAtDistance]);

  return (
    <div className={LAB_GRID_CLASS}>
      <div className="grid min-w-0 auto-rows-min gap-3">
        <Stepper
          index={index}
          count={allScenarioEvents.length}
          onChange={setIndex}
          labels={ALL_EVENT_LABELS}
        />
        <p className="text-sm font-semibold">{labelForEvent(baseEvent)}</p>
        <p className="text-xs text-muted-foreground">{baseEvent.description}</p>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Road scene</span>
          <select
            value={sceneOverride}
            onChange={e => setSceneOverride(e.target.value as RoadScene | '')}
            className="w-full min-w-0 rounded-md border border-border bg-card px-3 py-2"
          >
            <option value="">{baseEvent.scene ? `Event's own (${baseEvent.scene})` : "Event's own (none set)"}</option>
            {ROAD_SCENES.map(scene => (
              <option key={scene} value={scene}>{scene}</option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={handled} onChange={e => setHandled(e.target.checked)} />
          <span>Handled (already passed)</span>
        </label>

        <CarControls lane={lane} onLaneChange={setLane} speed={speed} onSpeedChange={setSpeed} />
      </div>

      <RendererCanvas
        onDraw={ctx => {
          drawRoad(ctx, distance, distance, envObjects, curves, level.paint);
          renderScene(
            ctx,
            composeWorldFrame({ level, distance, handled: handledSet, curves }).nodes,
            roadAtFor(distance, curves)
          );
          drawCar(ctx, car);
        }}
      />
    </div>
  );
};

const ScrubTab = () => {
  const staged = useStagedLevel(3);
  const { stagedLevel } = staged;
  const [distance, setDistance] = useState(0);
  const [lane, setLane] = useState<LaneIndex>(1);
  const [speed, setSpeed] = useState(30);

  const envObjects = useMemo(() => generateEnvObjects(stagedLevel.roadLength), [stagedLevel]);
  const curves = useMemo(() => curvesForLevel(stagedLevel), [stagedLevel]);
  const roadX = roadXAt(distance, curves);
  const car: CarState = { x: laneCentreX(lane, roadX), y: CANVAS_HEIGHT - 120, speed, lane, distance, heading: 0 };
  const handledSet = useMemo(
    () => new Set(stagedLevel.events.filter(e => e.triggerAtDistance < distance).map(e => e.triggerAtDistance)),
    [stagedLevel, distance]
  );
  const nearest = [...stagedLevel.events].sort(
    (a, b) => Math.abs(a.triggerAtDistance - distance) - Math.abs(b.triggerAtDistance - distance)
  )[0];

  return (
    <div className={LAB_GRID_CLASS}>
      <div className="grid min-w-0 auto-rows-min gap-3">
        <LevelStagingControls staged={staged} />

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Distance ({distance} / {stagedLevel.roadLength})</span>
          <input
            type="range"
            min={0}
            max={stagedLevel.roadLength}
            value={distance}
            onChange={e => setDistance(Number(e.target.value))}
          />
        </label>

        {nearest && (
          <p className="text-xs text-muted-foreground">
            Nearest event: {labelForEvent(nearest)} @ {nearest.triggerAtDistance}
          </p>
        )}

        <CarControls lane={lane} onLaneChange={setLane} speed={speed} onSpeedChange={setSpeed} />
      </div>

      <RendererCanvas
        onDraw={ctx => {
          drawRoad(ctx, distance, distance, envObjects, curves, stagedLevel.paint);
          renderScene(
            ctx,
            composeWorldFrame({ level: stagedLevel, distance, handled: handledSet, curves }).nodes,
            roadAtFor(distance, curves)
          );
          drawCar(ctx, car);
        }}
      />
    </div>
  );
};

const STAGE_SCENES: StageScene[] = ['garage', 'crash_scene'];
const HOTSPOT_STATUSES: HotspotStatus[] = ['pending', 'correct', 'wrong'];

const GarageTab = () => {
  const [stageIndex, setStageIndex] = useState(0);
  const [hotspotIndex, setHotspotIndex] = useState(0);
  const [status, setStatus] = useState<HotspotStatus>('pending');
  const [hovered, setHovered] = useState(false);
  const [sceneOverride, setSceneOverride] = useState<StageScene | ''>('');

  const stageInfo = garageStages[stageIndex];
  const stage = stageInfo.stage;
  const hotspot = stage.hotspots[Math.min(hotspotIndex, stage.hotspots.length - 1)];
  const scene = sceneOverride || stage.scene || 'garage';

  const markers: HotspotMarker[] = stage.hotspots.map(h => ({
    id: h.id,
    label: h.label,
    x: h.x,
    y: h.y,
    status: h.id === hotspot.id ? status : 'pending',
  }));

  const hotspotLabels = stage.hotspots.map(h => h.label);

  return (
    <div className={LAB_GRID_CLASS}>
      <div className="grid min-w-0 auto-rows-min gap-3">
        <Stepper
          index={stageIndex}
          count={garageStages.length}
          onChange={setStageIndex}
          labels={GARAGE_STAGE_LABELS}
        />
        <p className="text-sm font-semibold">{stageInfo.label}</p>

        <Stepper
          index={Math.min(hotspotIndex, stage.hotspots.length - 1)}
          count={stage.hotspots.length}
          onChange={setHotspotIndex}
          labels={hotspotLabels}
        />
        <p className="text-sm font-semibold">{hotspot.label}</p>
        <p className="text-xs text-muted-foreground">{hotspot.area}</p>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Marker status</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as HotspotStatus)}
            className="w-full min-w-0 rounded-md border border-border bg-card px-3 py-2"
          >
            {HOTSPOT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hovered} onChange={e => setHovered(e.target.checked)} />
          <span>Hovered</span>
        </label>

        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Scene</span>
          <select
            value={sceneOverride}
            onChange={e => setSceneOverride(e.target.value as StageScene | '')}
            className="w-full min-w-0 rounded-md border border-border bg-card px-3 py-2"
          >
            <option value="">Stage's own ({stage.scene ?? 'garage'})</option>
            {STAGE_SCENES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* The two canvases wrap onto their own row instead of forcing a third
          fixed grid column - at a narrow width that would either overflow the
          page or squeeze the controls column down to nothing. */}
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <RendererCanvas
          width={GARAGE_WIDTH}
          height={GARAGE_HEIGHT}
          onDraw={ctx => drawGarage(ctx, stage.plate, markers, hovered ? hotspot.id : null, scene)}
        />

        {hotspot.detail ? (
          <RendererCanvas
            width={DETAIL_WIDTH}
            height={DETAIL_HEIGHT}
            onDraw={ctx => drawHotspotDetail(ctx, hotspot.detail!, stage.plate)}
          />
        ) : hotspot.document ? (
          <div className="w-[260px] max-w-full rounded-lg border border-border bg-card/60 p-3 text-xs text-muted-foreground">
            This hotspot shows a document card (e.g. OR/CR), not canvas art — see Gallery → Checkpoint Inspection
            or Garage Stage for the live version.
          </div>
        ) : null}
      </div>
    </div>
  );
};

const RendererLab = () => {
  const [tab, setTab] = useState<'swatch' | 'scrub' | 'garage'>('swatch');

  return (
    <div className="min-h-screen overflow-x-auto bg-background p-6 text-foreground">
      <h1 className="font-display text-lg font-black uppercase tracking-wider">Renderer Lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Static, non-animated previews of the canvas drawing layer - road, car, and everything drawn on it.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab('swatch')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === 'swatch' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
        >
          Swatch
        </button>
        <button
          onClick={() => setTab('scrub')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === 'scrub' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
        >
          Scrub route
        </button>
        <button
          onClick={() => setTab('garage')}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === 'garage' ? 'bg-primary text-primary-foreground' : 'border border-border'}`}
        >
          Garage
        </button>
      </div>

      <div className="mt-4">
        {tab === 'swatch' && <SwatchTab />}
        {tab === 'scrub' && <ScrubTab />}
        {tab === 'garage' && <GarageTab />}
      </div>
    </div>
  );
};

export default RendererLab;
