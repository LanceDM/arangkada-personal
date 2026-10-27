/**
 * One frame, painted: road, then events, then the player's car.
 *
 * The order is load-bearing — the road is the backdrop and everything else
 * overlays it — and this is the single definition of it, so every branch of the
 * drive loop (crash hold, each manoeuvre, the frozen decisions, ordinary
 * driving) paints the same way.
 *
 * Painting only. The world it is handed was already composed, so nothing here
 * decides where anything stands, and nothing here produces the solids the
 * simulation collides against. The visibility veil is deliberately not part of
 * it: callers paint that over the top from their own source.
 */
import type { SceneFrame } from '@/features/driving-sim/domain/scene/SceneFrame';
import { drawCar, drawRoad } from './renderers/roadRenderer';
import { renderScene } from './renderScene';

export const renderFrame = (ctx: CanvasRenderingContext2D, frame: SceneFrame): void => {
  drawRoad(
    ctx,
    frame.roadOffset,
    frame.car.distance,
    frame.envObjects,
    frame.curves,
    frame.level.paint,
    frame.level.route
  );
  renderScene(ctx, frame.nodes, frame.roadAt);
  drawCar(ctx, frame.car);
};
