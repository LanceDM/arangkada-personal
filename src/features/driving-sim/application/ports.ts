/**
 * What Driving Sim needs from the outside world, stated as interfaces.
 *
 * The application and domain layers depend only on these. Firestore and
 * localStorage implementations live in `../infrastructure` and are bound in
 * `app/dependencies` — which is also why the guest history adapter can read
 * Progression's store without Driving Sim importing another feature.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { TransitionLogEntry } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { DecisionTelemetryDoc } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { RoutingTelemetryDoc } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import type { GroupInEffect, RoutingCursor, RoutingGroup } from '@/features/driving-sim/domain/adaptive/courseRouting';
import type { QuizItemDoc, QuizModuleDoc, QuizSittingDoc } from '@/features/driving-sim/domain/scenario/quizBank';
import type { CourseCursor, DecisionRecord, QOperation, RewardRecord } from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import type { EvidenceRecord, PreTestSeed } from '@/domain/study/evidence';
import type { BKTProfileDoc, BKTUpdateRecord } from '@/domain/study/bktLog';
import type { QLogContext, QLogEntry } from '@/domain/study/qLog';
import type { StudyEnvelope } from '@/domain/study/studyEvent';

/** One recorded run, whichever source it came from. */
export interface LearnerAttempt {
  levelId: number;
  /**
   * When the attempt was saved. Absent for guest results, which are stored as a
   * best-per-level map with no timestamp of their own — left unset rather than
   * back-filled from the logs, so the dev inspector can say "unknown" instead
   * of showing a time that was never recorded.
   */
  timestamp?: number;
  logs: ActionLog[];
  /**
   * Whether the run passed its level: its pass mark reached and no crash.
   * Read only to place a player with no routing cursor yet at their frontier;
   * absent where the source cannot say.
   */
  passed?: boolean;
}

export type HistorySource = 'firestore' | 'local';

export interface LearnerHistory {
  source: HistorySource;
  attempts: LearnerAttempt[];
}

/**
 * The player's graded history. Signed-in players have every attempt ever saved;
 * a guest has only the best attempt per level, in this browser.
 */
export interface LearnerHistoryRepository {
  load(uid: string | null): Promise<LearnerHistory>;
}

export interface StoryAttemptRepository {
  /** Appends an attempt and returns its id, so its FSM telemetry can be linked. */
  save(uid: string, attempt: LevelAttempt): Promise<string>;
  saveFsmTelemetry(uid: string, attemptId: string, transitions: readonly TransitionLogEntry[]): Promise<void>;
  /** The attempt's per-decision record, beside its raw FSM log. */
  saveDecisionTelemetry(uid: string, attemptId: string, record: DecisionTelemetryDoc): Promise<void>;
  /** The attempt's group and, for a course entry, the routing FSM's move. */
  saveRoutingTelemetry(uid: string, attemptId: string, record: RoutingTelemetryDoc): Promise<void>;
}

/** The group an admin pre-assigned a player for the pilot. */
export interface RoutingAssignment {
  group: RoutingGroup;
  assignedAt: number;
}

/**
 * A signed-in player's group and place in the routing FSM. The assignment is
 * written by the developers' script alone and only ever read here; the cursor
 * is the player's own.
 */
export interface RoutingRepository {
  loadAssignment(uid: string): Promise<RoutingAssignment | null>;
  loadCursor(uid: string): Promise<RoutingCursor | null>;
  saveCursor(uid: string, cursor: RoutingCursor): Promise<void>;
}

/** A developer's or admin's choice of group for their own testing: `assigned` is none. */
export type RoutingOverride = 'assigned' | GroupInEffect;

export interface RoutingOverrideRepository {
  load(): RoutingOverride;
  save(override: RoutingOverride): void;
}

/** Which signs this learner has met, and how they did — drives pool selection. */
export interface SignCoverageRepository {
  load(): SignCoverage;
  record(plateName: string, isCorrect: boolean): void;
}

export interface BriefingProgress {
  lessonsRead: boolean;
  quizPassed: boolean;
}

export interface BriefingProgressRepository {
  load(moduleId: string): Partial<BriefingProgress>;
  save(moduleId: string, progress: BriefingProgress): void;
  markLessonsRead(moduleId: string): void;
}

/** One module's part of the Short Quiz bank. */
export interface QuizBank {
  /** Quiz items only: a `test` item is never read here. */
  items: QuizItemDoc[];
  settings: QuizModuleDoc | null;
}

/** `quiz_items` and `quiz_modules`, read by every player, guests included. */
export interface QuizBankRepository {
  load(moduleId: string): Promise<QuizBank>;
}

/** `users/{uid}/quizSittings/{id}`: one finished sitting, append-only. */
export interface QuizSittingRepository {
  save(uid: string, sitting: QuizSittingDoc): Promise<void>;
}

// --- the per-competency course --------------------

