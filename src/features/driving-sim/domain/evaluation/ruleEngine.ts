import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { DrivingCompetency, ViolationSeverity } from '@/domain/learner/competency';

/** One scored driving rule: what it expects, what it is worth, and why. */
export interface WeightedRule {
  id: string;
  competency: DrivingCompetency;
  severity: ViolationSeverity;
  baseWeight: number;
  expectedAction: ScenarioEvent['correctAction'];
  feedback: string;
  lawCitation?: string;
}

/**
 * A rule applied to one decision. `trace` is what reaches the ActionLog, so the
 * learner model can attribute a mastery change to a specific rule.
 */
export interface RuleEvaluation {
  rule: WeightedRule;
  isCorrect: boolean;
  points: number;
  weightedPenalty: number;
  message: string;
  trace: {
    ruleId: string;
    competency: DrivingCompetency;
    severity: ViolationSeverity;
    expectedAction: string;
    actualAction: string;
    weight: number;
    streakMultiplier: number;
    lawCitation?: string;
  };
}

const severityWeights: Record<ViolationSeverity, number> = {
  minor: 1,
  major: 1.5,
  critical: 2,
};

const competencyByTrigger: Partial<Record<ScenarioEvent['type'], DrivingCompetency>> = {
  red_light: 'traffic_signals',
  green_light: 'traffic_signals',
  yellow_light: 'traffic_signals',
  stop_sign: 'right_of_way',
  speed_limit: 'speed_control',
  pedestrian_crossing: 'pedestrians',
  obstacle_ahead: 'hazard_awareness',
  road_marking: 'lane_discipline',
  overtaking_zone: 'lane_discipline',
  emergency_vehicle: 'right_of_way',
  scenario_trigger: 'general_rules',
};

const severityByTrigger: Partial<Record<ScenarioEvent['type'], ViolationSeverity>> = {
  red_light: 'critical',
  stop_sign: 'major',
  pedestrian_crossing: 'critical',
  speed_limit: 'major',
  obstacle_ahead: 'major',
  yellow_light: 'minor',
  road_marking: 'major',
  overtaking_zone: 'major',
  emergency_vehicle: 'critical',
};

const buildRule = (event: ScenarioEvent): WeightedRule => {
  const competency = event.competency ?? competencyByTrigger[event.type] ?? 'general_rules';
  const severity = event.severity ?? severityByTrigger[event.type] ?? 'minor';

  return {
    id: `R-${event.type.toUpperCase().replace(/_/g, '-')}-${event.correctAction.toUpperCase()}`,
    competency,
    severity,
    baseWeight: severityWeights[severity],
    expectedAction: event.correctAction,
    feedback: event.penaltyMessage,
    lawCitation: event.lawCitation,
  };
};

/**
 * Whether what the driver did satisfies what the rule asked for.
 *
 * Usually an exact match, with one deliberate equivalence: a request to *slow
 * down* ('brake') is satisfied by any of braking, coasting to a slow speed
 * ('slow'), or coming to a full stop ('stop'). The telemetry grader names the
 * action for what the driver actually did — a coast is now reported as 'slow',
 * not 'brake' — but all three are legitimate ways to obey "slow for this", so
 * the honesty of the label must not turn a coast into a wrong answer. A request
 * to *stop* ('stop') is not satisfied by merely slowing, so that stays exact.
 */
const actionSatisfies = (action: string, expected: string): boolean => {
  if (action === expected) return true;
  if (expected === 'brake') return action === 'slow' || action === 'stop';
  return false;
};

export const evaluateWeightedRule = (
  event: ScenarioEvent,
  playerAction: string,
  violationStreak: number
): RuleEvaluation => {
  const rule = buildRule(event);
  const isCorrect = actionSatisfies(playerAction, rule.expectedAction);
  const streakMultiplier = Math.min(1 + violationStreak * 0.25, 2);

  if (isCorrect) {
    const recoveryBonus = violationStreak > 0 ? 5 : 0;
    const points = event.points + recoveryBonus;

    return {
      rule,
      isCorrect,
      points,
      weightedPenalty: 0,
      message: event.rewardMessage,
      trace: {
        ruleId: rule.id,
        competency: rule.competency,
        severity: rule.severity,
        expectedAction: rule.expectedAction,
        actualAction: playerAction,
        weight: rule.baseWeight,
        streakMultiplier,
        lawCitation: rule.lawCitation,
      },
    };
  }

  const weightedPenalty = Math.ceil(event.points * 0.5 * rule.baseWeight * streakMultiplier);
  const points = -weightedPenalty;

  return {
    rule,
    isCorrect,
    points,
    weightedPenalty,
    message: `${rule.feedback}${violationStreak > 1 ? ` (${violationStreak}x streak!)` : ''}`,
    trace: {
      ruleId: rule.id,
      competency: rule.competency,
      severity: rule.severity,
      expectedAction: rule.expectedAction,
      actualAction: playerAction,
      weight: rule.baseWeight,
      streakMultiplier,
      lawCitation: rule.lawCitation,
    },
  };
};
