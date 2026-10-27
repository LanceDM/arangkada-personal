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
