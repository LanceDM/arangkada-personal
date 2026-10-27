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
  type QState,
  type QTable,
  type RewardWeights,
  type ScenarioResult,
  type WarmUp,
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
  | { kind: 'CERTIFIED' };

export const phaseId = (phase: CoursePhase): string =>
  phase.kind === 'FINAL' || phase.kind === 'CERTIFIED' ? phase.kind : `${phase.kind}(${phase.level})`;

/** The level a phase plays or teaches; null once certified. */
export const phaseLevel = (phase: CoursePhase): number | null =>
  phase.kind === 'CERTIFIED' ? null : phase.kind === 'FINAL' ? FINAL_STAGE : phase.level;

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
}

export const COURSE_SCHEMA_VERSION = 1;

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
  measuredBy: 'drive' | 'post_exam';
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
}

/** Scenarios a practice or review adds: the competency's 3 in the repeat drive. */
export const ADDED_DECISIONS_PER_ACTION: Record<CompetencyAction, number> = { none: 0, practice: 3, review: 3 };

const markSeen = (seen: Record<string, number>, ids: readonly string[], seq: number) => ({
  ...seen,
  ...Object.fromEntries(ids.map(id => [id, seq])),
});

/**
 * A drive or repeat drive ended. In order:
 *
 * 1. Every pending decision whose competency this drive measured is rewarded,
 *    r = A_next + 0.5 Pass - 0.02 H, with s' this measurement's state; s' is
 *    null (Q = 0) when the competency has no decision after it.
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

  const measuredState = (m: CompetencyMeasurement): QState => ({
    mastery: masteryLevel(m.masteryP, m.driveEvidence) as MasteryLevel,
    result: m.passed ? 'passed' : 'failed',
  });

  // 2 first (without touching the table), so step 1 knows which competencies
  // will have a decision after this measurement.
  const willDecide = new Set<DrivingCompetency>();
  for (const m of input.measurements) {
    const progress = stage[m.competency] ?? freshProgress();
    if (!progress.done && progress.attempts + 1 < COMPETENCY_ATTEMPT_CAP) willDecide.add(m.competency);
  }

  // 1. Rewards for pending decisions measured here.
  const measuredHere = new Map(input.measurements.map(m => [m.competency, m]));
  const stillPending: PendingDecision[] = [];
  for (const pending of cursor.pending) {
    const m = measuredHere.get(pending.competency);
    if (!m) {
      stillPending.push(pending);
      continue;
    }
    const next = willDecide.has(m.competency) ? measuredState(m) : null;
    const reward = rewardOf({ accuracy: m.accuracy, passed: m.passed }, pending.addedDecisions, weights);
    const applied = updateQ(table, pending.state, pending.action, reward, next, GAMMA);
    table = applied.table;
    operations.push({ kind: 'update', state: pending.state, action: pending.action, reward, next, gamma: GAMMA });
    rewards.push({
      decisionId: pending.id, competency: pending.competency, state: pending.state, action: pending.action, reward,
      accuracy: m.accuracy, passed: m.passed, addedDecisions: pending.addedDecisions, next, measuredBy: 'drive', timestamp: input.now,
    });
  }

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
        legal, action: 'none', source: 'cap', probability: 1, probabilities: { none: 1 }, leader: null, timestamp: input.now,
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
      probabilities: decision.probabilities, leader: decision.leader, timestamp: input.now,
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
    });

    if (state.result === 'failed') progress.failedBefore = true;
    progress.lastResult = state.result;
    progress.done = decision.action === 'none';
    progress.pendingReview = decision.action === 'review';
    stage[m.competency] = progress;
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
  return { ...cursor, phase: passed ? { kind: 'CERTIFIED' } : { kind: 'FINAL' }, seen: markSeen(cursor.seen, scenarioIds, cursor.seq) };
};

/**
 * The post-evaluation exam: the last measurement. Every decision still waiting
 * for its competency to be measured again (most often a `none`) is rewarded on
 * that competency's post-exam items, with no next state. A competency the exam
 * did not cover leaves its decisions unrewarded: they are excluded from
 * learning and counted per action in the report.
 *
 * OPEN: whether the post-exam is the right measurement for a `none` taken many
 * stages earlier (per-competency reward timing).
 */
export const postExamCompleted = (
  cursor: CourseCursor,
  byCompetency: Partial<Record<DrivingCompetency, { accuracy: number; passed: boolean }>>,
  table: QTable,
  now: number,
  weights: RewardWeights = DEFAULT_REWARD
): { cursor: CourseCursor; rewards: RewardRecord[]; operations: QOperation[]; table: QTable; unrewarded: PendingDecision[] } => {
  const rewards: RewardRecord[] = [];
  const operations: QOperation[] = [];
  const unrewarded: PendingDecision[] = [];
  let next = table;
  for (const pending of cursor.pending) {
    const m = byCompetency[pending.competency];
    if (!m) {
      unrewarded.push(pending);
      continue;
    }
    const reward = rewardOf(m, pending.addedDecisions, weights);
    next = updateQ(next, pending.state, pending.action, reward, null, GAMMA).table;
    operations.push({ kind: 'update', state: pending.state, action: pending.action, reward, next: null, gamma: GAMMA });
    rewards.push({
      decisionId: pending.id, competency: pending.competency, state: pending.state, action: pending.action, reward,
      accuracy: m.accuracy, passed: m.passed, addedDecisions: pending.addedDecisions, next: null, measuredBy: 'post_exam', timestamp: now,
    });
  }
  return { cursor: { ...cursor, pending: unrewarded }, rewards, operations, table: next, unrewarded };
};

/** Applies operations to a table: what the store runs inside its transaction on the newest table. */
export const applyQOperations = (table: QTable, operations: readonly QOperation[]): QTable =>
  operations.reduce(
    (current, op) =>
      op.kind === 'visit' ? recordVisit(current, op.state, op.action) : updateQ(current, op.state, op.action, op.reward, op.next, op.gamma).table,
    table
  );
