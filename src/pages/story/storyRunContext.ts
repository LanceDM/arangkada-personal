/**
 * The state one pass through story mode carries, shared from `StoryModeLayout`
 * down to the four screens that make up a run.
 *
 * Its own file rather than beside the layout component because a module that
 * exports both a component and a hook trips `react-refresh/only-export-components`.
 */
import { useOutletContext } from 'react-router-dom';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { SupportLevel, WeakArea } from '@/domain/learner/competency';
import type { BankItem } from '@/domain/assessment/questionBank';
import type {
  BriefingGate,
  CourseNote,
  LevelConfig,
  LevelFsmTelemetry,
  LevelRecommendation,
  PracticeChoice,
  RoutingGroupResolution,
  RoutingOverride,
} from '@/features/driving-sim';

/** Which game this Story Mode runs as, and the developers' and admins' override. */
export interface StoryRouting {
  resolution: RoutingGroupResolution;
  /** A developer build or an admin: may choose the group for their own testing. */
  canOverride: boolean;
  override: RoutingOverride;
  setOverride: (override: RoutingOverride) => void;
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
  /** The attempt being briefed, driven or shown is the pilot's post-test. */
  postTest: boolean;
  /** What Continue leads to, once the finished attempt is saved. */
  resultNote: string | null;
  /** The finished attempt is still being saved; Continue waits for it. */
  saving: boolean;
  /** Something went wrong loading or entering the course. */
  error: string | null;
  continueCourse: () => void;
  playFreeReplay: (levelId: number) => void;
  /** Starts the pilot's post-test; null for a guest, whose attempt would not be saved. */
  playPostTest: (() => void) | null;
  /** The per-competency course's briefing gate (module, quiz, review, drive); absent in the old groups. */
  gate?: BriefingGate | null;
  /** The diagnostic pre-test and the post-evaluation exam; absent in the old groups. */
  assessments?: StoryAssessments | null;
}

/** The two exams around the course (2026-10-28). */
export interface StoryAssessments {
  /** The background form: asked only when it is not muted. */
  backgroundRequired: boolean;
  backgroundDone: boolean;
  submitBackground: (answers: Record<string, string>) => Promise<void>;
  diagnosticDone: boolean;
  /** The post-exam opens once the final exam is passed. */
  postExamOpen: boolean;
  postExamDone: boolean;
  diagnosticItems: readonly BankItem[];
  postExamItems: readonly BankItem[];
  submitDiagnostic: (choices: (number | null)[], responseMs?: (number | null)[]) => Promise<void>;
  submitPostExam: (choices: (number | null)[], responseMs?: (number | null)[]) => Promise<void>;
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
  completeRun: (result: LevelResult, telemetry?: LevelFsmTelemetry) => void;
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
