/**
 * Where a junction's parts land, given only the row the junction is anchored
 * at. Pure geometry: the drawing pass paints against these numbers, the world
 * places solid things against them, and the turn manoeuvre steers onto them.
 */
import { LANE_COUNT, ROAD_WIDTH } from './vehiclePhysics';

/**
 * Three quarters rather than parity: the view compresses distance along the
 * route far harder than across it, so a cross street drawn at its true relative
 * width would tower over the junction and crowd the events either side of it.
 */
export const CROSS_ROAD_WIDTH = ROAD_WIDTH * 0.75;

/** One lane of the cross street, which is laid out like the main road. */
export const CROSS_LANE = CROSS_ROAD_WIDTH / LANE_COUNT;

/** Curb depth either side of a cross street, matching the main road's sidewalks. */
export const CURB_DEPTH = 25;

/** Clear road between the junction box and the line you stop at. */
export const STOP_LINE_SETBACK = 26;

/** Height of the marked crossing at a driveway mouth. */
export const DRIVEWAY_CROSSING_HEIGHT = 46;

/** Where a junction's box and stop line sit, for a junction anchored at `screenY`. */
export interface IntersectionGeometry {
  boxTop: number;
  boxBottom: number;
  stopLineY: number;
}

export const intersectionGeometry = (screenY: number): IntersectionGeometry => {
  const stopLineY = screenY + 8;
  const boxBottom = stopLineY - STOP_LINE_SETBACK;
  return { stopLineY, boxBottom, boxTop: boxBottom - CROSS_ROAD_WIDTH };
};

/**
 * Screen row of the cross street's centre. The one row across the whole canvas
 * that is actually road surface — anywhere lower is the curb and the verge.
 */
export const junctionCentreY = (screenY: number): number =>
  intersectionGeometry(screenY).boxBottom - CROSS_ROAD_WIDTH / 2;

/**
 * The row a turn actually comes out on, which is not the middle of the cross
 * street: `junctionCentreY` is the divide between its two directions of travel,
 * and landing astride that line puts the car in oncoming traffic.
 *
 * Right turns take the nearest lane — the curb lane of the near half, which is
 * what "keep the rear right wheel nearest the curb" leaves you in. Left turns
 * take the lane nearest the centre line of the road being joined, the rule
 * RA 4136 states outright and the one Level 6 grades.
 */
export const junctionExitY = (screenY: number, direction: 'left' | 'right'): number => {
  const centre = junctionCentreY(screenY);
  return direction === 'right' ? centre + CROSS_LANE * 1.5 : centre - CROSS_LANE * 0.5;
};
