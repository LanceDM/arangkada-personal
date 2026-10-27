/**
 * Everything standing on this frame, composed once.
 *
 * The world decides this, not the drawing pass. Each visible event's scene is
 * resolved a single time, into nodes that carry their own solids: the renderer
 * paints the nodes, the collision pass tests the bodies those same nodes
 * declared, and neither can move without the other.
 *
 * What lives here is the state a scene cannot own because it spans the frame or
 * the frames before it — the alternating side, and a follower's carried
 * position. Both are lent to the scene builder as callbacks, so this pass holds
 * the state and the scene builder makes the decisions.
 *
 * Order matters: `firstCarCollision` reports the first body it overlaps, so
 * colliders are produced in the same painter order the scene is composed in.
 */
import { npcHitbox, npcTransform, type NpcRoadContext } from '@/features/driving-sim/domain/systems/updateNpcVehicles';
import type { RoadTraffic } from '@/features/driving-sim/domain/systems/roadTraffic';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { distanceToScreenY, type LaneIndex } from './vehiclePhysics';

/** The screen row the player's own car sits on, which never moves. */
const PLAYER_ROW = distanceToScreenY(0, 0);
import { paceOf } from './DrivingPace';
import { bodyRect, type WorldBody } from './WorldBody';
import { collidersOf, eventSceneNodes } from '@/features/driving-sim/domain/scene/SceneBuilder';
import { routeSceneNodes } from '@/features/driving-sim/domain/scene/routeSceneNodes';
import type { PosedVehicle } from '@/features/driving-sim/domain/scene/prefabs';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import {
  createSideResolver,
  oncomingLanesOf,
  placeVisibleEvents,
  supportOf,
  type EventPlacement,
  type FrameView,
} from './eventPlacement';

/** Extra control the drive loop has over the scripted NPCs on this frame. */
export interface NpcFrameOptions {
  /** Which lane a vehicle closing from behind has committed to. */
  chaseLane?: LaneIndex;
  /**
   * The player's current speed, for traffic that moves relative to it rather
   * than at a fixed screen step.
   */
  playerSpeed?: number;
  /** The lane the player is in, so a follower knows whether it may pass. */
  playerLane?: LaneIndex;
  /** Road distance added to the player's when placing NPCs, for the frozen right-of-way resolution. */
  advance?: number;
  /**
   * A follower's cross-frame state — its screen-y last frame and whether it has
   * committed to overtaking — so `closing_from_behind` moves continuously
   * instead of being recomputed each frame. Advanced exactly once per frame,
   * here: transforming a follower twice would step it at double speed.
   */
  followerState?: { y: number | null; passing: boolean };
  /**
   * The world is held still this frame, so nothing that carries its own motion
   * may advance. Without it a vehicle closing from behind kept driving up the
   * frame while the drive was frozen for a panel, and the driver came back to a
   * car that had covered the gap while they were reading.
   */
  frozen?: boolean;
  /**
   * Where each self-driving scenario vehicle has got to, keyed by its event.
   *
   * Read here, never advanced here: `advanceRoadTraffic` moves them once per
   * frame before the frame is composed, so a lead vehicle's distance is a fact
   * about the frame rather than about when in the frame it was asked for.
   * Absent — a golden sample, a test — places each at its nominal entry gap.
   */
  traffic?: RoadTraffic;
  /** Injectable clock, so the two scenes with moving solids are testable. */
  now?: () => number;
}

export interface WorldFrame {
  /** The scene standing on the road this frame, in painter order. */
  nodes: SceneNode[];
  /** Every solid the scene declared, in that same order. */
  colliders: WorldBody[];
}

/**
 * Everything on this frame: the scene each visible event puts on the road, and
 * what of it can be hit.
 */
export const composeWorldFrame = (view: FrameView, npc: NpcFrameOptions = {}): WorldFrame => {
  const oncomingLanes = oncomingLanesOf(view.level);
  const now = (npc.now ?? Date.now)();
  const road: NpcRoadContext = {
    oncomingLanes,
    route: view.level.route,
    speedLimit: view.level.speedLimit,
    pace: paceOf(view.level),
    playerSpeed: npc.playerSpeed,
    nowMs: now,
    chaseLane: npc.chaseLane,
    playerLane: npc.playerLane,
    followerY: npc.followerState ? npc.followerState.y : undefined,
    followerPassing: npc.followerState ? npc.followerState.passing : undefined,
    frozen: npc.frozen,
  };
  // Scripted NPCs read their progress off a distance that can run ahead of the
  // player's: during a frozen right-of-way decision the player is not moving,
  // and the whole point is that the other vehicle clears the junction first.
  const npcDistance = view.distance + (npc.advance ?? 0);

  const resolveSide = createSideResolver();
  // The road first, then what stands on it: a level that declares its own route
  // draws its gantries, its gore and its gates from that one description, and
  // an event's scene overlays them rather than inventing them.
  const nodes: SceneNode[] = routeSceneNodes(view);
  const colliders: WorldBody[] = collidersOf(nodes);

  /** Poses one event's scripted vehicle, advancing a follower's carried state. */
  const poseVehicleFor =
    ({ event, roadX, handled }: EventPlacement) =>
    (spec: NpcVehicleSpec, anchorY: number, alwaysSolid: boolean): PosedVehicle | null => {
      // The one part of the road context that is per-event rather than per-frame.
      // `null` is a drive reporting that this vehicle is not on the road yet;
      // `undefined` is no drive at all, which is a different thing — see `lead`
      // on `NpcRoadContext`.
      const lead = npc.traffic ? (npc.traffic.get(event.id) ?? null) : undefined;
      const at = npcTransform(spec, event.triggerAtDistance, npcDistance, roadX, anchorY, handled, {
        ...road,
        lead,
      });
      if (spec.path === 'closing_from_behind' && npc.followerState && !npc.frozen) {
        npc.followerState.y = at.y;
        npc.followerState.passing = at.passing ?? npc.followerState.passing;
      }
      if (!at.active) return null;
      // A vehicle closing from behind is solid only once it has been let past
      // and is drawing alongside: you cannot be rear-ended while it holds, but
      // driving back into its lane as it passes is your collision to own.
      if (!alwaysSolid && at.solid !== true) return { at, solid: null };
      const box = npcHitbox(spec, at);
      return {
        at,
        solid: box ? bodyRect(box.x, box.y, box.width, box.height, 'vehicle', spec.label) : null,
      };
    };

  for (const placement of placeVisibleEvents(view)) {
    const composed = eventSceneNodes(placement, {
      level: view.level,
      oncomingLanes,
      distance: view.distance,
      now,
      support: supportOf(view),
      resolveSide: screenY => resolveSide(placement.index, screenY),
      poseVehicle: poseVehicleFor(placement),
    });
    // Past its own event, a scene contributes only the traffic that is still
    // in front of the driver — the vehicle they are watching leave. See `runOn`
    // on `EventPlacement`. Anything behind them has been passed and is the
    // thing the plain cutoff was always right to drop; anything else the scene
    // built is furniture they have already driven through.
    const kept = placement.runOn
      ? composed.filter(
          node =>
            (node.kind === 'scripted-vehicle' && node.at.y < PLAYER_ROW) ||
            node.kind === 'rear-view'
        )
      : composed;
    nodes.push(...kept);
    colliders.push(...collidersOf(kept));
  }

  return { nodes, colliders };
};
