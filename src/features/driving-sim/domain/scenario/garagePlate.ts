/**
 * One car, one plate (2026-11-16).
 *
 * A garage is assembled from points drawn on their own: the paperwork from
 * one pool, the registration check from another. Each was written with a
 * plate of its own, so a drawn garage could show the car as ABC 1435, ask
 * about "the plate XYZ 8829", and lay out papers for "DEF 4471". The point
 * that is about the plate decides it: the car is drawn with that plate, and
 * the paperwork's holder line is shown with the same one.
 *
 * The holder line is swapped where it is shown (`holderOnPlate`), not in the
 * content: a translation is checked against the words it was made from, and a
 * holder rewritten at assembly would no longer match them.
 */
import type { GarageHotspot, GarageStage } from './scenarioDefinition';

/** A Philippine private plate at the head of a holder line: "ABC 1435 — Toyota Vios". */
const LEADING_PLATE = /^[A-Z]{3} \d{3,4}(?= — )/;

export const stagePlate = (fallback: string, hotspots: readonly GarageHotspot[]): string =>
  hotspots.find(h => h.plate)?.plate ?? fallback;

/** The stage, drawn under the plate its registration check is about. */
export const withOnePlate = (stage: GarageStage): GarageStage => ({
  ...stage,
  plate: stagePlate(stage.plate, stage.hotspots),
});

/** A paperwork holder line, naming the plate the car on screen carries. */
export const holderOnPlate = (holder: string, plate: string): string => holder.replace(LEADING_PLATE, plate);
