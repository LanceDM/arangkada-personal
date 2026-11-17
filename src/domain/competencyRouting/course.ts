/**
 * The routing FSM, per competency (redesign of 2026-10-27/28).
 *
 * M = (Q, Sigma, delta, q0, F):
 * - Q = { MODULE(L), QUIZ(L), QUIZ_REVIEW(L), DRIVE(L), REPEAT(L), FINAL, CERTIFIED }
 * - Sigma = lessons read, quiz and drive results, and the actions chosen
 * - delta = the table below (partial, guarded)
 * - q0 = MODULE(0), F = { CERTIFIED }
 *
 * | From                 | Condition                                         | To                                        |
 * |----------------------|---------------------------------------------------|-------------------------------------------|
 * | MODULE(0)            | lessons read                                      | DRIVE(0), the tutorial: no quiz, no decisions |
 * | DRIVE(0)             | drive ended                                       | MODULE(1)                                 |
 * | MODULE(L)            | lessons read                                      | QUIZ(L)                                   |
 * | QUIZ(L)              | every competency passed (2 of 3 each)             | DRIVE(L)                                  |
 * | QUIZ(L)              | some failed, attempts left (max 3)                | QUIZ(L): the failed competencies, new items |
 * | QUIZ(L)              | third attempt failed                              | QUIZ_REVIEW(L): module review (OPEN), then DRIVE(L) |
 * | DRIVE(L) / REPEAT(L) | every competency done                             | MODULE(L+1), or FINAL after L11           |
 * | DRIVE(L) / REPEAT(L) | otherwise                                         | REPEAT(L): only the not-done competencies |
 * | FINAL                | passed / failed                                   | CERTIFIED / FINAL                         |
 *
 * After every DRIVE or REPEAT each counted competency gets one decision: none
 * (done), practice (its scenarios again, new variants) or review (its module
 * section, then its scenarios). A competency is done when the policy chooses
 * none, or after 3 attempts (flagged unless none was legal then). The short
 * quiz is a gate and feeds BKT; it is not part of the verdict the FSM routes on.
 *
 * Everything here is a pure function of the cursor and what it is told. The
 * shared Q-table is changed only through the operations these return, so the
 * store can apply them atomically to the newest table.
 */
import type { DrivingCompetency } from '@/domain/learner/competency';
import {
  COMPETENCY_STAGES,
  QUIZ_ATTEMPT_CAP,
  QUIZ_PASS_CORRECT,
  STAGE_COMPETENCIES,
  type CompetencyStage,
} from '@/domain/learner/stageCompetencies';
import { masteryLevel, type MasteryLevel } from './mastery';
import { canonicalJSON } from '@/domain/study/canonical';
import {
  chooseAction,
  legalActions,
  recordVisit,
  rewardOf,
  updateQ,
  DEFAULT_REWARD,
  DEFAULT_WARM_UP,
  GAMMA,
  type CompetencyAction,
  type DecisionPhase,
  type DecisionSelection,
  type PolicyDecision,
  type QState,
  type QTable,
  type RewardWeights,
  type ScenarioResult,
  type WarmUp,
  type RewardKind,
} from './qLearning';

export const TUTORIAL_STAGE = 0;
export const FINAL_STAGE = 12;
export const LAST_COMPETENCY_STAGE = 11;
/** Attempts per competency in a stage (the first drive and repeats), then done and flagged. */
export const COMPETENCY_ATTEMPT_CAP = 3;

// --- states ---------------------------------------------------------------------

export type CoursePhase =
  | { kind: 'MODULE'; level: number }
  | { kind: 'QUIZ'; level: CompetencyStage }
  | { kind: 'QUIZ_REVIEW'; level: CompetencyStage; competencies: DrivingCompetency[] }
  | { kind: 'DRIVE'; level: number }
  | { kind: 'REPEAT'; level: CompetencyStage }
  | { kind: 'FINAL' }
  | { kind: 'CERTIFIED' }
  /** The course ended without the certificate: the participant chose to finish the study (the end path). */
  | { kind: 'FINISHED'; reason: CourseFinishReason };

