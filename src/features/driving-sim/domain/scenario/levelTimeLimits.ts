/**
 * How long each level may be driven before the run ends with "time's up"
 *.
 *
 * The limit is measured, not chosen: twice the longest correct drive of the
 * level, rounded up to the next half minute. "Correct" is the reference
 * driver's (`application/session/referenceDrive`): every scenario answered as
 * the full prompt says, at the slowest speed its grade accepts, and the
 * slowest speed the crawl penalty never charges everywhere else. So no drive
 * the game does not already penalise can time out by driving; only by standing
 * still about as long as the whole slow drive takes.
 *
 * Counted in world steps that drove the car (`DrivingWorld.drivenSteps`), at
 * 60 a second: a step held for a panel, a correction or a scripted manoeuvre
 * spends nothing, so reading never costs time and a slow device none either.
 *
 * The table is written by a developers' script and never by hand.
 * Each row keeps the fingerprint of the content it was measured on, and
 * `levelTimeLimits.test.ts` fails when the content moves without a re-measure.
 */
import record from './levelTimeLimits.json';
import { QUIZ_SECONDS_PER_ITEM } from './lessonModule';

/** World steps per second of driving: the host's fixed rate. */
export const DRIVING_STEPS_PER_SECOND = 60;

/**
 * How long one panel may hold the drive: a scenario being read, a question,
 * a notice. The Short Quiz's time per item, the one allowance for answering a
 * question the game already has and the same assumption (`QUIZ_SECONDS_PER_ITEM`).
 * When it runs out, a briefing or a notice closes itself and a question is
 * settled unanswered, so no hold lasts longer and no attempt lasts for ever:
 * at most the level's driving limit and this much per panel.
 */
export const PANEL_SECONDS = QUIZ_SECONDS_PER_ITEM;
export const PANEL_STEPS = PANEL_SECONDS * DRIVING_STEPS_PER_SECOND;

/** The action a question is settled with when its panel's time runs out. */
export const UNANSWERED = 'unanswered';

/** How many times the longest correct drive a level allows. */
export const TIME_LIMIT_FACTOR = 2;

/** The limit is rounded up to a whole number of these, so it can be told to a player. */
export const TIME_LIMIT_ROUNDING_SECONDS = 30;

export interface LevelTimeLimit {
  levelId: number;
  /** The limit, in seconds of driving. */
  limitSeconds: number;
  /** The same limit in world steps, which is what the session counts. */
  limitSteps: number;
  /** The longest correct drive measured, in world steps. */
  longestSteps: number;
  /** The roll seed that drive was on, or null for a level that does not roll. */
  longestRoll: number | null;
  /** The practice item appended to it, or null for none. */
  longestItem: string | null;
  /** How many drives were measured: every roll, and every practice item on the longest. */
  drives: number;
  /** The content the limit was measured on (`timeLimitFingerprint`). */
  fingerprint: string;
  /**
   * Practice items the reference driver could not drive correctly when
   * appended here, with why. Their drives are not in the longest: a wrong
   * drive measures nothing. Each adds the same road as every other item, so
   * the limit still covers its length; what it does not cover is a hold its
   * own scenario might ask for. Listed so that none is left out unseen.
   */
  unpassed: Array<{ item: string; why: string }>;
}

export interface TimeLimitRecord {
  /** How the reference drive was defined when this table was measured. */
  method?: string;
  measuredOn?: string;
  /** The commit the measurement was run on, with `+dirty` if the tree had changes. */
  commit?: string;
  factor?: number;
  roundingSeconds?: number;
  rollSeeds?: number[];
  levels: LevelTimeLimit[];
}

export const TIME_LIMITS: TimeLimitRecord = record as TimeLimitRecord;

/** The limit for a measured level from its longest correct drive. */
export const limitSecondsFor = (longestSteps: number): number => {
  const seconds = (TIME_LIMIT_FACTOR * longestSteps) / DRIVING_STEPS_PER_SECOND;
  return Math.ceil(seconds / TIME_LIMIT_ROUNDING_SECONDS) * TIME_LIMIT_ROUNDING_SECONDS;
};

/**
 * The limit a level is played under, in world steps. A level the table has
 * never measured has none, which only a development fixture can be: the
 * table's test requires a row for every level in the catalogue.
 */
export const timeLimitStepsFor = (levelId: number): number =>
  TIME_LIMITS.levels.find(row => row.levelId === levelId)?.limitSteps ?? Number.POSITIVE_INFINITY;

/** The same limit in seconds, or null where there is none. */
export const timeLimitSecondsFor = (levelId: number): number | null =>
  TIME_LIMITS.levels.find(row => row.levelId === levelId)?.limitSeconds ?? null;
