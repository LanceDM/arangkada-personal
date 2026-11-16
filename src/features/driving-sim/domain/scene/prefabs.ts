/**
 * Canonical scene prefabs.
 *
 * A prefab is one configured composition that every level places its own
 * instance of. Levels differ by configuration and position, never by having
 * their own copy of the drawing, geometry or collision behaviour — which is
 * what stops "the junction in Level 5" from drifting away from "the junction in
 * Level 3" while both still claim to be a junction.
 *
 * Only compositions with more than one construction site live here. A node kind
 * built in exactly one place is already canonical, and wrapping it would add a
 * name without removing a duplicate.
 */
import { bodyAt, type WorldBody } from '@/features/driving-sim/domain/world/WorldBody';
import type { NpcTransform } from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { crossingPedestrianPositions, crossingWalkerPositions } from '@/features/driving-sim/domain/world/sceneGeometry';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import { ownLaneX } from '@/features/driving-sim/domain/world/eventPlacement';
import type { CrossingPedestrian, RoadActorSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import type {
  GantryPanel,
  JunctionControl,
  JunctionTurnPath,
  SceneNode,
  ScriptedVehicleRole,
} from './SceneNode';

export interface JunctionOptions {
  roadX: number;
  screenY: number;
  /** Which side a side street reaches out to; absent means a full crossroads. */
  side?: 'left' | 'right';
  /** Uncontrolled unless the scenario says otherwise. */
  control?: JunctionControl;
  /** Whether the cross street is drawn carrying traffic of its own. */
  crossTraffic?: boolean;
  crosswalk?: boolean;
  turnPath?: JunctionTurnPath;
}

/**
 * The junction every level uses: a crossroads, or one arm of it, controlled by
 * a stop line, a give-way line or nothing at all.
 */
export const junctionNode = ({
  roadX,
  screenY,
  side,
  control = 'none',
  crossTraffic = false,
  crosswalk = false,
  turnPath,
}: JunctionOptions): SceneNode => ({
  kind: 'junction',
  shape: {
    roadX,
    screenY,
    ...(side ? { side } : {}),
    control,
    crossTraffic,
    crosswalk,
    ...(turnPath ? { turnPath } : {}),
  },
});

/**
 * A sign gantry across the carriageway.
 *
 * Placed by the lane-discipline scene, which numbers the lanes, and by the exit
 * scene, which points at the one that leaves - two construction sites for one
 * composition, which is what makes it a prefab rather than a node one place
 * happens to build. It carries nothing solid: it is over the road, not in it.
 */
export const gantryNode = (
  roadX: number,
  screenY: number,
  panels: GantryPanel[]
): SceneNode => ({ kind: 'overhead-gantry', roadX, screenY, panels });

/**
 * People standing on a crossing, and the ones among them you can hit.
 *
 * `solid` is per person: a scene can put someone on the stripes who is only
 * scenery and someone who genuinely blocks the road, and the crossing draws
 * both the same way.
 */
export const pedestrianGroupNode = (
  roadX: number,
  y: number,
  people: CrossingPedestrian[],
  /** The crossing's walk this frame (`crossingWalk`); absent, they stand still beside the scene. */
  walk?: { walkIn: number; walkedOff: number },
  /** Standing beside the road: each one's step along the footpath this frame (`millAbout`). */
  dys?: number[]
): SceneNode => {
  if (!walk) {
    return {
      kind: 'pedestrian-group',
      roadX,
      y,
      people,
      ...(dys ? { dys } : {}),
      solids: crossingPedestrianPositions(roadX, people)
        .filter((_, index) => people[index].solid)
        .map(x => bodyAt(x, y - 4, 18, 34, 'pedestrian', 'a pedestrian on the crossing')),
    };
  }
  // Off the road once they have walked clear, so nothing is left to hit or draw.
  const xs = crossingWalkerPositions(roadX, people, walk.walkIn, walk.walkedOff).map(x =>
    walk.walkedOff >= 1 ? null : x
  );
  return {
    kind: 'pedestrian-group',
    roadX,
    y,
    people,
    xs,
    walking: (walk.walkIn > 0 && walk.walkIn < 1) || (walk.walkedOff > 0 && walk.walkedOff < 1),
    // Solid until the event is answered. Walking off they cross lanes the car
    // may be in, and a driver already judged for this crossing - stopped and
    // moving off, or gone through - is not then run into by its people.
    solids:
      walk.walkedOff > 0
        ? []
        : xs.flatMap((x, index) =>
            x !== null && people[index].solid ? [bodyAt(x, y - 4, 18, 34, 'pedestrian', 'a pedestrian on the crossing')] : []
          ),
  };
};

/**
 * How far each of a group standing beside the road has stepped along the
 * footpath this frame (2026-11-16): a slow few paces up and back, each out of
 * step with the next, so a school gate or a jeepney stop has people on it
 * rather than cut-outs. Drawn only; their bodies stay where they stand.
 */
export const millAbout = (count: number, now: number): number[] =>
  Array.from({ length: count }, (_, index) => Math.sin(now / 900 + index * 1.9) * 7);

/**
 * A scripted vehicle after the world has posed it for this frame.
 *
 * `solid` is null when the vehicle cannot be hit — a follower still holding
 * behind you is not a rear-end waiting to happen — so whether it is solid is
 * decided once, by the world, and carried to the node rather than recomputed.
 */
export interface PosedVehicle {
  at: NpcTransform;
  solid: WorldBody | null;
}

/**
 * Poses this frame's scripted vehicle for one event, at the row the scene wants
 * it on, and reports its body when it is solid. Null when the scenario has no
 * vehicle here or it is not yet on stage.
 *
 * Handed to the scene builders by the frame composer rather than called by
 * them: posing a vehicle that closes from behind advances state carried between
 * frames, so it must happen exactly once per frame.
 */
export type PoseVehicle = (
  spec: NpcVehicleSpec,
  anchorY: number,
  solid: boolean
) => PosedVehicle | null;

/**
 * The scenario's own vehicle, drawn and made solid from one decision: whether
 * it can be hit is settled where it is posed, and carried on the node that
 * draws it.
 */
export const scriptedVehicleNode = (
  role: ScriptedVehicleRole,
  npc: NpcVehicleSpec,
  posed: PosedVehicle
): SceneNode => ({
  kind: 'scripted-vehicle',
  role,
  npc,
  at: posed.at,
  ...(posed.solid ? { solids: [posed.solid] } : {}),
});

/**
 * A road crash that has already happened, as every node it is made of.
 *
 * One declaration, several nodes, one solid. A level says `road_crash` and gets
 * the wreck slewed across the lane, the vehicle that left the road lying in the
 * water beside it, and the debris between them — and the only body in the list
 * belongs to the wreck, because the wreck is the only part of it a driver can
 * hit. The picture and the hitbox come from the same call, which is the whole
 * reason this is a prefab rather than three things a level remembers to place
 * together.
 *
 * It was a single rounded rectangle before this. The scenario's own words
 * promised "a van in the creek and a car slewed across the lane, smoking" and
 * the road drew a plain square, which is exactly the disagreement between prose
 * and scene that `sceneDeclaration.test.ts` exists to stop — except nothing had
 * declared the rest of it at all.
 */
export const crashSceneNodes = ({
  roadX,
  screenY,
  oncomingLanes,
}: {
  roadX: number;
  screenY: number;
  /** How many lanes of opposing traffic the level declares. */
  oncomingLanes: number;
}): SceneNode[] => [
  // The backdrop first, so the wreck is painted over it.
  { kind: 'road-situation', situation: { situation: 'crash-scene', roadX, screenY } },
  // In the driver's own inner lane, which is the one the scenario blocks.
  roadActorNode({ actor: { kind: 'crashed_car' }, roadX, y: screenY, oncomingLanes, lane: -1 }),
];

/**
 * A vehicle or animal standing in one of the driver's own lanes, drawn and hit
 * as one body.
 *
 * Built wherever a scene stands one: an obstacle in the carriageway, the wreck
 * at a crash, a vehicle stopped inside a yellow box. Where it stands across the
 * road is the caller's to decide; how big it is and what the crash report calls
 * it are the actor's own (`ROAD_ACTORS`).
 */
export const roadActorNode = ({
  actor,
  roadX,
  y,
  oncomingLanes,
  lane,
}: {
  actor: RoadActorSpec;
  roadX: number;
  y: number;
  oncomingLanes: number;
  /** The driver's curb lane (1) or inner lane (-1). */
  lane: 1 | -1;
}): SceneNode => {
  const spec = ROAD_ACTORS[actor.kind];
  const x = ownLaneX(roadX, oncomingLanes, lane) + (spec.offset ?? 0);
  return {
    kind: 'road-actor',
    actor,
    x,
    y,
    solids: [bodyAt(x + (spec.hitOffset ?? 0), y, spec.width, spec.height, spec.kind, spec.label)],
  };
};
