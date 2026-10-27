/**
 * What happened during one frame that something outside the world must act on.
 *
 * The world advances itself; it does not score, navigate, or start timers. When
 * a frame reaches a point where those are needed it says so here, and the
 * session's host handles it immediately after `update()` returns — which is why
 * the frame's own bookkeeping (the event is marked answered, the zone closes)
 * happens inside the world regardless of what the host then decides.
 */
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import type { DrivingCompetency } from '@/domain/learner/competency';

export type GameEvent =
  /**
   * A graded decision: the driver answered `event` by doing `action`.
   * `settlement` is how it came to be settled - which is what decides whether
   * its timing is a reaction time at all.
   */
  | { kind: 'decision'; event: ScenarioEvent; action: string; settlement: DecisionSettlement }
  /**
   * A continuous infraction charged this frame — crawling, or travelling on the
   * oncoming side. Scored and logged like a decision, but silently: each has its
   * own always-on banner, so it must not also raise a toast and a card.
   */
  | { kind: 'penalty'; event: ScenarioEvent; action: string }
  /** Rough ground threw the car about. */
  | { kind: 'jolt' }
  /** Upcoming content was re-rolled toward a competency the driver is weak on. */
  | { kind: 'rerolled'; competency: DrivingCompetency }
  /** The run ended in a collision. */
  | { kind: 'crashed'; reason: string }
  /** The route was driven to its end. */
  | { kind: 'finished' };
