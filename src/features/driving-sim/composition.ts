/**
 * Driving Sim's wiring, for the composition root alone. Kept out of `index.ts`.
 *
 * `learnerHistory` is the one seam the root needs for history: a guest has no
 * Firestore attempts, and where those come from instead is Progression's
 * business, not this feature's. `routing` is the Legacy / New switch and the
 * table the Optimized group reads, which the root takes from admin's results
 * file.
 */
import { provideDrivingSimDependencies } from './application/dependencies';
import type { LearnerHistoryRepository } from './application/ports';
import type { OptimizedRouting } from './domain/adaptive/courseRouting';
import type { RoutingMode } from './domain/telemetry/routingTelemetry';
import { firebaseLearnerHistoryRepository } from './infrastructure/FirebaseLearnerHistoryRepository';
import { firebaseRoutingRepository } from './infrastructure/FirebaseRoutingRepository';
import { firebaseStoryAttemptRepository } from './infrastructure/FirebaseStoryAttemptRepository';
import { localRoutingOverrideRepository } from './infrastructure/LocalRoutingOverrideRepository';
import { localSignCoverageRepository } from './infrastructure/LocalSignCoverageRepository';
import { localBriefingProgressRepository } from './infrastructure/LocalBriefingProgressRepository';
import {
  firebaseAssessmentRepository,
  firebaseBackgroundFormRepository,
  firebaseCompetencyCourseRepository,
} from './infrastructure/FirebaseCompetencyCourseRepository';
import {
  firebaseBKTLogRepository,
  firebaseStudyEventRepository,
} from './infrastructure/FirebaseStudyLogRepositories';
import { sqlBackgroundFormRepository } from './infrastructure/SqlConnectStudyRecords';
import type { DatabaseMode } from '@/shared/infrastructure/firebase/dataConnect';

export type { LearnerHistoryRepository, OptimizedRouting, RoutingMode };

export type { DatabaseMode };

interface DrivingSimComposition {
  /**
   * Implementation A (`firestore`): every record in Firestore. Implementation
   * B (`firestore+sql`): the background form in SQL
   * Connect; the logs, the Q-table and BKT stay in Firestore either way.
   */
  databaseMode?: DatabaseMode;
  /** The commit the build came from, stamped on every logged record. */
  appBuild?: string;
  learnerHistory?: (signedIn: LearnerHistoryRepository) => LearnerHistoryRepository;
  routing: {
    mode: RoutingMode;
    optimized: () => Promise<OptimizedRouting>;
  };
}

/**
 * The build the site serves now: `version.json`, written next to the app by
 * the build (vite.config.ts). Fetched past every cache, so a tab opened before
 * a deploy learns that a newer build is out. Null when it cannot be read.
 */
const fetchLatestBuild = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { build?: unknown };
    return typeof body.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
};

export const composeDrivingSim = ({ learnerHistory, routing, databaseMode = 'firestore', appBuild }: DrivingSimComposition) =>
  provideDrivingSimDependencies({
    learnerHistory: learnerHistory
      ? learnerHistory(firebaseLearnerHistoryRepository)
      : firebaseLearnerHistoryRepository,
    storyAttempts: firebaseStoryAttemptRepository,
    signCoverage: localSignCoverageRepository,
    briefingProgress: localBriefingProgressRepository,
    routingMode: routing.mode,
    routing: firebaseRoutingRepository,
    routingOverride: localRoutingOverrideRepository,
    optimizedRouting: routing.optimized,
    competencyCourse: firebaseCompetencyCourseRepository,
    assessments: firebaseAssessmentRepository,
    background: databaseMode === 'firestore+sql' ? sqlBackgroundFormRepository : firebaseBackgroundFormRepository,
    studyEvents: firebaseStudyEventRepository,
    bktLog: firebaseBKTLogRepository,
    appBuild,
    latestBuild: fetchLatestBuild,
  });
