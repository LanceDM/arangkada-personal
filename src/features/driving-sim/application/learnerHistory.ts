/**
 * Where the learner's cross-session history comes from, in one place.
 *
 * Every consumer of the adaptive layer is a pure function over `ActionLog[]`
 * and is only ever as right as the history it is handed. The two sources are
 * not equivalent - a signed-in player has every attempt ever saved, a guest has
 * only the best attempt per level in this browser - so both go through the same
 * port and the same flattening, and the dev inspector reads exactly what real
 * play reads.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import { TUTORIAL_LEVEL_ID } from '@/features/driving-sim/domain/systems/tutorial';

export { TUTORIAL_LEVEL_ID };
import type { LearnerHistory } from './ports';
import { drivingSimDeps } from './dependencies';

export type { LearnerAttempt, LearnerHistory, HistorySource } from './ports';

export const loadLearnerHistory = (uid: string | null): Promise<LearnerHistory> =>
  drivingSimDeps().learnerHistory.load(uid);

/**
 * The flat log stream the learner-model functions take, in chronological order.
 *
 * BKT and the practice selector's recent-performance bucket are sequential
 * replays: each folds over this array left to right. Neither source hands back
 * chronological attempts - Firestore orders newest-first, the guest store by
 * level id - so a naive flatMap would replay a signed-in player's most recent
 * evidence as their earliest. Sorting by each log's own `timestamp` fixes that
 * without caring which attempt a log came from. Route every consumer here.
 *
 * The tutorial (Level 0) is left out: its steps teach the controls, and the
 * rule engine's competency tags on them are not evidence of a driving
 * competency (catalogue review 2026-10-28). Quiz and diagnostic answers, which
 * are not level attempts, are passed in as `extra` and merged by timestamp.
 */
export const historyLogs = (history: LearnerHistory, extra: readonly ActionLog[] = []): ActionLog[] =>
  [...history.attempts.flatMap(attempt => attempt.logs), ...extra].sort((a, b) => a.timestamp - b.timestamp);

/**
 * What the redesigned BKT may read: `historyLogs` without the
 * tutorial's attempts, without standing penalties and without questions left
 * unanswered when their panel's time ran out, which say nothing about
 * what the player knows. The tutorial teaches the
 * controls, and its steps are tagged with a competency only by their scenario
 * type; a standing penalty is a charge for driving on clear road, not a
 * decision about a rule. Practice items stay: they are scenarios.
 *
 * Filtered per attempt because a log does not record its level. Penalties saved
 * before evidence was marked carry no `standing` mark and stay in. The
 * per-competency course orders its evidence itself (domain/study/evidence) and
 * filters the same way (isBKTEvidence).
 */
export const bktEvidence = (history: LearnerHistory): ActionLog[] =>
  historyLogs({ ...history, attempts: history.attempts.filter(attempt => attempt.levelId !== TUTORIAL_LEVEL_ID) })
    .filter(log => !log.standing && !log.unanswered);
