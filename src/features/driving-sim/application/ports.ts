import type { BackgroundResponse } from '@/domain/study/backgroundForm';
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
import type { CourseCursor, DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import type { EvidenceSource } from '@/domain/learner/attempt';
import type { StudyEvent } from '@/domain/study/studyEvent';
import type { BKTProfileDoc, BKTUpdateRecord } from '@/domain/study/bktLog';
import type { QLogContext, QLogEntry, QLogItem } from '@/domain/study/qLog';
import type { StudyEnvelope } from '@/domain/study/studyEvent';
import type { SurveyResponse } from '@/domain/study/survey';

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

// --- the per-competency routing FSM (2026-10-28) -------------------------------

/** One entry of a player's course log: a drive's decisions and rewards, with the table they were taken against. */
export interface CourseLogEntry {
  schemaVersion: 1;
  kind: 'drive' | 'quiz' | 'post_exam' | 'final';
  levelId: number;
  phase: string;
  /** The attempt the drive was saved as, where there is one. */
  attemptId: string | null;
  /** Per competency: scenarios counted, correct, passed. */
  verdicts: { competency: string; total: number; correct: number; passed: boolean; masteryP: number; driveEvidence: number }[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  /** The shared table after this entry's operations: the per-participant snapshot. */
  tableAfter: QTable;
  /**
   * Why this entry ended something: the final exam passed (`certified`), or a
   * competency reached its 3-attempt cap (`cap_reached`). A session the
   * participant left shows as the absence of later entries.
   */
  endReason?: 'certified' | 'cap_reached';
  timestamp: number;
}

export interface CompetencyCourseRepository {
  loadCursor(uid: string): Promise<CourseCursor | null>;
  saveCursor(uid: string, cursor: CourseCursor): Promise<void>;
  /** The shared Q-table; empty until the first participant's first decision. */
  loadQTable(): Promise<QTable>;
  /**
   * Applies the operations to the newest shared table, atomically, and writes
   * one log entry per operation (`policy/competencyQ/updates`) in the same
   * transaction, numbered by the table's own counter. Returns the table after
   * and the entries written.
   */
  applyQLog(input: { items: readonly QLogItem[]; context: QLogContext; envelope: (index: number) => StudyEnvelope }): Promise<{ table: QTable; entries: QLogEntry[] }>;
  appendLog(uid: string, entry: CourseLogEntry): Promise<void>;
}

/** One sitting of a quiz attempt, the diagnostic or the post-exam: its answers as graded logs. */
export interface AssessmentSitting {
  schemaVersion: 1;
  kind: Extract<EvidenceSource, 'quiz' | 'diagnostic' | 'post_exam'>;
  levelId: number | null;
  attempt: number | null;
  answers: ActionLog[];
  /** The post-exam's Rasch ability and its standard error. */
  ability?: { theta: number; se: number };
  timestamp: number;
}

/** `users/{uid}/study/background`: the background form, written once. */
export interface BackgroundFormRepository {
  load(uid: string): Promise<BackgroundResponse | null>;
  save(uid: string, response: BackgroundResponse): Promise<void>;
}

export interface AssessmentRepository {
  /** Every sitting, oldest first. */
  load(uid: string): Promise<AssessmentSitting[]>;
  save(uid: string, sitting: AssessmentSitting): Promise<void>;
}

/**
 * `users/{uid}/events`: the participant's append-only event stream. The store
 * numbers each event (`seq`) from the participant's counter
 * (`users/{uid}/state/events`), in one transaction with the writes.
 */
export interface StudyEventRepository {
  append(uid: string, events: readonly Omit<StudyEvent, 'seq'>[]): Promise<void>;
}

/** `users/{uid}/bkt/profile` and `users/{uid}/bktUpdates`: the participant's own BKT, written together. */
export interface BKTLogRepository {
  loadProfile(uid: string): Promise<BKTProfileDoc | null>;
  record(uid: string, profile: BKTProfileDoc, entries: readonly BKTUpdateRecord[]): Promise<void>;
}

/** ISO/IEC 25010 and TAM answers: one record per participant per instrument. */
export interface SurveyRepository {
  load(uid: string, instrument: SurveyResponse['instrument']): Promise<SurveyResponse | null>;
  save(uid: string, response: SurveyResponse): Promise<void>;
}
