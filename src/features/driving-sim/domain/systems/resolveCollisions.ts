/**
 * What the car hit this frame, if anything.
 *
 * Reads the world's own solid bodies. It used to read the boxes the drawing
 * pass happened to record while painting, which meant collision could not be
 * evaluated — or tested — without first rendering a frame.
 */
import { firstCarCollision, type CarState } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { WorldBody } from '@/features/driving-sim/domain/world/WorldBody';

/**
 * The first body the car overlaps, in painter order, or null. First rather than
 * nearest: the world composes farthest-to-nearest, so the first overlap is the
 * one the driver reached first.
 */
export const resolveCollisions = (car: CarState, bodies: readonly WorldBody[]): WorldBody | null =>
  firstCarCollision(car, bodies) ?? null;
