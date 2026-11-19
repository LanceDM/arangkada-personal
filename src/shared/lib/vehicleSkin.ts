/**
 * The player's vehicle skin (2026-11-19): how the player's own vehicle is
 * drawn, and nothing else. Size, handling, collisions, scenarios and grading
 * are the car's whichever skin is chosen.
 */
export type VehicleSkin = 'car' | 'motorcycle';

export const VEHICLE_SKINS: readonly VehicleSkin[] = ['car', 'motorcycle'];

export const DEFAULT_VEHICLE_SKIN: VehicleSkin = 'car';

/** Each skin's name, as the picker and the study question show it. */
export const VEHICLE_SKIN_NAMES: Record<VehicleSkin, { en: string; fil: string }> = {
  car: { en: 'Car', fil: 'Kotse' },
  motorcycle: { en: 'Motorcycle', fil: 'Motorsiklo' },
};

export const isVehicleSkin = (value: unknown): value is VehicleSkin => value === 'car' || value === 'motorcycle';
