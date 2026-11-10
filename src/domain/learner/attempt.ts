import type { DrivingCompetency, SupportLevel } from './competency';

/**
 * Where a graded answer came from. BKT reads every class, with separate guess
 * and slip per class (`mastery/buildBKTProfile.ts`). The diagnostic and the
 * post-evaluation exam use no learning step (T = 0).
 */
export type EvidenceSource = 'drive' | 'quiz' | 'diagnostic' | 'post_exam';

export interface ActionLog {
  timestamp: number;
  action: string;
  result: 'correct' | 'violation' | 'neutral';
  points: number;
  /**
   * Milliseconds from the start of the reaction clock to the driver's own
   * response. Present only when the decision was a response to a scenario that
   * asked for one; a window that expired, a question or a tutorial step records
   * none. Attempts saved before censoring timed every decision.
   */
  reactionTime?: number;
  /**
   * The scenario asked for a response and its window closed without one: the
   * response took at least the whole window, and no time was observed. Written
   * only when true, like the provenance fields below.
   */
  reactionCensored?: true;
  /**
   * An in-drive question (checkpoint, right-of-way, emergency, parking) whose
   * time limit ran out before it was answered. The scenario counts as not
   * passed, but BKT does not read the answer: running out of time is not
   * evidence about the rule (Lance, 2026-10-28). Written only when true.
   */
  questionTimedOut?: true;
  ruleId?: string;
  /** One of the 11 competencies: a misspelled tag fails to compile instead of being dropped by BKT. */
  competency?: DrivingCompetency;
  severity?: string;
  weight?: number;
  expectedAction?: string;
  /**
   * Provenance of the event this entry was graded from. `remediation` and
   * `sourceLevelId` are written together or not at all, and only for an event
   * the adaptive selector injected (`ScenarioEvent.remediation`) — a level's own
   * authored content leaves both absent, which is exactly the distinction they
   * exist to record.
   *
   * Without them the log is a flat stream of graded decisions, and a mastery
   * change can be watched but not attributed: there is no way to ask "did the
   * scenario the adaptive layer chose actually move this learner", which is
   * the only question that tells you whether the layer is doing anything.
   *
   * Written by conditional spread rather than as `undefined` fields, because
   * these go straight to Firestore (`saveLevelAttempt`), which rejects
   * `undefined` values. Absent is the intended representation, not null.
   */
  remediation?: true;
  /**
   * Attempts saved before support levels only: the timing multiplier an injected
   * practice item was placed with (1.5x, 1x or 0.65x its warning distance).
   * Read, never written. It is not a support level: before them every
   * briefing showed the full instruction, whatever this says.
   */
  mode?: 'easy' | 'normal' | 'hard';
  /** The level the injected scenario was borrowed from, which is not the level it was played in. */
  sourceLevelId?: number;
  /**
   * The support level h the scenario was presented at, on every decision a
   * driver answered with the car: a response, a window that closed, or a lapse.
   * Absent on a question, a tutorial step, and every attempt saved before
   * support levels.
   */
  support?: SupportLevel;
  /**
   * A standing penalty (crawling, the wrong side of the road): a charge for
   * something the driver kept doing on clear road, not a decision at a
   * scenario. Written only when true. Attempts saved before evidence was marked carry none,
   * and their penalties cannot be told from a scenario by any other field.
   */
  standing?: true;
  /**
   * A question whose panel's time ran out before an answer. Scored
   * as a wrong answer, but it says nothing about what the player knows, so it
   * is not BKT evidence. Written only when true.
   */
  unanswered?: true;
  /**
   * Where this answer came from. Absent on every driving decision, including
   * all attempts saved before quiz and diagnostic answers were logged: absent
   * means `drive`.
   */
  source?: EvidenceSource;
  /** The scenario (drive) this decision was graded on. */
  scenarioId?: string;
  /** Quiz, diagnostic and post-exam answers: the bank item answered. */
  itemId?: string;
  /** Short-quiz answers: which attempt of the stage's quiz (1-3). */
  quizAttempt?: number;
  /** The bank item's revision when it was shown (quiz items from the admin-edited bank). */
  itemRevision?: number;
  /** The language the item was shown in: `fil` only when its Filipino was there to show. */
  language?: 'en' | 'fil';
}

/**
 * One sign met during a run, and how the driver answered it. Kept per-run
 * rather than read back from the cumulative coverage record, so the results
 * screen can show what happened in *this* drive.
 */
export interface SignOutcome {
  name: string;
  category: string;
  meaning: string;
  /** File under public/, absent for traffic signals which have no sign image. */
  image?: string;
  isCorrect: boolean;
  /** What the driver actually did, and what the sign asked for. */
  action: string;
  expectedAction: string;
  /** The correction shown at the time, so the review says the same thing. */
  message: string;
}

export interface LevelResult {
  levelId: number;
  score: number;
  stars: number;
  completed: boolean;
  violations: number;
  correctActions: number;
  logs: ActionLog[];
  competencyScores?: Record<string, number>;
  weakestCompetency?: string | null;
  /** Set when the run ended in a collision, explaining what was hit and why. */
  crashReason?: string;
  /**
   * Set when the run ended because the level's driving time ran out.
   * A fail like a crash, but nothing was hit, so it carries no reason of its
   * own and adds no violation.
   */
  timedOut?: true;
  /** Every signed event met on this run, for the review after it. */
  signOutcomes?: SignOutcome[];
}
