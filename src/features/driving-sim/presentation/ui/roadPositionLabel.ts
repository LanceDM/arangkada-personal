/**
 * What to call where the car is, and what it is being asked to do about it.
 *
 * One place, read by the HUD and by the scenario guidance, so the two cannot
 * disagree — and derived from `RoadPosition`, which comes from the route,
 * rather than from an event id, a description or the lane arithmetic.
 *
 * The bug this exists to close: `laneOf` clamps a car outside the carriageway
 * to the outermost through lane, so a driver still on the acceleration lane was
 * labelled "LANE 4". That is the lane they are about to merge *into*. Telling
 * them they were already in it is telling them the manoeuvre was done.
 */
import type { RoadPosition } from '@/features/driving-sim/domain/world/routeGeometry';
import type { TextOf } from '@/shared/i18n/useText';

/** How urgent the cue is, and what colour goes with it. Never colour alone. */
export type CueTone = 'wait' | 'go' | 'done' | 'neutral';

export interface RoadPositionCue {
  /** Where the car is, in the road's own words. */
  place: string;
  /** What to do about it, or null when there is nothing to say. */
  action: string | null;
  /** The one live figure this position turns on, or null. */
  note: string | null;
  tone: CueTone;
}

/** What a merge scenario is asking for, where one is being asked for. */
export interface MergeAsk {
  /** The through lane being joined, counted from the median. */
  intoLane: number;
  /** The floor the carriageway carries, in km/h. */
  minSpeed: number;
  /** What the car is doing now, in km/h. */
  speed: number;
}

const laneName = (lane: number | null, say: TextOf) =>
  say(lane === null ? { en: 'CARRIAGEWAY' } : { en: `LANE ${lane + 1}` });

/**
 * The cue for a car on an auxiliary lane or in the carriageway.
 *
 * `mergeLane` is the lane the driver is joining, where a scenario is asking for
 * one — it is the scenario's own `intoLane`, resolved to an index, so the words
 * on screen name the lane the grader is measuring.
 */
export const roadPositionCue = (
  position: RoadPosition,
  merge: MergeAsk | null,
  say: TextOf
): RoadPositionCue => {
  // The one figure a merge turns on. Always the number, never a bare
  // instruction: "BUILD SPEED" to a driver already doing ninety-nine is the
  // screen telling them to fix something that is not wrong.
  const speedNote = merge
    ? merge.speed < merge.minSpeed
      ? say({ en: `UNDER ${merge.minSpeed} km/h` })
      : say({ en: `${merge.minSpeed} km/h MIN MET` })
    : null;

  if (position.place === 'acceleration-lane') {
    return position.crossingOpen
      ? {
          place: say({ en: 'ACCELERATION LANE' }),
          action: say(merge ? { en: `MERGE INTO ${laneName(merge.intoLane, say)}` } : { en: 'MERGE NOW' }),
          note: speedNote,
          tone: 'go',
        }
      : {
          place: say({ en: 'ACCELERATION LANE' }),
          action: say({ en: 'WAIT — LANE DIVIDED' }),
          note: speedNote,
          tone: 'wait',
        };
  }

  if (position.place === 'deceleration-lane') {
    return { place: say({ en: 'DECELERATION LANE' }), action: null, note: null, tone: 'neutral' };
  }

  if (position.place === 'ramp') {
    return { place: say({ en: 'EXIT RAMP' }), action: null, note: null, tone: 'done' };
  }

  if (position.place === 'toll-approach') {
    return { place: say({ en: 'TOLL APPROACH' }), action: null, note: null, tone: 'neutral' };
  }

  // In the carriageway. When a merge was being asked for and the car is now in
  // the lane it was joining, the manoeuvre is over and says so.
  if (merge && position.lane === merge.intoLane) {
    return { place: laneName(position.lane, say), action: say({ en: 'MERGED' }), note: null, tone: 'done' };
  }
  return { place: laneName(position.lane, say), action: null, note: null, tone: 'neutral' };
};
