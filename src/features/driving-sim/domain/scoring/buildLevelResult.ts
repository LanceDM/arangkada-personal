// Assembling one drive's LevelResult - the single place stars, completion and
// the BKT competency projection are computed, so the three points a run can end
// cannot drift apart: the route finishing, a collision, and the post-crash
// aftermath stage that re-totals after the on-foot scene.
//
// Pure: no React, no canvas, no FSM. The caller owns *when* a run ends and what
// the running totals are at that moment (including the crash's own +1
// violation); this owns only how those totals become a LevelResult. FSM
// telemetry travels beside the result rather than on it, so the raw transition
// log never enters React state or the progress store.
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ActionLog, LevelResult, SignOutcome } from '@/domain/learner/attempt';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { getCompetencyScores, getWeakestCompetency } from '@/domain/learner/profile';

/** The star band a score falls in for this level. One definition, every caller. */
export const starsFor = (level: LevelConfig, score: number): number =>
  score >= level.stars3 ? 3
  : score >= level.stars2 ? 2
  : score >= level.requiredScore ? 1
  : 0;

/** The running totals a drive holds while it plays, snapshotted the moment it ends. */
export interface RunTotals {
  score: number;
  violations: number;
  correctActions: number;
  logs: ActionLog[];
  signOutcomes?: SignOutcome[];
}

/**
 * How a run ended early, if it did: in a collision, with its reason, or by
 * running out of driving time. A run driven to its end has none.
 */
export type RunEnding = { kind: 'crash'; reason: string } | { kind: 'time_up' };

/**
 * Build the finished result for a drive.
 *
 * A crash or a timeout forces `stars: 0` and `completed: false` whatever the
 * score, and carries what ended it; a run driven to its end grades by the
 * level's own star thresholds. The competency projection is replayed from the
 * run's logs the same way in every case. The `violations` passed in is
 * authoritative - the crash caller adds its own +1 before calling, so that
 * count stays visible at the call site rather than hidden in here. A timeout
 * adds none: running out of time is not a driving violation, and it is not
 * evidence about any competency either.
 */
export const buildLevelResult = (
  level: LevelConfig,
  totals: RunTotals,
  ending?: RunEnding
): LevelResult => {
  const profile = buildBKTLearnerProfile(totals.logs);
  const endedEarly = ending !== undefined;
  return {
    levelId: level.id,
    score: totals.score,
    stars: endedEarly ? 0 : starsFor(level, totals.score),
    completed: endedEarly ? false : totals.score >= level.requiredScore,
    violations: totals.violations,
    correctActions: totals.correctActions,
    logs: totals.logs,
    ...(totals.signOutcomes !== undefined ? { signOutcomes: totals.signOutcomes } : {}),
    competencyScores: getCompetencyScores(profile),
    weakestCompetency: getWeakestCompetency(profile),
    ...(ending?.kind === 'crash' ? { crashReason: ending.reason } : {}),
    ...(ending?.kind === 'time_up' ? { timedOut: true as const } : {}),
  };
};