/** Why a course ended without the certificate: after the failed finals, or at the study's deadline. */
export type CourseFinishReason = 'final_attempts' | 'deadline';

/** Failed final exams after which the study home offers to finish the study. */
export const FINAL_ATTEMPTS_BEFORE_FINISH = 3;

export const phaseId = (phase: CoursePhase): string =>
  phase.kind === 'FINAL' || phase.kind === 'CERTIFIED' || phase.kind === 'FINISHED' ? phase.kind : `${phase.kind}(${phase.level})`;

/** The level a phase plays or teaches; null once the course has ended. */
export const phaseLevel = (phase: CoursePhase): number | null =>
  phase.kind === 'CERTIFIED' || phase.kind === 'FINISHED' ? null : phase.kind === 'FINAL' ? FINAL_STAGE : phase.level;

export interface CompetencyProgress {
  attempts: number;
  done: boolean;
  /** Done by the attempt cap without `none` being legal: reported, the learner moves on. */
  flagged: boolean;
  /** It failed an earlier attempt in this stage: the fallback rule reviews on a repeat failure. */
  failedBefore: boolean;
  /** Review was chosen: its module section is shown before the next repeat drive. */
  pendingReview: boolean;
  lastResult: ScenarioResult | null;
}

export interface QuizProgress {
  /** 1-3. */
  attempt: number;
  /** Competencies still to pass; the next attempt asks only these. */
  remaining: DrivingCompetency[];
  passed: DrivingCompetency[];
  /** Bank items already shown in this stage's quiz: retakes draw unseen ones. */
  seenItems: string[];
}

/** A decision waiting for the competency's next measurement to be rewarded. */
export interface PendingDecision {
  id: string;
  competency: DrivingCompetency;
  levelId: number;
  state: QState;
  action: CompetencyAction;
  /** H: graded decisions the action added. */
  addedDecisions: number;
  decidedAt: number;
  /**
   * The episode ended with this decision and it waits for the competency's next
   * measurement after the level (Option 2): a `none`, or a practice or review
   * the attempt cap closed. Absent on cursors saved before it: read as `none`.
   */
  awaitsOutcome?: boolean;
}

export interface CourseCursor {
  schemaVersion: typeof COURSE_SCHEMA_VERSION;
  phase: CoursePhase;
  /** The current stage's competencies; empty outside a competency stage's drives. */
  stage: Partial<Record<DrivingCompetency, CompetencyProgress>>;
  quiz: QuizProgress | null;
  pending: PendingDecision[];
  /** Scenario id -> the decision sequence number it was last seen at: repeat drives draw unseen first. */
  seen: Record<string, number>;
  /** Competencies that reached the cap, by stage, for the report. */
  flagged: { levelId: number; competency: DrivingCompetency }[];
  /** Decisions taken so far: the next decision's sequence number. */
  seq: number;
  /** Final exams failed so far; absent before the first. */
  finalFailures?: number;
}

export const COURSE_SCHEMA_VERSION = 1;

/** Whether two cursors are the same position: equal as stored data, whatever their key order. */
export const sameCursor = (a: CourseCursor, b: CourseCursor): boolean => canonicalJSON(a) === canonicalJSON(b);

export const startingCourse = (): CourseCursor => ({
  schemaVersion: COURSE_SCHEMA_VERSION,
  phase: { kind: 'MODULE', level: TUTORIAL_STAGE },
  stage: {},
  quiz: null,
  pending: [],
  seen: {},
  flagged: [],
  seq: 0,
});

const freshProgress = (): CompetencyProgress => ({
  attempts: 0,
  done: false,
  flagged: false,
  failedBefore: false,
  pendingReview: false,
  lastResult: null,
});

const isCompetencyStage = (level: number): level is CompetencyStage =>
  (COMPETENCY_STAGES as readonly number[]).includes(level);

/** The competencies the next drive counts: all of the stage's on DRIVE, the not-done ones on REPEAT. */
export const driveCompetencies = (cursor: CourseCursor): DrivingCompetency[] => {
  const { phase } = cursor;
  if ((phase.kind === 'DRIVE' || phase.kind === 'REPEAT') && isCompetencyStage(phase.level)) {
    return STAGE_COMPETENCIES[phase.level].filter(competency => !cursor.stage[competency]?.done);
  }
  return [];
};

