/**
 * A named scene, composed into the objects standing on the road.
 *
 * `resolveScene` names what an event puts there; this places it. The two are
 * separate on purpose: what the scene *is* is a fact about the scenario, and
 * where its parts stand is a fact about the frame.
 *
 * One switch over the taxonomy, and only one. Where a scripted vehicle is
 * anchored and whether it can be hit are decided in the same arm that draws it,
 * so a scene cannot be drawn one way and made solid another.
 *
 * Each node declares its own solids, so the collision pass and the renderer
 * read one composition.
 */
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  CANVAS_WIDTH,
  LANE_WIDTH,
  ROAD_WIDTH,
  rearProximity,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { intersectionGeometry } from '@/features/driving-sim/domain/world/junctionGeometry';
import {
  ownLaneX,
  pedestrianWalkOff,
  type EventPlacement,
} from '@/features/driving-sim/domain/world/eventPlacement';
import { bodyAt } from '@/features/driving-sim/domain/world/WorldBody';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import {
  drivewayPedestrianX,
  mainRoadTraffic,
} from '@/features/driving-sim/domain/world/sceneGeometry';
import { junctionCentreY } from '@/features/driving-sim/domain/world/junctionGeometry';
import type { ResolvedScene } from '@/features/driving-sim/domain/scene/ResolvedScene';
import type { MirrorVehicle, SceneNode, ScriptedVehicleRole } from './SceneNode';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import {
  crashSceneNodes,
  junctionNode,
  pedestrianGroupNode,
  roadActorNode,
  scriptedVehicleNode,
  type JunctionOptions,
  type PosedVehicle,
  type PoseVehicle,
} from './prefabs';

const pedestrianBody = (x: number, y: number) =>
  bodyAt(x, y, 18, 34, 'pedestrian', 'a pedestrian on the crossing');

export interface ResolvedSceneContext {
  level: LevelConfig;
  oncomingLanes: number;
  distance: number;
  /** Frozen per frame, so the scenes with moving parts are testable. */
  now: number;
  /**
   * Whether the support level shows the response (`scenarioSupport`). The path
   * a turn is drawn taking through a junction starts in the lane it is graded
   * from, so it is composed only where this is true.
   */
  showsResponse: boolean;
  /**
   * The frame's alternation, for the two scenes that stand to one side. Calling
   * it advances the sequence every later scene sees, so only those two may.
   */
  resolveSide: (screenY: number) => 1 | -1;
  poseVehicle: PoseVehicle;
}

