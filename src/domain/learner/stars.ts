/**
 * Stars, one rule for every level (0-12), decided 2026-11-12: by the number
 * of mistakes, never by a share of the level's points.
 *
 * - 3 stars: passed with no mistakes;
 * - 2 stars: passed with 1 or 2 mistakes;
 * - 1 star: passed with more;
 * - 0: not passed (a crash or a timeout is never passed).
 *
 * Point thresholds meant different things on different levels: a wrong answer
 * costs its points plus a penalty (`ruleEngine`), so one miss was a different
 * share of each level's maximum, and Level 1 gave 3 stars where Level 2 gave 1
 * for the same single miss. A count of mistakes means the same everywhere.
 *
 * Display only: nothing in BKT, the Q-learning, the routing FSM or the export
 * reads stars.
 */
import type { ActionLog } from './attempt';

/** Mistakes that still earn 2 stars. */
export const TWO_STAR_MISTAKES = 2;

/**
 * A mistake is a decision scored wrong, an unanswered question included
 * (scored wrong). Not one:
 * - a standing penalty (crawling, the wrong side, over the limit): charged
 *   again and again for one lapse, up to 4 times (`standingPenalties`), and
 *   never evidence. It still costs points;
 * - a practice item, which scores nothing either way (`scoreDecision`'s
 *   `neutral` rule).
 */
export const isMistake = (log: Pick<ActionLog, 'result' | 'standing' | 'remediation'>): boolean =>
  log.result === 'violation' && !log.standing && !log.remediation;

export const mistakesIn = (logs: readonly Pick<ActionLog, 'result' | 'standing' | 'remediation'>[]): number =>
  logs.filter(isMistake).length;

export const starsForMistakes = (passed: boolean, mistakes: number): number =>
  !passed ? 0 : mistakes === 0 ? 3 : mistakes <= TWO_STAR_MISTAKES ? 2 : 1;