/** Competencies whose module section is shown before the coming repeat drive. */
export const reviewsDue = (cursor: CourseCursor): DrivingCompetency[] =>
  (Object.entries(cursor.stage) as [DrivingCompetency, CompetencyProgress][])
    .filter(([, progress]) => progress.pendingReview && !progress.done)
    .map(([competency]) => competency);

// --- module and quiz -------------------------------------------------------------

export class IllegalTransition extends Error {}

const expect = (cursor: CourseCursor, kinds: CoursePhase['kind'][], what: string) => {
  if (!kinds.includes(cursor.phase.kind)) throw new IllegalTransition(`${what} is not legal in ${phaseId(cursor.phase)}`);
};

/** MODULE(L) -> QUIZ(L), or the tutorial's MODULE(0) -> DRIVE(0). */
export const lessonsRead = (cursor: CourseCursor): CourseCursor => {
  expect(cursor, ['MODULE'], 'lessons_read');
  const level = (cursor.phase as { level: number }).level;
  if (level === TUTORIAL_STAGE) return { ...cursor, phase: { kind: 'DRIVE', level } };
  if (!isCompetencyStage(level)) throw new IllegalTransition(`no module stage ${level}`);
  return {
    ...cursor,
    phase: { kind: 'QUIZ', level },
    quiz: { attempt: 1, remaining: [...STAGE_COMPETENCIES[level]], passed: [], seenItems: [] },
  };
};

export interface QuizAnswer {
  itemId: string;
  competency: DrivingCompetency;
  correct: boolean;
}

/**
 * One quiz attempt graded per competency: 2 of 3 to pass. All passed opens the
 * drive; otherwise a retake of the failed competencies with new items, up to 3
 * attempts; after the third the learner reviews the module for the failed ones
 * (what follows that review is OPEN; for now, the drive).
 */
export const quizSubmitted = (cursor: CourseCursor, answers: readonly QuizAnswer[]): CourseCursor => {
  expect(cursor, ['QUIZ'], 'quiz_submitted');
  const level = (cursor.phase as { level: CompetencyStage }).level;
  const quiz = cursor.quiz!;
  const passedNow = quiz.remaining.filter(
    competency => answers.filter(answer => answer.competency === competency && answer.correct).length >= QUIZ_PASS_CORRECT
  );
  const remaining = quiz.remaining.filter(competency => !passedNow.includes(competency));
  const seenItems = [...quiz.seenItems, ...answers.map(answer => answer.itemId)];
  const passed = [...quiz.passed, ...passedNow];

  if (remaining.length === 0) {
    return { ...cursor, phase: { kind: 'DRIVE', level }, quiz: { ...quiz, remaining, passed, seenItems }, stage: stageStart(level) };
  }
  if (quiz.attempt < QUIZ_ATTEMPT_CAP) {
    return { ...cursor, quiz: { attempt: quiz.attempt + 1, remaining, passed, seenItems } };
  }
  return {
    ...cursor,
    phase: { kind: 'QUIZ_REVIEW', level, competencies: remaining },
    quiz: { ...quiz, remaining, passed, seenItems },
  };
};

/** QUIZ_REVIEW(L) -> DRIVE(L): the module was reviewed for the failed competencies. OPEN: what follows the review. */
export const quizReviewDone = (cursor: CourseCursor): CourseCursor => {
  expect(cursor, ['QUIZ_REVIEW'], 'quiz_review_done');
  const level = (cursor.phase as { level: CompetencyStage }).level;
  return { ...cursor, phase: { kind: 'DRIVE', level }, stage: stageStart(level) };
};

const stageStart = (level: CompetencyStage): CourseCursor['stage'] =>
  Object.fromEntries(STAGE_COMPETENCIES[level].map(competency => [competency, freshProgress()]));

