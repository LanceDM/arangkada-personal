/**
 * One event's scene, resolved exactly once.
 *
 * Called once per placement by `composeWorldFrame`, which is the single pass
 * over a frame. What comes back is data: the canvas renderer paints it, and the
 * solids each node declares are the same bodies the collision pass tests. One
 * composition answers both questions, so a sprite and the thing you can hit
 * cannot drift apart.
 *
 * Everything an event's scene depends on is settled here — which prefabs stand
 * on the road, where its scripted vehicle is and whether it is solid, and which
 * side of the carriageway the frame's alternation gave it. The frame composer
 * owns the state those decisions read — the alternation's running sequence, a
 * follower's carried position — and lends it in through `SceneBuildContext`
 * rather than resolving the scene itself to use it.
 *
 * Events that declare their scene — a checkpoint, a marking, a signed road
 * situation, a vehicle failure — are composed from what they declare. Older
 * content, which does not, has its scene named by `resolveScene` first.
 */
import type { SupportLevel } from '@/domain/learner/competency';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import type { EventPlacement } from '@/features/driving-sim/domain/world/eventPlacement';
import { blockingQueueCars, insideBoxY } from '@/features/driving-sim/domain/world/sceneGeometry';
import { bodyRect } from '@/features/driving-sim/domain/world/WorldBody';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import { junctionCentreY } from '@/features/driving-sim/domain/world/junctionGeometry';
import { auxiliaryAt } from '@/features/driving-sim/domain/world/routeGeometry';
import { CANVAS_HEIGHT } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { markingSceneNodes } from './markingScene';
import { signSceneNodes } from './signScene';
import { resolvedSceneNodes } from './resolvedSceneNodes';
import { resolveScene } from '@/features/driving-sim/domain/scene/ResolvedScene';
import { pedestrianGroupNode, roadActorNode, scriptedVehicleNode, type PoseVehicle } from './prefabs';
import type { SceneNode, ScriptedVehicleRole } from './SceneNode';

/**
 * What a checkpoint is called on the road. Its name only: what to do there is
 * the move, which the support level decides whether to show, and the
 * world, drawn the same at every level, never shows it.
 */
const CHECKPOINT_LABEL = 'LTO CHECKPOINT';

/**
 * The traffic that makes a yellow box mean something: a vehicle committed
 * inside it, or a queue backed up beyond it when the right answer is to wait.
 * Not part of the paint, which is why it composes alongside the marking rather
 * than within it.
 */
const yellowBoxTraffic = (placement: EventPlacement, poseVehicle: PoseVehicle): SceneNode[] => {
  const { event, roadX, screenY, handled } = placement;
  if (handled) return [];

  if (event.npc) {
    const posed = poseVehicle(event.npc, junctionCentreY(screenY), true);
    return posed ? [scriptedVehicleNode('crossing', event.npc, posed)] : [];
  }
  if (event.correctAction !== 'stop') return [];

  return blockingQueueCars(roadX, screenY).map(car => ({
    kind: 'static-vehicle',
    vehicle: 'crossing-car',
    x: car.x,
    y: car.y,
    color: car.color,
    solids: [bodyRect(car.x - 25, car.y - 12, 50, 24, 'vehicle', 'the traffic jamming the junction')],
  }));
};

/**
 * The vehicle a scenario says has stopped inside the box, as its `actor`: a
 * tricycle picking up a passenger where no vehicle may stay.
 *
 * Composed beside the paint rather than within it, the way `yellowBoxTraffic`
 * is, and standing just past the box's near edge in the lane it declares (its
 * own habit otherwise, and the inner lane for an actor with none), so it is in
 * the box without standing on the queue jammed across it. Solid, like every
 * actor: a driver who carries on into the box meets it. Gone once the scenario
 * is answered, with the queue, so a driver who waited drives on through.
 */
const vehicleInTheBox = (placement: EventPlacement, oncomingLanes: number): SceneNode[] => {
  const { event, roadX, screenY, handled } = placement;
  if (!event.actor || handled) return [];
  const spec = ROAD_ACTORS[event.actor.kind];
  const side = event.actor.side ?? (spec.side === 'alternating' ? 'inner' : spec.side);
  return [
    roadActorNode({
      actor: event.actor,
      roadX,
      y: insideBoxY(screenY, spec.height),
      oncomingLanes,
      lane: side === 'curb' ? 1 : -1,
    }),
  ];
};

