import type { ActionLog } from './attempt';
import type { DrivingCompetency, LearnerProfile } from './competency';

export const COMPETENCIES: DrivingCompetency[] = [
  'driver_legality',
  'document_awareness',
  'traffic_signals',
  'road_signs',
  'right_of_way',
  'pedestrians',
  'speed_control',
  'lane_discipline',
  'hazard_awareness',
  'parking',
  'general_rules',
];

export const createLearnerProfile = (): LearnerProfile =>
  COMPETENCIES.reduce((profile, competency) => {
    profile[competency] = {
      attempts: 0,
      correct: 0,
      violations: 0,
      weightedPenalty: 0,
      score: 100,
    };
    return profile;
  }, {} as LearnerProfile);

export const buildLearnerProfile = (logs: ActionLog[]): LearnerProfile => {
  const profile = createLearnerProfile();

  for (const log of logs) {
    const competency = log.competency as DrivingCompetency | undefined;
    if (!competency || !profile[competency]) continue;

    const stats = profile[competency];
    stats.attempts += 1;

    if (log.result === 'correct') {
      stats.correct += 1;
    }

    if (log.result === 'violation') {
      stats.violations += 1;
      stats.weightedPenalty += Math.abs(log.points) * (log.weight ?? 1);
    }

    const accuracy = stats.attempts > 0 ? stats.correct / stats.attempts : 1;
    const penaltyPressure = Math.min(stats.weightedPenalty / 100, 0.5);
    stats.score = Math.max(0, Math.round((accuracy - penaltyPressure) * 100));
  }

  return profile;
};

export const getCompetencyScores = (profile: LearnerProfile): Record<string, number> =>
  Object.fromEntries(COMPETENCIES.map(competency => [competency, profile[competency].score]));

export const getWeakestCompetency = (profile: LearnerProfile): DrivingCompetency | null => {
  const attempted = COMPETENCIES.filter(competency => profile[competency].attempts > 0);
  if (attempted.length === 0) return null;

  return attempted.sort((a, b) => profile[a].score - profile[b].score)[0];
};

/**
 * How a tie for the lowest score is broken.
 *
 * - `list-order`: the first of the tied in `COMPETENCIES`. The rule the earlier
 *   simulation studies ran under, kept so they reproduce as published.
 * - `least-observed`: the tied competency with the fewest observations, and
 *   only then list order. A tie carries no information about list order, and
 *   list order is why the run-local re-roll kept landing on `driver_legality`,
 *   the first entry.
 */
export type WeakestTieBreak = 'list-order' | 'least-observed';

/**
 * The single lowest-scoring competency, considering every competency rather
 * than only ones this history happened to attempt. `getWeakestCompetency`'s
 * `attempts > 0` filter is correct for a per-run "what did this drive go
 * worst on" summary (an untouched competency isn't part of that run), but
 * wrong for cross-run remediation targeting under a BKT-style estimator,
 * where an untouched competency's default score is "not yet demonstrated" -
 * the most urgent thing to work on, not something to skip. Filtering it out
 * let a remediation policy get permanently stuck cycling only the
 * competencies of whatever level it happened to attempt first, since the
 * other nine could never be found "weakest" no matter how low their score.
 *
 * Omitting `tieBreak` means `list-order`, so every simulation environment that
 * calls this without one plays exactly as it was published; the game passes
 * its own rule.
 */
export const getLowestScoringCompetency = (
  profile: LearnerProfile,
  tieBreak: WeakestTieBreak = 'list-order'
): DrivingCompetency =>
  [...COMPETENCIES].sort(
    (a, b) =>
      profile[a].score - profile[b].score ||
      (tieBreak === 'least-observed' ? profile[a].attempts - profile[b].attempts : 0)
  )[0];

const COMPETENCY_LABELS: Record<DrivingCompetency, string> = {
  driver_legality: 'Driver Legality',
  document_awareness: 'Document Awareness',
  traffic_signals: 'Traffic Signals',
  road_signs: 'Road Signs',
  right_of_way: 'Right of Way',
  pedestrians: 'Pedestrian Safety',
  speed_control: 'Speed Control',
  lane_discipline: 'Lane Discipline',
  hazard_awareness: 'Hazard Awareness',
  parking: 'Parking Compliance',
  general_rules: 'General Rules',
};

export const getCompetencyLabel = (competency: string | null | undefined): string =>
  competency ? COMPETENCY_LABELS[competency as DrivingCompetency] ?? competency.replace(/_/g, ' ') : 'Road decision';
