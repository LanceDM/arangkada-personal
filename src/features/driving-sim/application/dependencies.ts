/**
 * The bound implementations of Driving Sim's ports.
 *
 * `app/dependencies` calls `provideDrivingSimDependencies` once at startup.
 * Everything inside the feature reads them through `drivingSimDeps()`, so no
 * application or domain module names Firestore, localStorage, or another
 * feature's store.
 */
import type { OptimizedRouting } from '@/features/driving-sim/domain/adaptive/courseRouting';
import type { RoutingMode } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import type {
  AssessmentRepository,
  BackgroundFormRepository,
  BKTLogRepository,
  StudyEventRepository,
  BriefingProgressRepository,
  CompetencyCourseRepository,
  LearnerHistoryRepository,
  RoutingOverrideRepository,
  RoutingRepository,
  SignCoverageRepository,
  StoryAttemptRepository,
} from './ports';

export interface DrivingSimDependencies {
  learnerHistory: LearnerHistoryRepository;
  storyAttempts: StoryAttemptRepository;
  signCoverage: SignCoverageRepository;
  briefingProgress: BriefingProgressRepository;
  /**
   * The Legacy / New switch: today's game, or the
   * routing FSM with the pilot's two groups.
   */
  routingMode: RoutingMode;
  routing: RoutingRepository;
  routingOverride: RoutingOverrideRepository;
  /** The designated routing table, loaded on first use by the Optimized group. */
  optimizedRouting: () => Promise<OptimizedRouting>;
  /** The per-competency routing FSM's cursor, shared Q-table and log (2026-10-28). */
  competencyCourse: CompetencyCourseRepository;
  /** Quiz, diagnostic and post-exam answers. */
  assessments: AssessmentRepository;
  /** The background form's answers. */
  background: BackgroundFormRepository;
  /** Overrides BACKGROUND_FORM_ENABLED (muted by default). */
  backgroundFormEnabled?: boolean;
  /** The participant's event stream. */
  studyEvents: StudyEventRepository;
  /** The participant's own BKT profile and its update log. */
  bktLog: BKTLogRepository;
  /** The commit the app was built from, stamped on every logged record. */
  appBuild?: string;
}

let bound: DrivingSimDependencies | null = null;

export const provideDrivingSimDependencies = (dependencies: DrivingSimDependencies) => {
  bound = dependencies;
};

export const drivingSimDeps = (): DrivingSimDependencies => {
  if (!bound) {
    throw new Error(
      'Driving Sim dependencies were not provided. app/dependencies must run before any drive.'
    );
  }
  return bound;
};
