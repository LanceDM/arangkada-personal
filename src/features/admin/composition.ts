/** Admin's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAdminDependencies } from './application/dependencies';
import { firebaseIrtRepository } from './infrastructure/FirebaseIrtRepository';
import { firebaseAdminReportRepository } from './infrastructure/FirebaseAdminRepository';
import { firebasePilotPoolRepository } from './infrastructure/FirebasePilotPoolRepository';
import { firebaseStudyInvitesRepository } from './infrastructure/FirebaseStudyInvitesRepository';
import { firebasePilotRecordsRepository } from './infrastructure/FirebasePilotRecordsRepository';
import { firebaseQuizEditorRepository } from './infrastructure/FirebaseQuizEditorRepository';
import { firebaseLiveQTable, firebaseStudyLogs, firebaseStudyRecords } from './infrastructure/FirebaseStudyRecords';
import { sqlBackgrounds, sqlStudyRecords } from './infrastructure/SqlConnectStudyRecords';
import { firebaseSiteStatus } from './infrastructure/FirebaseSiteStatus';

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
    site: firebaseSiteStatus,
  });

