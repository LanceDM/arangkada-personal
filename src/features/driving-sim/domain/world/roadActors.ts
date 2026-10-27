/**
 * Everything that can stand in the carriageway as an obstacle, as world data:
 * which part of the road it habitually occupies, how big it is to hit, and what
 * the crash report calls it.
 *
 * `side` is the actor's own habit, not a rule: a cyclist hugs the curb and a
 * bus takes the inner lane because that is where those things are, while
 * anything with no natural side keeps the deterministic left/right alternation
 * `eventPlacement` gives it. A scene may override any of them.
 *
 * The sprites are the canvas layer's business and live beside the renderer,
 * keyed by the same `RoadActorKind`.
 */
import type { RoadActorKind } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { LANE_WIDTH } from './vehiclePhysics';
import type { WorldBody } from './WorldBody';

export interface RoadActorGeometry {
  side: 'curb' | 'inner' | 'alternating';
  /** Nudge off the lane centre, for actors that do not sit in the middle of it. */
  offset?: number;
  width: number;
  height: number;
  /** Body centre offset, where the sprite is not centred on its origin. */
  hitOffset?: number;
  kind: WorldBody['kind'];
  /** Plain-language name used in the crash report. */
  label: string;
}

export const ROAD_ACTORS: Record<RoadActorKind, RoadActorGeometry> = {
  bicycle: {
    // Hard against the curb, not mid-lane: the clearance the driver has to give
    // is the gap between the car and this edge.
    side: 'curb',
    offset: LANE_WIDTH / 2 - 14,
    width: 16,
    height: 34,
    kind: 'pedestrian',
    label: 'a cyclist sharing the carriageway',
  },
  motorcycle: {
    side: 'alternating',
    width: 24,
    height: 38,
    kind: 'vehicle',
    label: 'a motorcycle sharing your lane',
  },
  tricycle: {
    side: 'alternating',
    width: 34,
    height: 30,
    hitOffset: 8,
    kind: 'vehicle',
    label: 'a tricycle ahead',
  },
  jeepney: {
    side: 'alternating',
    width: 36,
    height: 54,
    kind: 'vehicle',
    label: 'a jeepney ahead',
  },
  smoke_belcher: {
    side: 'alternating',
    width: 32,
    height: 44,
    kind: 'vehicle',
    label: 'a smoke-belching vehicle ahead',
  },
  truck: {
    side: 'alternating',
    width: 42,
    height: 64,
    kind: 'vehicle',
    label: 'an overloaded truck ahead',
  },
  bus: {
    side: 'inner',
    width: 36,
    height: 70,
    kind: 'vehicle',
    label: 'a provincial bus ahead',
  },
  ambulance: {
    side: 'alternating',
    width: 29,
    height: 45,
    kind: 'vehicle',
    label: 'an emergency vehicle',
  },
  van: {
    // At the curb, where a vehicle that has stopped to let somebody out is.
    side: 'curb',
    width: 34,
    height: 54,
    kind: 'vehicle',
    label: 'a van stopped at the curb',
  },
  broken_down: {
    side: 'curb',
    width: 32,
    height: 44,
    kind: 'vehicle',
    label: 'a broken-down vehicle in your lane',
  },
  /**
   * Wider than it is long, because it is lying across the lane rather than
   * along it. The body is what the driver has to stop short of, so the shape
   * they can see and the shape they can hit are the same slewed rectangle.
   */
  crashed_car: {
    side: 'inner',
    width: 52,
    height: 34,
    kind: 'vehicle',
    label: 'a wrecked car across the lane',
  },
};
