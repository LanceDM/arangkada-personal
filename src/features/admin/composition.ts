/** Admin's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAdminDependencies } from './application/dependencies';
import { designatedRoutingPolicyOf, type DesignatedRoutingPolicy } from './domain/designatedRoutingPolicy';
import { firebaseIrtRepository } from './infrastructure/FirebaseIrtRepository';
import { firebaseAdminReportRepository } from './infrastructure/FirebaseAdminRepository';
import { firebasePilotPoolRepository } from './infrastructure/FirebasePilotPoolRepository';
import { firebaseStudyInvitesRepository } from './infrastructure/FirebaseStudyInvitesRepository';
import { firebasePilotRecordsRepository } from './infrastructure/FirebasePilotRecordsRepository';
import { firebaseQuizEditorRepository } from './infrastructure/FirebaseQuizEditorRepository';
import { firebaseLiveQTable, firebaseStudyLogs, firebaseStudyRecords } from './infrastructure/FirebaseStudyRecords';
import { sqlBackgrounds, sqlStudyRecords } from './infrastructure/SqlConnectStudyRecords';

/** `firestore` (Implementation A) or `firestore+sql` (Implementation B): where the people, roles and settings records live. */
export const composeAdmin = ({ databaseMode = 'firestore' }: { databaseMode?: 'firestore' | 'firestore+sql' } = {}) =>
  provideAdminDependencies({
    // In B the background form's answers are SQL rows; everything else the report reads is Firestore.
    report: databaseMode === 'firestore+sql' ? { ...firebaseAdminReportRepository, backgrounds: sqlBackgrounds } : firebaseAdminReportRepository,
    pilotPool: firebasePilotPoolRepository,
    invites: firebaseStudyInvitesRepository,
    pilotRecords: firebasePilotRecordsRepository,
    quizEditor: firebaseQuizEditorRepository,
    irt: firebaseIrtRepository,
    records: databaseMode === 'firestore+sql' ? sqlStudyRecords : firebaseStudyRecords,
    live: firebaseLiveQTable,
    logs: firebaseStudyLogs,
  });

/**
 * The designated routing table (trained in simulation, seed 11), kept only so
 * the admin's legacy routing views can still show it. The study's course does
 * not read it: its Q-table is learned online from participants.
 */
export const loadDesignatedRoutingPolicy = async (): Promise<DesignatedRoutingPolicy> =>
  designatedRoutingPolicyOf((await import('./domain/designatedRoutingTable.json')).default);
