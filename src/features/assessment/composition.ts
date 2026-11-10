/** The test's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAssessmentDependencies } from './application/dependencies';
import {
  firebaseTestDesignRepository,
  firebaseTestDraftRepository,
  firebaseTestItemRepository,
  firebaseTestSittingRepository,
} from './infrastructure/FirebaseTestRepositories';

export const composeAssessment = () =>
  provideAssessmentDependencies({
    items: firebaseTestItemRepository,
    designs: firebaseTestDesignRepository,
    sittings: firebaseTestSittingRepository,
    drafts: firebaseTestDraftRepository,
  });
