/** Admin's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAdminDependencies } from './application/dependencies';
import { firebaseAdminReportRepository } from './infrastructure/FirebaseAdminRepository';
import { firebaseLiveQTable, firebaseStudyLogs, firebaseStudyRecords } from './infrastructure/FirebaseStudyRecords';
import { sqlBackgrounds, sqlStudyRecords } from './infrastructure/SqlConnectStudyRecords';

/** `firestore` (Implementation A) or `firestore+sql` (Implementation B): where the people, roles and settings records live. */
export const composeAdmin = ({ databaseMode = 'firestore' }: { databaseMode?: 'firestore' | 'firestore+sql' } = {}) =>
  provideAdminDependencies({
    // In B the background form's answers are SQL rows; everything else the report reads is Firestore.
    report: databaseMode === 'firestore+sql' ? { ...firebaseAdminReportRepository, backgrounds: sqlBackgrounds } : firebaseAdminReportRepository,
    records: databaseMode === 'firestore+sql' ? sqlStudyRecords : firebaseStudyRecords,
    live: firebaseLiveQTable,
    logs: firebaseStudyLogs,
  });