/**
 * How a vehicle sharing the driver's own carriageway is drawn, by the path it
 * is on.
 *
 * Only the two that a *signed* scene can carry. A vehicle closing from behind
 * is deliberately absent: it already has its own scene (`npc-following`,
 * `npc-ambulance`), composed through `resolveScene`, and posing it a second
 * time here would advance the follower's carried position twice in one frame —
 * which is the same double-step the pose is owned by the frame composer to
 * prevent.
 */
const OWN_ROAD_ROLES: Partial<Record<
  NonNullable<EventPlacement['event']['npc']>['path'],
  ScriptedVehicleRole
>> = {
  travelling_ahead: 'leading',
  merging_from_ramp: 'merging',
};

/**
 * The traffic a signed scene has on it.
 *
 * A sign scene draws the road the sign stands beside; who else is on that road
 * is a separate declaration, so the two compose side by side rather than one
 * inside the other. That is what lets an expressway board stand over a lane a
 * truck is actually travelling in, instead of over an empty one the prose then
 * has to claim was occupied.
 *
 * Never forced solid: each path decides for itself in `npcTransform`, which is
 * what keeps a vehicle still holding behind you from being a rear-end waiting
 * to happen.
 */
const ownRoadVehicle = (placement: EventPlacement, poseVehicle: PoseVehicle): SceneNode[] => {
  const { event, screenY } = placement;
  const role = event.npc && OWN_ROAD_ROLES[event.npc.path];
  if (!role || !event.npc) return [];
  const posed = poseVehicle(event.npc, screenY, false);
  return posed ? [scriptedVehicleNode(role, event.npc, posed)] : [];
};

/**
 * The people a scenario declares, for the scenes that do not stand them on a
 * crossing of their own.
 *
 * Same bargain as `ownRoadVehicle` above, and the same one `signal` already
 * makes inside `signSceneNodes`: a scene draws the road, and who is standing on
 * it is a separate declaration that composes beside it. That is what lets a
 * work crew stand beside a closure, or a stranded driver beside their own
 * vehicle, without either scene owning a pedestrian group of its own.
 *
 * Scenes that already carry their people — every crossing — are left alone, so
 * nobody is drawn twice. Asked of the composed nodes rather than of a list of
 * scene names, because the nodes are the thing that would be duplicated.
 */
const declaredPedestrians = (placement: EventPlacement, composed: SceneNode[]): SceneNode[] => {
  const people = placement.event.pedestrians;
  if (!people?.length) return [];
  if (composed.some(node => node.kind === 'pedestrian-group' || node.kind === 'crossing')) return [];
  return [pedestrianGroupNode(placement.roadX, placement.screenY, people)];
};

/**
 * The bay a scenario declares, for the scenes that do not draw one themselves.
 *
 * A `bay` is three things at once: a stretch of curb the wheel is allowed past,
 * a place the grader watches for the car to come to rest, and a space on the
 * road. It only ever had the first two. The paint was drawn inside the *signed*
 * lay-by scene, so a scenario that declares a bay without standing a board
 * beside it was graded on stopping somewhere the road showed no sign of — the
 * driver is told to pull off to the right, and the right is bare asphalt.
 *
 * Composed last and only where nothing has drawn one, which is what leaves the
 * signed lay-by exactly as it was: the sign scene still owns its own bay, and
 * still positions the plate beyond it.
 */
const declaredBay = (placement: EventPlacement, composed: SceneNode[]): SceneNode[] => {
  const { event, roadX, screenY } = placement;
  if (!event.bay) return [];
  const drawn = composed.some(
    node => node.kind === 'road-marking' && node.marking.mark === 'pull-over-bay'
  );
  if (drawn) return [];
  return [{ kind: 'road-marking', marking: { mark: 'pull-over-bay', roadX, screenY, bay: event.bay } }];
};

