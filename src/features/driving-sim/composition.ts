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

export type { LearnerHistoryRepository, OptimizedRouting, RoutingMode };

interface DrivingSimComposition {
  learnerHistory?: (signedIn: LearnerHistoryRepository) => LearnerHistoryRepository;
  routing: {
    mode: RoutingMode;
    optimized: () => Promise<OptimizedRouting>;
  };
}

export const composeDrivingSim = ({ learnerHistory, routing }: DrivingSimComposition) =>
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
  });
