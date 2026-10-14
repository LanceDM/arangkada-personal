// Event evaluation logic - no React, no canvas
import { ScenarioEvent, type GarageHotspot } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { ActionLog } from '@/domain/learner/attempt';
import type { SupportLevel } from '@/domain/learner/competency';
import { evaluateWeightedRule } from './ruleEngine';
import { NO_REACTION, type ReactionObservation } from './reactionTiming';

/**
 * Garage hotspots are scored through the same pipeline as road events, so they
 * are adapted into the shape the evaluator already understands.
 */
export const garageHotspotToEvent = (hotspot: GarageHotspot): ScenarioEvent => ({
  id: hotspot.id,
  triggerAtDistance: 0,
  type: 'scenario_trigger',
  description: hotspot.label,
  correctAction: hotspot.correctAction,
  points: hotspot.points,
  penaltyMessage: hotspot.penaltyMessage,
  rewardMessage: hotspot.rewardMessage,
  duration: 0,
  question: hotspot.question,
  choices: hotspot.choices,
  lawCitation: hotspot.lawCitation,
  competency: hotspot.competency,
  severity: hotspot.severity,
});

// Map correctAction to human-readable hint
export const actionHints: Record<string, string> = {
  brake: 'BRAKE (↓/S)',
  slow: 'EASE OFF (↓/S)',
  stop: 'FULL STOP (↓/S)',
  accelerate: 'GO (↑/W)',
  turn_left: 'STEER LEFT (←/A)',
  turn_right: 'STEER RIGHT (→/D)',
  turnLeft: 'STEER LEFT (←/A)',
  turnRight: 'STEER RIGHT (→/D)',
  honk: 'HORN (H)',
};

/** What the tutorial's instructor prompt says for each control it teaches. */
export const tutorialCopy: Record<string, { label: string; keys: string[]; helper: string }> = {
  accelerate: {
    label: 'Drive forward',
    keys: ['↑', 'W'],
    helper: 'Tap to raise your speed setting. The car holds it — no need to keep pressing.',
  },
  turn_left: {
    label: 'Steer left',
    keys: ['←', 'A'],
    helper: 'Move the car into the left lane before the marker passes.',
  },
  turn_right: {
    label: 'Steer right',
    keys: ['→', 'D'],
    helper: 'Move the car into the right lane before the marker passes.',
  },
  brake: {
    label: 'Slow down',
    keys: ['↓', 'S', 'Space'],
    helper: 'Tap down to lower your setting, or hold to brake, until the speed is 10 km/h or lower.',
  },
  stop: {
    label: 'Full stop',
    keys: ['↓', 'S', 'Space'],
    helper: 'Hold the brake until the speedometer reaches 0.',
  },
};

export interface EvaluationResult {
  isCorrect: boolean;
  points: number;
  message: string;
  log: ActionLog;
  lawCitation?: string;
}

/**
 * What the adaptive layer chose, carried through into the log entry so a
 * mastery change can be attributed to a specific intervention afterwards.
 *
 * Spread conditionally so a level's own authored content produces exactly the
 * log entry it always has - no extra keys, and in particular no `undefined`
 * values, which Firestore refuses to store.
 */
const remediationProvenance = (event: ScenarioEvent): Partial<ActionLog> =>
  event.remediation
    ? {
        remediation: true,
        ...(event.remediationSourceLevelId !== undefined
          ? { sourceLevelId: event.remediationSourceLevelId }
          : {}),
      }
    : {};

// Evaluate whether the player performed the correct action for an event
export const evaluatePlayerAction = (
  event: ScenarioEvent,
  playerAction: string,
  violationStreak: number,
  /**
   * What this decision says about response speed (`observeReaction`). Only a
   * response is timed; most decisions say nothing, which is the default.
   */
  reaction: ReactionObservation = NO_REACTION,
  /**
   * The support level the scenario was presented at, recorded with the
   * decision. Given only for a decision answered with the car; the verdict
   * never reads it.
   */
  support?: SupportLevel
): EvaluationResult => {
  const timestamp = Date.now();
  const result = evaluateWeightedRule(event, playerAction, violationStreak);

  return {
    isCorrect: result.isCorrect,
    points: result.points,
    message: result.message,
    lawCitation: result.trace.lawCitation,
    log: {
      timestamp,
      action: playerAction,
      result: result.isCorrect ? 'correct' : 'violation',
      points: result.points,
      ruleId: result.trace.ruleId,
      competency: result.trace.competency,
      severity: result.trace.severity,
      weight: result.trace.weight,
      expectedAction: result.trace.expectedAction,
      // Absent rather than undefined when there is nothing to record -
      // Firestore rejects undefined.
      ...(reaction.kind === 'timed' ? { reactionTime: reaction.ms } : {}),
      ...(reaction.kind === 'censored' ? { reactionCensored: true as const } : {}),
      ...remediationProvenance(event),
      ...(support ? { support } : {}),
    },
  };
};