export const resolvedSceneNodes = (
  placement: EventPlacement,
  scene: ResolvedScene,
  { level, oncomingLanes, distance, now, showsResponse, resolveSide, poseVehicle }: ResolvedSceneContext
): SceneNode[] => {
  const { event, screenY, roadX, handled } = placement;
  const nodes: SceneNode[] = [];

  /**
   * This event's scripted vehicle: posed, made solid and drawn from one call.
   * The anchor row is the scene's own - a vehicle crossing a junction sits on
   * the cross street, one closing from behind on the player's own row.
   *
   * Returns the pose for the one scene that draws something else against it.
   */
  const scriptedVehicle = (
    role: ScriptedVehicleRole,
    anchorY: number,
    { solid = true }: { solid?: boolean } = {}
  ): PosedVehicle | null => {
    if (!event.npc) return null;
    const posed = poseVehicle(event.npc, anchorY, solid);
    if (!posed) return null;
    nodes.push(scriptedVehicleNode(role, event.npc, posed));
    return posed;
  };

  /**
   * The vehicle behind the driver, for the scenarios whose subject includes
   * being pressed from one.
   *
   * Composed outside the scene switch because it is not part of any scene: the
   * road ahead is whatever the scenario put there, and this is what is in the
   * mirror whatever that happens to be. It always brings the mirror with it —
   * a car on your bumper that only exists at the bottom edge of the board is
   * pressure the driver is expected to feel without being able to see it.
   */
  const rearVehicle = () => {
    if (!event.rear) return;
    const posed = poseVehicle(event.rear, screenY, false);
    if (!posed) return;
    nodes.push(scriptedVehicleNode('following', event.rear, posed));
    if (!handled) {
      nodes.push({
        kind: 'rear-view',
        roadX,
        npcX: posed.at.x,
        proximity: rearProximity(posed.at.y),
        vehicle: inTheMirror(event.rear),
      });
    }
  };
  /**
   * What the mirror is showing, read off the declaration that put it there.
   *
   * The only place a `MirrorVehicle` is built. The glass and the road then draw
   * the same vehicle from one source, rather than the road reading the
   * scenario and the mirror guessing.
   */
  const inTheMirror = (spec: NpcVehicleSpec): MirrorVehicle => ({
    kind: spec.vehicleKind,
    ...(spec.color ? { color: spec.color } : {}),
  });

  const junction = (options: Omit<JunctionOptions, 'roadX' | 'screenY'> = {}) =>
    nodes.push(junctionNode({ roadX, screenY, ...options }));
  const furniture = (item: Extract<SceneNode, { kind: 'road-furniture' }>['furniture']) =>
    nodes.push({ kind: 'road-furniture', furniture: item });
  const laneArrow = (
    x: number,
    y: number,
    direction: 'up' | 'left' | 'right' | 'down',
    color = '#ffffff'
  ) => nodes.push({ kind: 'road-marking', marking: { mark: 'lane-arrow', x, y, direction, color } });

  switch (scene.kind) {
    case 'traffic-signal':
      // The red is always at a junction; the amber stands alone mid-block, as
      // the "should you have stopped for that?" question needs it to.
      if (scene.aspect === 'red') {
        junction({ control: 'stop', crosswalk: true, crossTraffic: true });
        nodes.push({
          kind: 'traffic-signal',
          x: roadX + ROAD_WIDTH - 23,
          y: screenY - 59,
          aspect: 'red',
          mast: true,
        });
      } else {
        nodes.push({
          kind: 'traffic-signal',
          x: CANVAS_WIDTH / 2,
          y: screenY - 45,
          aspect: 'yellow',
          mast: false,
        });
      }
      break;

    case 'stop-sign-junction':
      // The scripted vehicle, when there is one, is the only cross traffic. A
      // Stop sign with an empty junction is a legitimate scenario — the sign
      // still means stop — so nothing is drawn when there is no NPC.
      junction({ control: 'stop' });
      scriptedVehicle('crossing', junctionCentreY(screenY));
      // On the right verge, the driver's side in right-hand traffic.
      furniture({ furniture: 'stop-sign', x: roadX + ROAD_WIDTH + 27, y: screenY - 15 });
      break;

    case 'driveway-crossing': {
      const walkedOff = pedestrianWalkOff(distance, event.triggerAtDistance, handled);
      nodes.push({
        kind: 'driveway-mouth',
        roadX,
        screenY,
        walkedOff,
        // Once they have walked clear they are out of the road, so a driver who
        // already stopped for them cannot then be punished for it.
        solids: walkedOff < 1 ? [pedestrianBody(drivewayPedestrianX(walkedOff), screenY - 3)] : [],
      });
      break;
    }

    case 'open-road-crossing':
      // Three independent pieces: the warning board, the crossing, and whoever
      // is on it. A level swaps any one without touching the other two.
      furniture({ furniture: 'warning-sign', x: roadX - 28, y: screenY - 20, legend: 'PED' });
      nodes.push({ kind: 'crossing-approach', roadX, y: screenY - 16, height: 34 });
      nodes.push(pedestrianGroupNode(roadX, screenY, scene.pedestrians));
      break;

    case 'tutorial-cue':
      switch (scene.cue) {
        case 'steer_left':
          furniture({ furniture: 'roadside-sign', x: roadX + ROAD_WIDTH + 40, y: screenY - 24, top: 'STEER', bottom: 'LEFT', color: '#1d4ed8' });
          laneArrow(CANVAS_WIDTH / 2, screenY + 18, 'left');
          furniture({ furniture: 'traffic-cone', x: roadX + ROAD_WIDTH - 38, y: screenY + 18, scale: 0.75 });
          furniture({ furniture: 'traffic-cone', x: roadX + ROAD_WIDTH - 20, y: screenY + 36, scale: 0.65 });
          break;
        case 'steer_right':
          furniture({ furniture: 'roadside-sign', x: roadX - 40, y: screenY - 24, top: 'STEER', bottom: 'RIGHT', color: '#1d4ed8' });
          laneArrow(CANVAS_WIDTH / 2, screenY + 18, 'right');
          furniture({ furniture: 'traffic-cone', x: roadX + 38, y: screenY + 18, scale: 0.75 });
          furniture({ furniture: 'traffic-cone', x: roadX + 20, y: screenY + 36, scale: 0.65 });
          break;
        case 'slow_down':
          furniture({ furniture: 'roadside-sign', x: roadX + ROAD_WIDTH + 42, y: screenY - 26, top: 'SLOW', bottom: 'DOWN', color: '#b45309' });
          laneArrow(CANVAS_WIDTH / 2, screenY + 18, 'down', '#fbbf24');
          furniture({ furniture: 'traffic-cone', x: roadX + 36, y: screenY + 42, scale: 0.58 });
          furniture({ furniture: 'traffic-cone', x: roadX + ROAD_WIDTH - 36, y: screenY + 42, scale: 0.58 });
          break;
        case 'start_drive':
          furniture({ furniture: 'roadside-sign', x: roadX - 42, y: screenY - 8, top: 'START', bottom: 'DRIVE', color: '#166534' });
          laneArrow(CANVAS_WIDTH / 2, screenY + 40, 'up');
          break;
      }
      break;

    case 'bend-warning':
      furniture({ furniture: 'warning-sign', x: roadX + ROAD_WIDTH + 28, y: screenY - 18, legend: 'TURN' });
      furniture({ furniture: 'chevron', x: roadX + ROAD_WIDTH - 8, y: screenY + 8 });
      furniture({ furniture: 'chevron', x: roadX + ROAD_WIDTH - 8, y: screenY + 37 });
      break;

    case 'road-actor': {
      const spec = ROAD_ACTORS[scene.actor.kind];
      // A declared side overrides the actor's own habit; with neither, the
      // frame's alternation - which only the scenes that use it may advance.
      const declared = scene.actor.side ?? spec.side;
      const lane = declared === 'inner' ? -1 : declared === 'curb' ? 1 : resolveSide(screenY);
      nodes.push(roadActorNode({ actor: scene.actor, roadX, y: screenY, oncomingLanes, lane }));
      break;
    }

    case 'generic-hazard':
      // Draws a warning glyph and nothing solid, but still takes a side — and
      // so still advances the alternation the next road actor reads.
      nodes.push({
        kind: 'hazard-glyph',
        x: ownLaneX(roadX, oncomingLanes, resolveSide(screenY)),
        y: screenY,
        alpha: 0.5 + Math.sin(now * 0.008) * 0.3,
      });
      break;

    case 'speed-limit-sign':
      furniture({
        furniture: 'speed-limit',
        x: roadX + ROAD_WIDTH + 30,
        y: screenY,
        limit: event.postedSpeed ?? level.speedLimit,
      });
      break;

    case 'lane-paint':
      nodes.push({ kind: 'lane-paint', roadX, screenY, paint: scene.paint });
      break;

    case 'merge-arrows':
      nodes.push({ kind: 'merge-arrows', roadX, screenY });
      break;

    case 'overtaking-oncoming':
      nodes.push({
        kind: 'static-vehicle',
        vehicle: 'oncoming',
        x: roadX + ROAD_WIDTH / 2,
        y: screenY - 40,
        scale: 0.85,
        solids: [bodyAt(roadX + ROAD_WIDTH / 2, screenY - 40, 28, 48, 'vehicle', 'an oncoming vehicle')],
      });
      nodes.push({ kind: 'overtaking-barrier', roadX, screenY });
      break;

    case 'roundabout':
      nodes.push({ kind: 'roundabout', roadX, screenY });
      // Alone among the NPC paths this one is always turning, so the car has to
      // be turned with it: drawn flat it reads as a vehicle sliding sideways
      // across the ring rather than driving round it, and "it is already going
      // round" is the whole thing the player is being asked to notice.
      scriptedVehicle('circulating', screenY);
      break;

    case 'npc-crossing-junction':
      junction();
      scriptedVehicle('crossing', junctionCentreY(screenY));
      break;

    case 'npc-side-road':
      // One arm only, on the side the vehicle is actually coming from — a minor
      // road joining a highway, not a controlled crossroads. Reading it off the
      // path is what stops a jeepney arriving from the right out of an opening
      // drawn on the left.
      //
      // The line across the player's own approach is painted only where the
      // player is the one who has to give way. A vehicle that `yields` is
      // waiting for *them*, so priority is theirs and a give-way line here
      // would be the road contradicting the scenario: it tells a driver they
      // are obliged to stop, on the one occasion the whole point is that
      // stopping is a courtesy they chose.
      junction({
        side: event.npc?.path === 'crossing_from_right' ? 'right' : 'left',
        control: event.npc?.yields ? 'none' : 'give-way',
      });
      // A vehicle *joining* the road makes a curved turn onto it and drives
      // away in the player's direction, so it is drawn nose-first and rotated;
      // a waiting or crossing one keeps the side-on crossing sprite.
      if (event.npc) {
        scriptedVehicle(event.npc.emerges ? 'joining' : 'crossing', junctionCentreY(screenY));
      }
      break;

    case 'npc-following': {
      const follower = scriptedVehicle('following', screenY);
      if (follower && event.npc?.mirror && !handled) {
        nodes.push({
          kind: 'rear-view',
          roadX,
          npcX: follower.at.x,
          proximity: rearProximity(follower.at.y),
          vehicle: inTheMirror(event.npc),
        });
      }
      break;
    }

    case 'npc-filtering': {
      // Anchored on the player's own row rather than the event's: the rider's
      // whole path is measured against where the driver is, and pegging it to
      // the scenario's row would put them alongside a point of the road rather
      // than alongside the car.
      const rider = scriptedVehicle('filtering', screenY);
      if (rider && event.npc?.mirror && !handled) {
        nodes.push({
          kind: 'rear-view',
          roadX,
          npcX: rider.at.x,
          proximity: rearProximity(rider.at.y),
          vehicle: inTheMirror(event.npc),
        });
      }
      break;
    }

    case 'npc-lead-vehicle':
      // Anchored on its own row, not on the event's: the vehicle has driven
      // itself to wherever it has got to, and the transform reads that. Passing
      // the event's row would peg traffic to the sign it happens to be near.
      scriptedVehicle('leading', screenY);
      break;

    case 'npc-merging':
      scriptedVehicle('merging', screenY);
      break;

    case 'npc-oncoming':
      // The declared vehicle and nothing else. This carried a left-turn arrow
      // for a while, copied from `oncoming-left-turn` below — but a vehicle
      // coming the other way is not turning, and painting an arrow under it
      // put a manoeuvre on the road that no scenario had declared. It showed
      // up under a bus on a blind bend and under the car behind a double
      // yellow line, in both cases saying something the event did not mean.
      scriptedVehicle('oncoming', screenY - 35);
      break;

    case 'npc-oncoming-turning':
      // Drawn on a junction, unlike a plain oncoming vehicle: a car turning
      // left across you has to have somewhere to turn into, or the movement
      // reads as it drifting out of its lane.
      junction();
      scriptedVehicle('oncoming-turning', junctionCentreY(screenY));
      break;

    case 'npc-ambulance': {
      // Some emergency events happen *at* a junction ("clear the junction
      // before you pull over"): the scene declares one, so it must be drawn
      // ahead or the decision is put over empty road. The ambulance closes from
      // behind, so the two never fight for the same part of the frame.
      if (event.scene === 'intersection' || event.scene === 'side_road' || event.scene === 'junction_t') {
        junction({ control: 'stop', crosswalk: true });
      }
      // Never always-solid: an ambulance holding behind you cannot be hit.
      const ambulance = scriptedVehicle('ambulance', screenY, { solid: false });
      if (ambulance && !handled) {
        nodes.push({
          kind: 'siren-alert',
          roadX,
          npcX: ambulance.at.x,
          proximity: rearProximity(ambulance.at.y),
          vehicle: inTheMirror(event.npc!),
        });
      }
      break;
    }

    case 'junction': {
      const side_ =
        event.scene === 'side_road' || event.scene === 'junction_t'
          ? event.maneuver?.direction === 'left'
            ? ('left' as const)
            : ('right' as const)
          : undefined;
      // The path the turn actually takes is part of the junction, drawn from
      // the lane the turn has to be made from. It arcs onto the same row
      // `junctionCentreY` hands the driving car, so the guide and the manoeuvre
      // cannot disagree. That lane is the one graded, so the guide is a marker
      // of the response and stands only where the support level shows it.
      const turning =
        showsResponse && event.maneuver && event.maneuver.direction !== 'either' ? event.maneuver : null;
      junction({
        ...(side_ ? { side: side_ } : {}),
        ...(turning
          ? {
              turnPath: {
                geometry: intersectionGeometry(screenY),
                direction: turning.direction as 'left' | 'right',
                lane: resolveLaneRole(turning.lane, oncomingLanes),
              },
            }
          : {}),
      });
      break;
    }

    case 'give-way-junction':
      // Only the scripted vehicle is drawn — no static prop, so a "clear in
      // both directions" give-way genuinely shows a clear junction rather than
      // a car parked on the left that never moves.
      junction({ control: 'give-way' });
      furniture({ furniture: 'yield-sign', x: roadX + ROAD_WIDTH + 28, y: screenY - 16 });
      scriptedVehicle('crossing', junctionCentreY(screenY));
      break;

    case 'no-entry-junction':
      junction();
      furniture({ furniture: 'no-entry-sign', x: roadX + ROAD_WIDTH + 27, y: screenY - 16 });
      break;

    case 'oncoming-left-turn':
      nodes.push({
        kind: 'static-vehicle',
        vehicle: 'oncoming',
        x: roadX + ROAD_WIDTH / 2,
        y: screenY - 35,
        scale: 0.85,
        solids: [bodyAt(roadX + ROAD_WIDTH / 2, screenY - 35, 28, 48, 'vehicle', 'an oncoming vehicle')],
      });
      laneArrow(roadX + LANE_WIDTH / 2, screenY + 20, 'left', '#f0c929');
      break;

    case 'cross-street':
      nodes.push({ kind: 'cross-street', screenY });
      break;

    case 'lane-arrow':
      laneArrow(
        scene.direction === 'right' ? roadX + ROAD_WIDTH - LANE_WIDTH / 2 : roadX + LANE_WIDTH / 2,
        screenY,
        scene.direction
      );
      break;

    case 'compliance-icon':
      furniture({
        furniture: 'compliance-icon',
        x: CANVAS_WIDTH / 2,
        y: screenY,
        glyph: scene.glyph,
        color: scene.color,
      });
      break;

    case 'checkpoint-officer':
      furniture({ furniture: 'checkpoint-officer', x: roadX - 30, y: screenY, scale: 0.9 });
      break;

    case 'main-road-junction': {
      // Hold the crossroads in place once you have arrived at it; it only
      // slides past after the call has been made and you drive through.
      // Yielding earns clear passage, so a correct call is never punished by
      // traffic that reappears while you are still crossing.
      const traffic = mainRoadTraffic(screenY, handled, now);
      nodes.push({
        kind: 'main-road-junction',
        roadX,
        screenY,
        traffic,
        solids: traffic.cars.map(car =>
          bodyAt(car.x, car.y, 50, 24, 'vehicle', 'a vehicle crossing on the main road')
        ),
      });
      break;
    }

    /**
     * A crash that has already happened. Every part of it comes from one prefab
     * call, so the wreck a driver can see and the body they can hit are the
     * same declaration — see `crashSceneNodes`.
     */
    case 'road-crash':
      nodes.push(...crashSceneNodes({ roadX, screenY, oncomingLanes }));
      break;

    // On the right curb, level with the point the scenario is measured to. It
    // stands in nobody's way: the question is whether the car comes to rest
    // beside it, not whether it can be steered around.
    case 'fire-hydrant':
      furniture({ furniture: 'fire-hydrant', x: roadX + ROAD_WIDTH + 12, y: screenY });
      break;

    case 'nothing':
      break;
  }

  // After the scene, so it is painted over it: it is nearer the camera than
  // anything the scenario put up the road.
  rearVehicle();

  return nodes;
};
