/** Admin's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAdminDependencies } from './application/dependencies';
import { firebaseAdminReportRepository } from './infrastructure/FirebaseAdminRepository';

export const composeAdmin = () =>
  provideAdminDependencies({ report: firebaseAdminReportRepository });
