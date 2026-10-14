/**
 * The learner vocabulary every feature shares: what a driver can be good or bad
 * at, how badly a mistake counts, and how much help a scenario is shown with.
 *
 * Deliberately free of any feature import - Driving Sim's rule engine is what
 * maps a scenario onto one of these, not the other way round.
 */
export type DrivingCompetency =
  | 'driver_legality'
  | 'document_awareness'
  | 'traffic_signals'
  | 'road_signs'
  | 'right_of_way'
  | 'pedestrians'
  | 'speed_control'
  | 'lane_discipline'
  | 'hazard_awareness'
  // Where you may leave the vehicle, and how you get it into the space. Named
  // separately from lane discipline because the curriculum tracks "parking
  // compliance" as its own sub-competency, and because a driver can be faultless
  // in moving traffic and still park across a red curb.
  | 'parking'
  | 'general_rules';

export type ViolationSeverity = 'minor' | 'major' | 'critical';

/**
 * The support level h: how much of the answer a scenario is presented with.
 *
 * `full` shows the situation and the move to make, `cue` the situation and
 * where to look, `none` the situation alone. It changes what is shown, never
 * what is graded, and it is chosen once per level entry alongside theta, by the
 * Q-learning policy in `adaptive/qLearningPolicy.ts`.
 */
export type SupportLevel = 'full' | 'cue' | 'none';

/** The learner's current weakest competency, as BKT estimates it. */
export interface WeakArea {
  competency: DrivingCompetency;
  score: number;
}

export interface CompetencyStats {
  attempts: number;
  correct: number;
  violations: number;
  weightedPenalty: number;
  score: number;
}

export type LearnerProfile = Record<DrivingCompetency, CompetencyStats>;
