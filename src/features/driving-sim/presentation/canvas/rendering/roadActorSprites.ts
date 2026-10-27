/**
 * How each road actor is drawn.
 *
 * The world decides *which* actor stands where — `domain/world/roadActors` holds
 * its geometry and `domain/scene` places it. This is the other half: the sprite,
 * and the small overlay a couple of them carry.
 */
import type { RoadActorKind } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  drawBicycle,
  drawBrokenDownVehicle,
  drawCrashedCar,
  drawJeepney,
  drawMotorcycle,
  drawOverloadedTruck,
  drawPassengerVan,
  drawProvincialBus,
  drawSmokeBelcher,
  drawTricycle,
  drawAmbulance,
} from './renderers/vehicleRenderer';

/** How each road actor is drawn. Its size, side and label are world data. */
interface RoadActorSprite {
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  /** Anything painted over the sprite once it is placed. */
  overlay?: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

export const ROAD_ACTOR_SPRITES: Record<RoadActorKind, RoadActorSprite> = {
  bicycle: { draw: (ctx, x, y) => drawBicycle(ctx, x, y, 1) },
  motorcycle: { draw: (ctx, x, y) => drawMotorcycle(ctx, x, y, 0.9) },
  tricycle: {
    draw: (ctx, x, y) => drawTricycle(ctx, x, y, 0.8),
    overlay: (ctx, x, y) => {
      ctx.fillStyle = '#f59e0b';
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u26a0', x, y - 25);
      ctx.globalAlpha = 1;
    },
  },
  jeepney: { draw: (ctx, x, y) => drawJeepney(ctx, x, y, 0.9) },
  smoke_belcher: { draw: drawSmokeBelcher },
  truck: { draw: drawOverloadedTruck },
  bus: { draw: drawProvincialBus },
  ambulance: { draw: (ctx, x, y) => drawAmbulance(ctx, x, y, 0.8) },
  van: { draw: (ctx, x, y) => drawPassengerVan(ctx, x, y) },
  broken_down: { draw: drawBrokenDownVehicle },
  crashed_car: { draw: drawCrashedCar },
};
