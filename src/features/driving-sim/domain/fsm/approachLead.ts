import type { TransitionContext, TransitionParams } from './fsmTypes';

/**
 * How far ahead of an event the approach guard lets the machine leave DRIVING:
 * the event's baseline lead scaled by theta, held inside the two limits the
 * world reports.
 *
 *     lead(theta) = clamp(w * theta, min(w, approachFloor), max(w, approachRoom))
 *
 * Both limits are taken relative to the baseline `w` rather than applied as
 * they stand, and that is what the properties below rest on:
 *
 * - At theta = 1 the lead is `w` whatever the limits are, so
 *   M(DEFAULT_TRANSITION_PARAMS) is still exactly the baseline machine.
 * - It never decreases as theta grows, so theta still only moves *when* the
 *   edge fires.
 * - Widening stops at the room back to the previous event, so a wide setting
 *   cannot open an approach inside the event before it or on the start line -
 *   unless the baseline itself already did, which theta does not change.
 * - Narrowing stops at the floor: a narrow setting cannot leave the driver
 *   less road than the car needs to come to rest - unless the baseline itself
 *   already did - and cannot narrow at all an approach the world reports an
 *   infinite floor for.
 *
 * The world measures the two limits; theta, and the decision, stay here. Shared
 * by the guard and by the on-screen approach cue, so the two cannot disagree.
 */
export const approachLead = (
  context: Pick<TransitionContext, 'warningDistance' | 'approachRoom' | 'approachFloor'>,
  params: Pick<TransitionParams, 'approachScale'>
): number => {
  const baseline = context.warningDistance;
  const least = Math.min(baseline, context.approachFloor);
  const most = Math.max(baseline, context.approachRoom);
  return Math.min(most, Math.max(least, baseline * params.approachScale));
};

/**
 * What theta did to one event's approach: the theta asked for, and the one the
 * event actually got once the road's limits held it.
 *
 * The two differ wherever a limit binds - a widened approach stopped at the
 * room back to the previous event, a narrowed one at a stop's worth or not
 * narrowed at all - so an analysis that took the requested value as the one
 * in force would attribute to theta a lead that never happened.
 */
export interface ApproachTrace {
  /** The approachScale in force: the theta the level entry asked for. */
  requested: number;
  /** The lead the guard fired at, over the baseline: the theta this event got. */
  effective: number;
  /** The event's baseline lead `w`, where its graded zone starts. */
  baselineLead: number;
  /** The lead the guard fired at, in road units. */
  lead: number;
  /** The ceiling a widened approach was held under. `Infinity` where nothing limits it. */
  room: number;
  /** The floor a narrowed approach was held above. `Infinity` where it is never narrowed. */
  floor: number;
}

export const approachTrace = (
  context: Pick<TransitionContext, 'warningDistance' | 'approachRoom' | 'approachFloor'>,
  params: Pick<TransitionParams, 'approachScale'>
): ApproachTrace => {
  const lead = approachLead(context, params);
  return {
    requested: params.approachScale,
    effective: lead / context.warningDistance,
    baselineLead: context.warningDistance,
    lead,
    room: context.approachRoom,
    floor: context.approachFloor,
  };
};
