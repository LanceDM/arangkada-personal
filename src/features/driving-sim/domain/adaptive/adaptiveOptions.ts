// The five repairs made to the adaptive layer, each an option whose `legacy`
// value is the rule the game-level simulation ran under. Each is justified by
// the stated rule it restores, not by what it does to a result.
//
// The game plays `GAME_OPTIONS`. The offline simulation plays `LEGACY_OPTIONS`
// unless told otherwise, which is what keeps its published results
// reproducible. The shared learner-domain functions an
// option reaches default to their legacy rule for the same reason, so every
// caller in the game passes its option explicitly.
import type { WeakestTieBreak } from '@/domain/learner/profile';
import type { UntrainedRow } from '@/domain/learner/adaptive/qLearningPolicy';
import type { PracticeItemScoring } from '@/features/driving-sim/domain/scoring/scoreDecision';

/**
 * Which logs the mid-drive re-roll reads BKT over.
 *
 * - `run-local`: this run's logs only, where every
 *   competency not yet met this run sits at `pInit`.
 * - `full`: the learner's chronological history before the attempt, then this
 *   run's logs - the belief the level entry itself was decided on.
 */
export type RerollHistory = 'run-local' | 'full';

export interface AdaptiveOptions {
  /** Whether an appended practice item counts toward the pass mark (`scoreDecision`). */
  practiceItemScoring: PracticeItemScoring;
  /**
   * Whether the final exam's roll leans toward the weak area. The final exam is
   * the same test for every learner, so `false` rolls it from no
   * history at all.
   */
  finalExamRollBias: boolean;
  /** How BKT's weakest competency is chosen among tied scores (`getLowestScoringCompetency`). */
  weakestTieBreak: WeakestTieBreak;
  /** What a trainer writes for a state it left untrained (`tableEntry`). */
  untrainedRow: UntrainedRow;
  rerollHistory: RerollHistory;
}

/** The adaptive layer as the game-level simulation measured it. */
export const LEGACY_OPTIONS: AdaptiveOptions = {
  practiceItemScoring: 'upside-only',
  finalExamRollBias: true,
  weakestTieBreak: 'list-order',
  untrainedRow: 'first-action',
  rerollHistory: 'run-local',
};

/**
 * What the game plays on this branch.
 *
 * `untrainedRow` reaches the game only through a table trained under it. The
 * committed table was trained before the option existed and is
 * read as published, so its untrained rows still hold the first action.
 */
export const GAME_OPTIONS: AdaptiveOptions = {
  practiceItemScoring: 'neutral',
  finalExamRollBias: false,
  weakestTieBreak: 'least-observed',
  untrainedRow: 'documented-default',
  rerollHistory: 'full',
};