/** One course-log entry: what a drive, quiz or final measured, and what it decided. */
export interface CourseLogEntry {
  schemaVersion: 1;
  /** `finish`: the participant took the end path (Finish the study), with no certificate. */
  kind: 'drive' | 'quiz' | 'final' | 'finish';
  levelId: number;
  phase: string;
  /** The attempt the drive was saved as, where there is one. */
  attemptId: string | null;
  /** Per competency: scenarios or items counted, correct, passed. */
  verdicts: { competency: string; total: number; correct: number; passed: boolean; masteryP: number; driveEvidence: number }[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  /** The shared table after this entry's operations. */
  tableAfter: QTable;
  endReason?: 'certified' | 'cap_reached' | 'finished_after_finals' | 'finished_at_deadline';
  /** False when this step taught the shared table nothing (an admin's course); absent otherwise. */
  teachesTable?: false;
  /** On a `finish` entry: the decisions still waiting for a reward, left unrewarded as at certification. */
  unrewarded?: string[];
  timestamp: number;
}

/**
 * One step of the course, computed from the cursor it starts at and the newest
 * shared table: the cursor it leads to, its decisions, rewards and table
 * operations, and its course-log entry (null for a plain move).
 */
export interface CourseStep {
  cursor: CourseCursor;
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  operations: QOperation[];
  log: Omit<CourseLogEntry, 'decisions' | 'rewards' | 'tableAfter'> | null;
}

/** A short-quiz attempt of the course, its answers as graded logs (never a test item). */
export interface CourseQuizSitting {
  schemaVersion: 1;
  kind: 'quiz';
  levelId: number;
  attempt: number;
  answers: ActionLog[];
  timestamp: number;
  /** How the sitting was shown; absent on sittings saved before it was recorded. */
  shown?: CourseQuizShown;
}

export interface CourseQuizShown {
  /** The course draw's seed (which items, from the bank). */
  drawSeed: number;
  /** The drawn item ids, in the draw's order. */
  drawOrder: string[];
  /** The screen's seed: the order asked and each item's choice order. */
  seed: number;
  /** In the order asked: each item's revision, its choices' authored indices in the order shown, and the authored index picked. */
  items: { itemId: string; revision: number; choiceOrder: number[]; chosen: number | null }[];
  startedAt: number;
  finishedAt: number;
  timedOut: boolean;
  language?: string;
}

/** A record of graded answers a step saves with itself. */
export type EvidenceWrite =
  | { kind: 'attempt'; id: string; attempt: LevelAttempt }
  | { kind: 'sitting'; id: string; sitting: CourseQuizSitting };

export type { PreTestSeed } from '@/domain/study/evidence';

/** The quiz or drive open at a course position, so a reload gives the same one back. */
export interface ActiveActivity {
  kind: 'quiz' | 'drive';
  /** The fingerprint of the course position it was opened at. */
  position: string;
  seed: number;
  openedAt: number;
  /** More than 1: a reload or a second tab. */
  opens: number;
}

/**
 * Which shared Q-table a course trains: the cohort's own for a participant,
 * `test` for an account outside the study (the rules hold this).
 */
export type QTableId = 'study' | 'dryrun' | 'test';

export interface CompetencyCourseRepository {
  loadCursor(uid: string): Promise<CourseCursor | null>;
  /** A cohort's shared Q-table; empty until its first decision. */
  loadQTable(table: QTableId): Promise<QTable>;
  /** Every saved record of graded answers (drives and quiz sittings), with its evidence number. */
  loadEvidence(uid: string): Promise<EvidenceRecord[]>;
  /** The pre-test's seed, written with the finished pre-test; null before it. */
  loadPreTestSeed(uid: string): Promise<PreTestSeed | null>;
  /**
   * Commits one course step in one transaction: refuses with
   * CourseConflictError unless the stored cursor is `expected`; runs `compute`
   * on the newest shared table (it may run again, so it must be pure); then
   * writes the step's record under its id and the next evidence number, the
   * table and its log, the course-log entry and the new cursor, all or nothing.
   */
  commitStep(
    uid: string,
    input: {
      table: QTableId;
      expected: CourseCursor;
      compute: (table: QTable) => CourseStep;
      context: QLogContext;
      envelope: (index: number) => StudyEnvelope;
      evidence?: EvidenceWrite | null;
      /** False for an admin's course: nothing is written to the shared table or its log. */
      teachesTable: boolean;
    }
  ): Promise<{ step: CourseStep; entries: QLogEntry[]; table: QTable; evidenceSeq: number | null }>;
  /** The activity open at `fresh.position` (its open count raised), or `fresh` opened now. */
  openActivity(uid: string, fresh: Omit<ActiveActivity, 'opens'>): Promise<ActiveActivity>;
}

/**
 * `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates`: the participant's own
 * BKT log, rebuilt from the saved answers after each step, so a lost write
 * loses nothing the next step does not write again.
 */
export interface BKTLogRepository {
  loadProfile(uid: string): Promise<BKTProfileDoc | null>;
  /** Writes the entries under their fixed ids and the profile, in one write. */
  save(uid: string, profile: BKTProfileDoc, entries: readonly BKTUpdateRecord[]): Promise<void>;
}
