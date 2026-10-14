// What one graded decision does to a drive's running score and to its
// consecutive-violation streak. One definition, read by the game's evaluation
// hook and by the offline simulation, so the
// two cannot disagree about what passes a level.
//
// Pure: no React, no refs. The caller keeps the running values between
// decisions and evaluates each one against the streak they hold.
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

/**
 * How an appended practice item (`ScenarioEvent.remediation`) counts toward the
 * level's pass mark.
 *
 * - `upside-only`: a correct answer adds its points and a miss adds nothing.
 *   That lowers the pass mark for the learners who get an item, who then pass
 *   on fewer authored points, sooner, and practise less. The game-level
 *   simulation ran under it, and it is kept so that study reproduces.
 * - `neutral`: the item is graded and logged, and never counts toward the pass
 *   mark: no points either way, and the streak is left as it stood, because
 *   the streak moves the points of whatever is graded next - Level 9's
 *   aftermath stage comes after the item. Pass or fail is then the same with
 *   the item as without it.
 */
export type PracticeItemScoring = 'upside-only' | 'neutral';

/** What a drive carries from one graded decision to the next. */
export interface RunningScore {
  /** The total so far. Never negative. */
  score: number;
  /** Consecutive wrong decisions, which scale the next penalty and earn a recovery bonus. */
  streak: number;
}

export const START_SCORE: RunningScore = { score: 0, streak: 0 };

/**
 * The running score after one decision, and the points it added.
 *
 * `points` is what the rule engine awarded, read against `before.streak`. A
 * standing penalty (crawling, the wrong side of the road) is a continuous
 * infraction rather than a decision, so a miss there does not advance the
 * streak - though, like any correct answer, a correct one would reset it.
 */
export const scoreDecision = (
  before: RunningScore,
  event: Pick<ScenarioEvent, 'remediation'>,
  verdict: { isCorrect: boolean; points: number },
  scoring: PracticeItemScoring,
  standing = false
): RunningScore & { delta: number } => {
  if (event.remediation && scoring === 'neutral') return { ...before, delta: 0 };
  const delta = event.remediation && !verdict.isCorrect ? 0 : verdict.points;
  return {
    score: Math.max(0, before.score + delta),
    streak: verdict.isCorrect ? 0 : standing ? before.streak : before.streak + 1,
    delta,
  };
};