/** The module sections of the review competencies were shown: the repeat drive may start. */
export const reviewShown = (cursor: CourseCursor): CourseCursor => {
  expect(cursor, ['REPEAT'], 'review_shown');
  return {
    ...cursor,
    stage: Object.fromEntries(
      Object.entries(cursor.stage).map(([competency, progress]) => [competency, { ...progress!, pendingReview: false }])
    ),
  };
};

// --- the drive and the decisions ---------------------------------------------------

/** What one competency's drive measured, with its BKT mastery after the attempt. */
export interface CompetencyMeasurement {
  /** A drive's verdict, or the competency's answers in one quiz sitting. */
  competency: DrivingCompetency;
  accuracy: number;
  passed: boolean;
  /** BKT mastery after the attempt, quiz answers included. */
  masteryP: number;
  /** Graded drive answers BKT has for it so far (the minimum-evidence cap reads it). */
  driveEvidence: number;
}

/** A change to the shared Q-table, applied atomically by the store to its newest version. */
export type QOperation =
  | { kind: 'visit'; state: QState; action: CompetencyAction }
  | { kind: 'update'; state: QState; action: CompetencyAction; reward: number; next: QState | null; gamma: number };

/** One decision, as the log records it. */
export interface DecisionRecord {
  seq: number;
  levelId: number;
  phase: string;
  competency: DrivingCompetency;
  state: QState;
  masteryP: number;
  legal: CompetencyAction[];
  action: CompetencyAction;
  /** Who chose: the warm-up phase, `only_legal`, or `cap` when the attempt cap ended it. */
  source: DecisionPhase | 'cap';
  probability: number;
  probabilities: Partial<Record<CompetencyAction, number>>;
  leader: CompetencyAction | null;
  /** Explored, exploited or forced (only one legal action, or the cap). */
  selection: DecisionSelection;
  /** The random number the action was drawn with; null when nothing was drawn. */
  draw: number | null;
  /** Every legal action's Q and visits when the decision was made. */
  snapshot: PolicyDecision['snapshot'];
  timestamp: number;
}

/** A pending decision rewarded at its competency's next measurement. */
export interface RewardRecord {
  decisionId: string;
  competency: DrivingCompetency;
  state: QState;
  action: CompetencyAction;
  reward: number;
  accuracy: number;
  passed: boolean;
  addedDecisions: number;
  next: QState | null;
  /** Where the next measurement came from. */
  measuredBy: 'drive' | 'quiz' | 'final';
  /** Option 2: a step earns only its cost; a terminal reward earns the outcome too. */
  kind: RewardKind;
  timestamp: number;
}

export interface DriveOutcome {
  cursor: CourseCursor;
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  operations: QOperation[];
  /** The table with this drive's operations applied, for the next decision in the same session. */
  table: QTable;
}

export interface DriveInput {
  measurements: readonly CompetencyMeasurement[];
  /** Every scenario id the drive placed: marked seen. */
  scenarioIds: readonly string[];
  /** The newest shared table. */
  table: QTable;
  rng: () => number;
  now: number;
  warmUp?: WarmUp;
  weights?: RewardWeights;
  /**
   * The stage's competencies this drive could place no scenario for: the
   * level's road can host none that fits. Each
   * is closed for this stage with no decision and no reward, since nothing
   * measured it; the stages that teach it elsewhere still measure it. A
   * competency an ended drive never asked is not listed here: it is not
   * measured, and stays open.
   */
  unmeasurable?: readonly DrivingCompetency[];
}

/** Scenarios a practice or review adds: the competency's 3 in the repeat drive. */
export const ADDED_DECISIONS_PER_ACTION: Record<CompetencyAction, number> = { none: 0, practice: 3, review: 3 };

const markSeen = (seen: Record<string, number>, ids: readonly string[], seq: number) => ({
  ...seen,
  ...Object.fromEntries(ids.map(id => [id, seq])),
});

/** The Q-state a measurement puts a competency in. */
const measuredState = (m: CompetencyMeasurement): QState => ({
  mastery: masteryLevel(m.masteryP, m.driveEvidence) as MasteryLevel,
  result: m.passed ? 'passed' : 'failed',
});

const awaitsOutcome = (decision: PendingDecision): boolean => decision.awaitsOutcome ?? decision.action === 'none';

