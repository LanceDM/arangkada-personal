/**
 * A scripted vehicle, drawn for the role it is playing.
 *
 * Which sprite and which rotation follow from how the vehicle is moving, not
 * from what it is: a car crossing a junction, a car circulating a roundabout
 * and a car turning across you are the same vehicle drawn three ways.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { NpcTransform } from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import type { ScriptedVehicleRole } from '@/features/driving-sim/domain/scene/SceneNode';
import { drawCrossingCar, drawOncomingVehicle } from '../renderPrimitives';
import {
  drawAmbulance,
  drawBicycle,
  drawOncomingBus,
  drawOncomingTruck,
  drawFollowingVehicle,
  drawFreightTruck,
  drawJeepney,
  drawLeadCar,
  drawMotorcycle,
  drawPassengerVan,
  drawProvincialBus,
  drawSmokePlume,
} from './vehicleRenderer';

/**
 * A vehicle sharing your carriageway, seen from behind, drawn as what it is.
 *
 * The kind is the scenario's declaration, not a guess: an event that says a
 * freight truck is ahead gets a freight truck, at the body the collision pass
 * gives a freight truck. `braking` is the pose the world settled this frame.
 */
const drawAheadOfYou = (
  ctx: CanvasRenderingContext2D,
  npc: NonNullable<ScenarioEvent['npc']>,
  x: number,
  y: number,
  braking: boolean,
  hazards: boolean
) => {
  switch (npc.vehicleKind) {
    case 'truck':
      drawFreightTruck(ctx, x, y, braking);
      break;
    case 'van':
      drawPassengerVan(ctx, x, y, braking, hazards);
      break;
    case 'jeepney':
      drawJeepney(ctx, x, y, 0.9, braking, hazards);
      break;
    case 'ambulance':
      drawAmbulance(ctx, x, y, 0.8);
      break;
    case 'motorcycle':
      drawMotorcycle(ctx, x, y, 0.9, npc.rider);
      break;
    // At the same scale a cyclist standing in the carriageway is drawn at, so
    // the sprite and `SHARED_LANE_HITBOX` describe one bicycle.
    case 'bicycle':
      drawBicycle(ctx, x, y, 1);
      break;
    case 'bus':
      drawProvincialBus(ctx, x, y, braking);
      break;
    case 'car':
      drawLeadCar(ctx, x, y, npc.color ?? '#e2e8f0', braking);
      break;
  }

  // Behind it, in the lane the driver is about to be in. Drawn last so it lies
  // over the body rather than under it, and only where the scenario declared
  // the vehicle is smoking — nothing here reads the kind and decides that a
  // jeepney must be.
  if (npc.smoking) {
    drawSmokePlume(ctx, x - 9, y + 42);
    drawSmokePlume(ctx, x + 6, y + 60);
  }
};

/**
 * A scripted vehicle, drawn at the pose the world gave it.
 *
 * The pose is computed once per frame by `composeWorldFrame`, which is what
 * advances a follower's smoothed position. Transforming it again here would
 * step that state twice a frame and double its speed.
 */
export const drawScriptedVehicle = (
  ctx: CanvasRenderingContext2D,
  npc: NonNullable<ScenarioEvent['npc']>,
  as: ScriptedVehicleRole,
  at: NpcTransform | null
): NpcTransform | null => {
  if (!at) return null;

  switch (as) {
    case 'crossing':
      // `vehicleKind` was declared on eight events and read by none of
      // them, so a scenario that said "a jeepney is crossing the junction"
      // drew an anonymous red car and an ambulance crossing on a shout
      // would have too. Same bargain as `pedestrians` and `actor`: the
      // level names what is there, and the renderer draws that.
      //
      // Only `car` has a purpose-drawn sideways sprite. The rest are drawn
      // nose-up, so they are turned to face along their own path — the
      // quarter-turn maps the sprite's (0,-1) nose onto the travel
      // direction for both crossing headings.
      if (npc.vehicleKind === 'car') {
        drawCrossingCar(ctx, at.x, at.y, npc.color ?? '#dc2626');
      } else {
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(at.heading + Math.PI / 2);
        if (npc.vehicleKind === 'jeepney') drawJeepney(ctx, 0, 0, 0.8);
        else if (npc.vehicleKind === 'ambulance') drawAmbulance(ctx, 0, 0, 0.8);
        else drawMotorcycle(ctx, 0, 0, 0.9, npc.rider);
        ctx.restore();
      }
      break;
    case 'oncoming-turning':
      // Rotated about its own centre as it peels across the carriageway.
      // Drawn flat it would slide sideways out of the opposing lane, and
      // whether it is *turning* is the whole question this event asks.
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(at.heading);
      drawOncomingVehicle(ctx, 0, 0, 0.85);
      ctx.restore();
      break;
    case 'joining':
      // A vehicle turning out of a west side road onto the player's road.
      // `heading` is measured from north, so rotating a nose-up sprite by it
      // faces the vehicle east on the approach and swings it to north as it
      // completes the turn and drives up the road — a real curved turn, not
      // a car sliding sideways off the frame.
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(at.heading);
      if (npc.vehicleKind === 'jeepney') drawJeepney(ctx, 0, 0, 0.8);
      else if (npc.vehicleKind === 'ambulance') drawAmbulance(ctx, 0, 0, 0.8);
      else if (npc.vehicleKind === 'motorcycle') drawMotorcycle(ctx, 0, 0, 0.9, npc.rider);
      else drawFollowingVehicle(ctx, 0, 0, npc.color ?? '#64748b', 0.85);
      ctx.restore();
      break;
    case 'circulating':
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(at.heading);
      drawCrossingCar(ctx, 0, 0, npc.color ?? '#2563eb');
      ctx.restore();
      break;
    case 'following':
      drawFollowingVehicle(ctx, at.x, at.y, npc.color ?? '#dc2626', 0.85);
      break;
    case 'filtering':
      // Upright and travelling the driver's own way, drawn as what it is. A
      // rider threading the lane line is the one vehicle on this road whose
      // silhouette has to be unmistakable from behind and from beside.
      drawMotorcycle(ctx, at.x, at.y, 1, npc.rider);
      break;
    case 'leading':
      drawAheadOfYou(ctx, npc, at.x, at.y, at.braking ?? false, at.hazards ?? false);
      break;
    case 'merging':
      // Rotated onto the line its ramp actually runs, so it reads as coming
      // down the slip road rather than sliding sideways across it.
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.rotate(at.heading);
      drawAheadOfYou(ctx, npc, 0, 0, false, at.hazards ?? false);
      ctx.restore();
      break;
    case 'oncoming':
      // Drawn as what the scenario declared, for the reason every other sprite
      // is: a bus named in the prose and drawn as a saloon is a picture that
      // contradicts the sentence beside it. The generic oncoming sprite stays
      // the default, since most oncoming traffic is nobody in particular.
      if (npc.vehicleKind === 'bus') drawOncomingBus(ctx, at.x, at.y);
      else if (npc.vehicleKind === 'truck') drawOncomingTruck(ctx, at.x, at.y);
      else drawOncomingVehicle(ctx, at.x, at.y, 0.85);
      break;
    case 'ambulance':
      drawAmbulance(ctx, at.x, at.y, 0.8);
      break;
  }

  return at;
};
