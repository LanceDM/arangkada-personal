/**
 * What a level's road is under RA 4136 §35, and the limit that class takes
 *.
 *
 * A level names its class and states its limit; `speedLimits.test.ts` holds
 * the two to each other, so a limit can only change with the class it is
 * justified by. Every figure is §35(b)'s for a passenger car (the player
 * always drives one), except the two the pack labels: the expressway's, which
 * §35 does not set, and the practice course's, which §35 does not bind.
 */

export type RoadClass =
  /** Level 0: not a "highway" (§3(j)). Labelled: given the city-street figure. */
  | 'practice_course'
  /** §35(b) row 3: "city and municipal streets, with light traffic". */
  | 'city_street'
  /** §35(b) row 2: "through streets" or boulevards, "when so designated". */
  | 'through_street'
  /** §35(b) row 1: "open country roads". No level is one today. */
  | 'open_country'
  /** Not a §35 road: FDM Vol. 1's expressway rules, 100 maximum and 60 minimum. */
  | 'expressway';

export const LEGAL_LIMIT: Record<RoadClass, number> = {
  practice_course: 30,
  city_street: 30,
  through_street: 40,
  open_country: 80,
  expressway: 100,
};

/**
 * §35(b) row 4: "through crowded streets, approaching intersections at blind
 * corners, passing school zones, passing other vehicles which are stationery,
 * or for similar dangerous circumstances". What "slow down" means on a §35 road.
 */
export const DANGER_SPEED = 20;

/** Whether §35's table is the road's law. The expressway's is its own. */
export const isSection35Road = (roadClass: RoadClass): boolean => roadClass !== 'expressway';