/**
 * Rewards the pending decisions on the competencies `measurements` measured
 * (Option 2, algorithm ledger §2.3a: one episode per competency per level,
 * gamma = 1). `level` is the stage a drive measured; null for a quiz or the
 * final exam, which always come after the level that decided.
 *
 * - Same level, a practice or review, and a decision follows: a step, r =
 *   -psi * H, s' the measured state.
 * - Same level, a practice or review the cap closes: no reward yet; it now
 *   waits for the next measurement after the level.
 * - Same level, a decision already waiting (a `none`): untouched.
 * - A later level, a quiz or the final exam: terminal, r = A - psi * H, s'
 *   null. Nothing chains across levels.
 */
const rewardPending = (
  pending: readonly PendingDecision[],
  measurements: readonly CompetencyMeasurement[],
  willDecide: ReadonlySet<DrivingCompetency>,
  table: QTable,
  measuredBy: RewardRecord['measuredBy'],
  level: number | null,
  now: number,
  weights: RewardWeights
) => {
  const measuredHere = new Map(measurements.map(m => [m.competency, m]));
  const rewards: RewardRecord[] = [];
  const operations: QOperation[] = [];
  const stillPending: PendingDecision[] = [];
  let next = table;
  for (const decision of pending) {
    const m = measuredHere.get(decision.competency);
    if (!m) {
      stillPending.push(decision);
      continue;
    }
    const sameLevel = level !== null && decision.levelId === level;
    if (sameLevel && awaitsOutcome(decision)) {
      stillPending.push(decision);
      continue;
    }
    if (sameLevel && !willDecide.has(m.competency)) {
      stillPending.push({ ...decision, awaitsOutcome: true });
      continue;
    }
    const kind: RewardKind = sameLevel ? 'step' : 'terminal';
    const nextState = kind === 'step' ? measuredState(m) : null;
    const reward = rewardOf({ accuracy: m.accuracy, passed: m.passed }, decision.addedDecisions, weights, kind);
    next = updateQ(next, decision.state, decision.action, reward, nextState, GAMMA).table;
    operations.push({ kind: 'update', state: decision.state, action: decision.action, reward, next: nextState, gamma: GAMMA });
    rewards.push({
      decisionId: decision.id, competency: decision.competency, state: decision.state, action: decision.action, reward,
      accuracy: m.accuracy, passed: m.passed, addedDecisions: decision.addedDecisions, next: nextState, measuredBy, kind, timestamp: now,
    });
  }
  return { rewards, operations, stillPending, table: next };
};

/**
 * A short-quiz sitting was graded. The quiz opens a level, so every pending
 * decision on a competency it measured comes from an earlier level and is
 * rewarded terminally here (Option 2): r = A - psi * H, s' null.
 */
export const quizMeasured = (
  cursor: CourseCursor,
  measurements: readonly CompetencyMeasurement[],
  table: QTable,
  now: number,
  weights: RewardWeights = DEFAULT_REWARD
): { cursor: CourseCursor; rewards: RewardRecord[]; operations: QOperation[]; table: QTable } => {
  const rewarded = rewardPending(cursor.pending, measurements, new Set(), table, 'quiz', null, now, weights);
  return { cursor: { ...cursor, pending: rewarded.stillPending }, rewards: rewarded.rewards, operations: rewarded.operations, table: rewarded.table };
};

/**
 * The final exam measured its competencies (one scenario each): pending
 * decisions on them are rewarded now, and terminally, because no routing
 * decision follows the final exam (Tentative, part of "next measurement
 * anywhere"). A retaken final settles nothing more: the first sitting
 * already settled what it measured. A sitting that ended early measures only
 * the competencies it asked: the caller leaves the rest out, so their
 * decisions stay pending for the next sitting, and none is rewarded twice.
 */
export const finalMeasured = (
  cursor: CourseCursor,
  measurements: readonly CompetencyMeasurement[],
  table: QTable,
  now: number,
  weights: RewardWeights = DEFAULT_REWARD
): { cursor: CourseCursor; rewards: RewardRecord[]; operations: QOperation[]; table: QTable } => {
  const rewarded = rewardPending(cursor.pending, measurements, new Set(), table, 'final', null, now, weights);
  return { cursor: { ...cursor, pending: rewarded.stillPending }, rewards: rewarded.rewards, operations: rewarded.operations, table: rewarded.table };
};

