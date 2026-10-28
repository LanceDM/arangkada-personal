/**
 * What a graded decision says about how quickly the driver responds.
 *
 * A reaction time is only a reaction time when the driver's own act settled
 * the decision. Before this was decided per decision, every verdict was timed:
 * a scenario the window closed on recorded the time it took to drive through
 * the window, a checkpoint recorded the time spent reading its question, and a
 * stop sign the car had come to rest before recorded almost nothing at all.
 * The practice policy's latency bucket reads these numbers.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { settlesWhenMet } from './eventTelemetry';

/** How a graded decision was settled, as the world saw it. */
export type DecisionSettlement =
  /** The driver's own act settled it: a requirement met, a turn committed, a merge made. */
  | 'response'
  /** The window closed on it: nothing the driver did settled it sooner. */
  | 'expired'
  /** A requirement was lost part-way through - a drift past the line - with nothing left to watch. */
  | 'lapse'
  /** Answered at a prompt the drive froze for: a checkpoint, a cutscene, a parking decision. */
  | 'question'
  /**
   * The same prompt, not answered within its time limit (TENTATIVE 30 s):
   * graded as not passed, logged with `questionTimedOut`, and never read by BKT.
   */
  | 'question_timeout'
  /** A tutorial step, completed or not while its instruction was on screen. */
  | 'guided';

/**
 * Whether the decision was answered with the car - a response, a window that
 * closed, or a lapse. These are the decisions whose scenario was presented at
 * a support level: a question has a screen of its own, and a
 * tutorial step its instructor panel, and h governs neither.
 */
export const answeredWithTheCar = (settlement: DecisionSettlement | undefined): boolean =>
  settlement === 'response' || settlement === 'expired' || settlement === 'lapse';

/**
 * Whether a scenario is answered by an act made at a moment: a stop or a
 * slowing that settles it, a turn or ramp committed, a merge made.
 *
 * Only these have a reaction time, and only for these does a window closing
 * without the act say anything about how quickly the driver responds. A
 * prohibition, a gap held, a speed read at a sign or a marking that asks
 * nothing is answered by the whole window; a question is answered by reading.
 */
export const asksForResponse = (event: ScenarioEvent): boolean =>
  !event.neutral &&
  !event.inspection &&
  !event.cutscene &&
  !event.parkingCutscene &&
  (Boolean(event.maneuver) ||
    Boolean(event.merge) ||
    (settlesWhenMet(event) && (event.correctAction === 'stop' || event.correctAction === 'brake')));

/** One decision's evidence about response speed. */
export type ReactionObservation =
  /** The driver responded, this many milliseconds after the reaction clock started. */
  | { kind: 'timed'; ms: number }
  /**
   * The scenario asked for a response and its window closed without one: the
   * response took at least the whole window. No time is recorded, because none
   * was observed.
   */
  | { kind: 'censored' }
  /** Nothing about response speed can be read from this decision. */
  | { kind: 'none' };

export const NO_REACTION: ReactionObservation = { kind: 'none' };

/**
 * What one decision says about response speed.
 *
 * `settlement` is absent for anything that is not a road decision - a garage
 * answer, a standing penalty - and those say nothing about response speed.
 * `msOnClock` is the reaction clock at the moment of the verdict - from the
 * release of the read phase, or from the approach where there was none (see
 * `reactionClockMs`). It is used only for a response: a window that expired is
 * never a reaction time, and a question or a tutorial step is reading.
 */
export const observeReaction = (
  settlement: DecisionSettlement | undefined,
  event: ScenarioEvent,
  msOnClock: number | null
): ReactionObservation => {
  if (!settlement || !asksForResponse(event)) return NO_REACTION;
  if (settlement === 'response') return msOnClock === null ? NO_REACTION : { kind: 'timed', ms: msOnClock };
  if (settlement === 'expired') return { kind: 'censored' };
  return NO_REACTION;
};