export interface SceneBuildContext {
  level: LevelConfig;
  oncomingLanes: number;
  /** Frozen per frame, so the two scenes with moving parts are testable. */
  now: number;
  /** The player's road distance, for scenes that animate against it. */
  distance: number;
  /**
   * The support level the level is played at. A scene asks `scenarioSupport`
   * whether it may mark the response being graded - the gantry over the lane,
   * the path a turn takes from it, a pavement arrow picked out - and composes
   * those markers only where it may. Nothing solid reads it.
   */
  support: SupportLevel;
  /**
   * The frame's alternating side. Calling it advances the sequence every later
   * scene sees, so only a scene that genuinely stands to one side may.
   */
  resolveSide: (screenY: number) => 1 | -1;
  /**
   * Poses this event's scripted vehicle for this frame, and reports whether it
   * is solid. Owned by the frame composer because posing a follower advances
   * state carried between frames, so it may happen only once per frame.
   */
  poseVehicle: PoseVehicle;
}

export const eventSceneNodes = (
  placement: EventPlacement,
  { level, oncomingLanes, now, distance, support, resolveSide, poseVehicle }: SceneBuildContext
): SceneNode[] => {
  const { event } = placement;
  const { showsResponse } = scenarioSupport(event, support);

  // Checkpoints, markings, signed scenes and vehicle failures own their whole
  // scene and are composed from what they declare. Everything else is older
  // content whose scene has to be worked out first.
  if (event.inspection) {
    const { roadX, screenY, handled } = placement;
    // An enforcer flagging the car down stands at the curb it is to pull over
    // to. Neither puts anything solid on the road.
    if (event.inspection.pullOver) return [{ kind: 'traffic-stop', roadX, screenY }];
    const readable = screenY > 60 && screenY < CANVAS_HEIGHT - 120 && !handled;
    return [{ kind: 'checkpoint', roadX, screenY, label: readable ? CHECKPOINT_LABEL : null }];
  }

  if (event.marking) {
    const nodes = markingSceneNodes(placement, event.marking, level, oncomingLanes, now, showsResponse);
    if (event.marking.art === 'yellow_box') {
      nodes.push(...yellowBoxTraffic(placement, poseVehicle));
      nodes.push(...vehicleInTheBox(placement, oncomingLanes));
    }
    return nodes;
  }

  if (event.sign && event.scene) {
    const nodes = signSceneNodes(
      placement,
      event.sign,
      event.scene,
      oncomingLanes,
      auxiliaryAt(event.triggerAtDistance, level.route)?.width ?? 0,
      showsResponse
    );
    // A signalised junction's scripted vehicle — one still clearing the box on
    // a fresh green — is the only cross traffic, so it composes alongside the
    // scene rather than within it.
    if (event.scene === 'signal' && event.npc && !placement.handled) {
      const posed = poseVehicle(event.npc, junctionCentreY(placement.screenY), true);
      if (posed) nodes.push(scriptedVehicleNode('crossing', event.npc, posed));
      return nodes;
    }
    nodes.push(...ownRoadVehicle(placement, poseVehicle));
    nodes.push(...declaredPedestrians(placement, nodes));
    nodes.push(...declaredBay(placement, nodes));
    return nodes;
  }

  if (event.emergency) {
    const { roadX, screenY } = placement;
    return [{ kind: 'vehicle-failure', failure: event.emergency, roadX, screenY }];
  }

  // Weather hides road rather than standing on it: the veil is painted over the
  // whole frame once the scene is complete, and a warning prop here would put
  // an obstacle where the lesson is that you cannot tell whether there is one.
  if (event.effect?.visibility !== undefined) return [];

  const scene = resolveScene(event, { isTutorialLevel: level.id === 0 });
  const composed = resolvedSceneNodes(placement, scene, {
    level,
    oncomingLanes,
    distance,
    now,
    showsResponse,
    resolveSide,
    poseVehicle,
  });
  composed.push(...declaredPedestrians(placement, composed));
  composed.push(...declaredBay(placement, composed));
  return composed;
};

/** Every solid the composed scene declares, in the order it was composed. */
export const collidersOf = (nodes: readonly SceneNode[]) =>
  nodes.flatMap(node => node.solids ?? []);