/**
 * A drive or repeat drive ended. In order:
 *
 * 1. Every pending decision whose competency this drive measured is rewarded
 *    as `rewardPending` says: a step within the level, terminal from an
 *    earlier level.
 * 2. Each counted competency gets its decision, unless the attempt cap ends it.
 * 3. The stage advances when every competency is done; otherwise a repeat drive.
 *
 * The tutorial and the final exam make no decisions.
 */
export const driveCompleted = (cursor: CourseCursor, input: DriveInput): DriveOutcome => {
  expect(cursor, ['DRIVE', 'REPEAT'], 'drive_completed');
  const level = (cursor.phase as { level: number }).level;
  const seen = markSeen(cursor.seen, input.scenarioIds, cursor.seq);
  if (!isCompetencyStage(level)) {
    // The tutorial: no competency decisions.
    return { cursor: { ...cursor, phase: { kind: 'MODULE', level: level + 1 }, seen }, decisions: [], rewards: [], operations: [], table: input.table };
  }

  const warmUp = input.warmUp ?? DEFAULT_WARM_UP;
  const weights = input.weights ?? DEFAULT_REWARD;
  let table = input.table;
  const operations: QOperation[] = [];
  const decisions: DecisionRecord[] = [];
  const rewards: RewardRecord[] = [];
  const stage = { ...cursor.stage };
  let seq = cursor.seq;
  const flagged = [...cursor.flagged];
  const newPending: PendingDecision[] = [];

  // 2 first (without touching the table), so step 1 knows which competencies
  // will have a decision after this measurement.
  const willDecide = new Set<DrivingCompetency>();
  for (const m of input.measurements) {
    const progress = stage[m.competency] ?? freshProgress();
    if (!progress.done && progress.attempts + 1 < COMPETENCY_ATTEMPT_CAP) willDecide.add(m.competency);
  }

  // 1. Rewards for pending decisions measured here.
  const rewarded = rewardPending(cursor.pending, input.measurements, willDecide, table, 'drive', level, input.now, weights);
  table = rewarded.table;
  operations.push(...rewarded.operations);
  rewards.push(...rewarded.rewards);
  const stillPending = rewarded.stillPending;

  // 2. Decisions.
  for (const m of input.measurements) {
    const progress = { ...(stage[m.competency] ?? freshProgress()) };
    if (progress.done) continue;
    progress.attempts += 1;
    const state = measuredState(m);
    const legal = legalActions(state);

    if (progress.attempts >= COMPETENCY_ATTEMPT_CAP) {
      // The cap ends it. Flagged unless none was legal: a pass at mastery 0.50 or more.
      progress.done = true;
      progress.flagged = !legal.includes('none');
      progress.pendingReview = false;
      progress.lastResult = state.result;
      if (progress.flagged) flagged.push({ levelId: level, competency: m.competency });
      decisions.push({
        seq: seq++, levelId: level, phase: phaseId(cursor.phase), competency: m.competency, state, masteryP: m.masteryP,
        legal, action: 'none', source: 'cap', probability: 1, probabilities: { none: 1 }, leader: null,
        selection: 'forced', draw: null, snapshot: {}, timestamp: input.now,
      });
      stage[m.competency] = progress;
      continue;
    }

    const decision = chooseAction(
      table,
      state,
      { state, masteryP: m.masteryP, failedBefore: progress.failedBefore },
      input.rng,
      warmUp
    );
    table = recordVisit(table, state, decision.action);
    operations.push({ kind: 'visit', state, action: decision.action });
    const record: DecisionRecord = {
      seq: seq++, levelId: level, phase: phaseId(cursor.phase), competency: m.competency, state, masteryP: m.masteryP,
      legal: decision.legal, action: decision.action, source: decision.phase, probability: decision.probability,
      probabilities: decision.probabilities, leader: decision.leader,
      selection: decision.selection, draw: decision.draw, snapshot: decision.snapshot, timestamp: input.now,
    };
    decisions.push(record);
    newPending.push({
      id: `${level}:${m.competency}:${record.seq}`,
      competency: m.competency,
      levelId: level,
      state,
      action: decision.action,
      addedDecisions: ADDED_DECISIONS_PER_ACTION[decision.action],
      decidedAt: input.now,
      awaitsOutcome: decision.action === 'none',
    });

    if (state.result === 'failed') progress.failedBefore = true;
    progress.lastResult = state.result;
    progress.done = decision.action === 'none';
    progress.pendingReview = decision.action === 'review';
    stage[m.competency] = progress;
  }
  for (const competency of input.unmeasurable ?? []) {
    const progress = stage[competency] ?? freshProgress();
    if (!progress.done) stage[competency] = { ...progress, done: true, pendingReview: false };
  }

  // 3. Advance.
  const allDone = STAGE_COMPETENCIES[level].every(competency => stage[competency]?.done);
  const phase: CoursePhase = allDone
    ? level === LAST_COMPETENCY_STAGE
      ? { kind: 'FINAL' }
      : { kind: 'MODULE', level: level + 1 }
    : { kind: 'REPEAT', level };

  return {
    cursor: {
      ...cursor,
      phase,
      stage: allDone ? {} : stage,
      quiz: allDone ? null : cursor.quiz,
      pending: [...stillPending, ...newPending],
      seen,
      flagged,
      seq,
    },
    decisions,
    rewards,
    operations,
    table,
  };
};

