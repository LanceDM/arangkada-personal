/** The study's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideStudyDependencies } from './application/dependencies';
import type { StudyAccountsGateway, StudySources } from './application/ports';
import { firebaseStudyRecordsRepository } from './infrastructure/FirebaseStudyRecordsRepository';
import { firebaseStudyRegistryRepository } from './infrastructure/FirebaseStudyRegistryRepository';

/**
 * `accounts` is Auth's and `sources` Driving Sim's and Assessment's, handed
 * in by `app/dependencies`: the study imports no other feature.
 */
export const composeStudy = ({ accounts, sources }: { accounts: StudyAccountsGateway; sources: StudySources }) =>
  provideStudyDependencies({
    registry: firebaseStudyRegistryRepository,
    records: firebaseStudyRecordsRepository,
    accounts,
    sources,
  });

export type { StudyAccountsGateway, StudySources };
