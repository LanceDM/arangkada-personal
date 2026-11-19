/**
 * The state one pass through story mode carries, shared from `StoryModeLayout`
 * down to the four screens that make up a run.
 *
 * Its own file rather than beside the layout component because a module that
 * exports both a component and a hook trips `react-refresh/only-export-components`.
 */
import type { Localized } from '@/shared/lib/localized';
import { useOutletContext } from 'react-router-dom';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { SupportLevel, WeakArea } from '@/domain/learner/competency';
import type {
  BriefingGate,
  CourseNote,
  DriveExit,
  LevelConfig,
  LevelFsmTelemetry,
  PlayConditions,
  LevelRecommendation,
  PracticeChoice,
  RoutingGroupResolution,
} from '@/features/driving-sim';

/**
 * Which game this Story Mode runs as. Admin test mode, which may change it,
 * is set in the admin area.
 */
export interface StoryRouting {
  resolution: RoutingGroupResolution;
  /** Every level open as a free replay: a developer build or an admin, never a study participant. */
  openAll: boolean;
  /**
   * A study participant: the course and nothing else, no
   * free replay, and the study's home in place of the map's menu.
   */
  participant: boolean;
}

/** A New group's course: the routing FSM decides each course entry. */
export interface StoryCourse {
  /** The level Continue plays next; null once certified or while loading. */
  frontierLevelId: number | null;
  certified: boolean;
  loading: boolean;
  /** Every level open as a free replay: developers and admins. */
  openAll: boolean;
  /** Why the entry being briefed is the one it is; null for a free replay. */
  note: CourseNote | null;
  /** What Continue leads to, once the finished attempt is saved. */
  resultNote: Localized | null;
  /** The finished attempt is still being saved; Continue waits for it. */
  saving: boolean;
  /** Something went wrong loading or entering the course. */
  error: Localized | null;
  continueCourse: () => void;
  playFreeReplay: (levelId: number) => void;
  /** The per-competency course's briefing gate (module, quiz, review, drive); absent in the old groups. */
  gate?: BriefingGate | null;
  /** Where the study's two tests stand; absent in the old groups. */
  assessments?: StoryAssessments | null;
}

/**
 * The study's two tests around the course (2026-11-10): the 60-item pre-test,
 * which opens the course and seeds each competency's BKT, and the 30-item
 * post-test, which opens once the final exam is passed. Both are sat on their
 * own pages (/play/pre-test, /play/post-test); the map only shows where they stand.
 */
export interface StoryAssessments {
  diagnosticDone: boolean;
  postExamOpen: boolean;
  postExamDone: boolean;
}

export interface StoryRunContext {
  /** The level named by the URL, already validated against the catalogue. */
  activeLevel: number | null;
  /**
   * The rolled config for this attempt. Built once and held stable across
   * briefing → drive → complete, so a pooled level keeps one roll for all three.
   */
  levelConfig: LevelConfig | null;
  weakArea: WeakArea | null;
  /** The scenario the adaptive layer chose to inject, and the FSM θ it picked. */
  practice: PracticeChoice | null;
  /** How much of the answer every scenario in this attempt shows. */
  support: SupportLevel;
  /** This attempt's seed, once its plan has settled. */
  attemptSeed: number | null;
  /** The graded history the plan read, oldest first; the drive's live estimate reads it too. */
  priorLogs: readonly ActionLog[];
  /**
   * Whether the asynchronous adaptive decision has resolved *for the level the
   * URL currently names*. The drive must not mount until this is true: the
   * decision feeds `levelConfig`, and a config that changes under a running
   * simulation swaps the events array mid-drive.
   */
  decisionSettled: boolean;
  levelResult: LevelResult | null;
  recommendation: LevelRecommendation | null;
  showSaveModal: boolean;
  dismissSaveModal: () => void;
  /** The level whose drive has been legitimately entered from its briefing. */
  startedRun: number | null;
  /** Identifies this attempt; changes on retry so a pooled level re-rolls. */
  rollNonce: number;
  totalScore: number;
  completedLevels: number;
  /** The level after the one the URL names, or null at the end of the ladder. */
  nextLevelId: number | null;

  /** Called by the briefing when the player commits to driving. */
  beginDrive: (levelId: number) => void;
  /**
   * Called by the drive when the run ends. Telemetry is a separate argument
   * rather than a field on the result: the raw transition log is large and must
   * reach persistence without passing through React state or the progress store.
   */
  completeRun: (result: LevelResult, telemetry?: LevelFsmTelemetry, play?: PlayConditions) => void;
  /** The drive was left before its end (Exit): logs what was done so far. Absent where nothing is logged. */
  exitRun?: (partial?: DriveExit) => void;
  /** The page is closing mid-drive: the same, best effort. */
  abandonRun?: (partial: DriveExit) => void;
  /**
   * Discards the finished attempt so a fresh one can be rolled. Retry, Next and
   * the practice suggestion all mean "that attempt is over, plan another one".
   */
  restartAttempt: () => void;

  routing: StoryRouting;
  /** Null in Legacy, today's game. */
  course: StoryCourse | null;
  /** Whether the drive re-rolls toward a weak competency: Legacy's game only. */
  liveReroll: boolean;
}

export const useStoryRun = () => useOutletContext<StoryRunContext>();