/** FINAL -> CERTIFIED on a pass, FINAL again on a fail. */
export const finalCompleted = (cursor: CourseCursor, passed: boolean, scenarioIds: readonly string[]): CourseCursor => {
  expect(cursor, ['FINAL'], 'final_completed');
  const seen = markSeen(cursor.seen, scenarioIds, cursor.seq);
  return passed
    ? { ...cursor, phase: { kind: 'CERTIFIED' }, seen }
    : { ...cursor, phase: { kind: 'FINAL' }, seen, finalFailures: (cursor.finalFailures ?? 0) + 1 };
};

/** Whether this participant may finish the study without the certificate now. */
export const mayFinishWithoutCertificate = (cursor: CourseCursor, reason: CourseFinishReason): boolean =>
  cursor.phase.kind !== 'CERTIFIED' && cursor.phase.kind !== 'FINISHED' &&
  (reason === 'deadline' || (cursor.phase.kind === 'FINAL' && (cursor.finalFailures ?? 0) >= FINAL_ATTEMPTS_BEFORE_FINISH));

/**
 * The end path: the course ends without the certificate, and the study goes on
 * to the post-test. Offered after FINAL_ATTEMPTS_BEFORE_FINISH failed finals,
 * or to anyone not yet certified once the admin's study deadline has passed
 * (the caller has checked it). Decisions still pending stay unrewarded, as at
 * any other end of the course.
 */
export const finishWithoutCertificate = (cursor: CourseCursor, reason: CourseFinishReason): CourseCursor => {
  if (!mayFinishWithoutCertificate(cursor, reason)) throw new IllegalTransition(`finish (${reason}) is not legal in ${phaseId(cursor.phase)}`);
  return { ...cursor, phase: { kind: 'FINISHED', reason }, stage: {}, quiz: null };
};

/**
 * The course ended (certified, or the study closed). Every decision still
 * waiting for its competency to be measured again is left unrewarded: it is
 * excluded from learning and counted per action in the report. The post-test
 * is the study's outcome measure and never rewards a decision, or the outcome
 * would train the policy it judges.
 */
export const unrewardedAtEnd = (cursor: CourseCursor): PendingDecision[] => [...cursor.pending];

/** Applies operations to a table: what the store runs inside its transaction on the newest table. */
export const applyQOperations = (table: QTable, operations: readonly QOperation[]): QTable =>
  operations.reduce(
    (current, op) =>
      op.kind === 'visit' ? recordVisit(current, op.state, op.action) : updateQ(current, op.state, op.action, op.reward, op.next, op.gamma).table,
    table
  );
