/** Admin's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAdminDependencies } from './application/dependencies';
import { designatedRoutingPolicyOf, type DesignatedRoutingPolicy } from './domain/designatedRoutingPolicy';
import { firebaseIrtRepository } from './infrastructure/FirebaseIrtRepository';
import { firebaseAdminReportRepository } from './infrastructure/FirebaseAdminRepository';
import { firebasePilotPoolRepository } from './infrastructure/FirebasePilotPoolRepository';
import { firebaseStudyInvitesRepository } from './infrastructure/FirebaseStudyInvitesRepository';
import { firebasePilotRecordsRepository } from './infrastructure/FirebasePilotRecordsRepository';
import { firebaseQuizEditorRepository } from './infrastructure/FirebaseQuizEditorRepository';

export const composeAdmin = () =>
  provideAdminDependencies({
    report: firebaseAdminReportRepository,
    pilotPool: firebasePilotPoolRepository,
    invites: firebaseStudyInvitesRepository,
    pilotRecords: firebasePilotRecordsRepository,
    quizEditor: firebaseQuizEditorRepository,
    irt: firebaseIrtRepository,
  });

/**
 * The designated routing table, read from its table file. The file
 * is loaded on first use, in a chunk of its own, so only an Optimized entry
 * downloads it; the composition root hands this loader to Driving Sim.
 */
export const loadDesignatedRoutingPolicy = async (): Promise<DesignatedRoutingPolicy> =>
  designatedRoutingPolicyOf((await import('./domain/designatedRoutingTable.json')).default);
