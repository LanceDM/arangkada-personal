/**
 * One frame of the drive, described without reference to how it is drawn.
 *
 * This is the projection the world hands to a presentation layer: the road's
 * state, the scene the events compose into, and what is solid on it. It names
 * no canvas and no React, so the same frame feeds the renderer, the collision
 * pass and a test equally.
 */
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { CarState, CurveSpan } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { EnvObject } from '@/features/driving-sim/domain/world/roadsideScenery';
import type { WorldBody } from '@/features/driving-sim/domain/world/WorldBody';
import type { RoadAt } from '@/features/driving-sim/domain/world/eventPlacement';
import type { SceneNode } from './SceneNode';

export interface SceneFrame {
  car: CarState;
  /** How far the road texture has scrolled, for the moving surface. */
  roadOffset: number;
  envObjects: EnvObject[];
  curves: CurveSpan[];
  /** The level with the *live* (possibly re-rolled) events swapped in. */
  level: LevelConfig;
  /** The scene standing on the road, in painter order. */
  nodes: SceneNode[];
  /** Every solid the scene declared, in that same order. */
  colliders: WorldBody[];
  /** Where the road is at any screen row, so paint follows the same bend. */
  roadAt: RoadAt;
}
