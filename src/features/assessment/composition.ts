/** The test's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideAssessmentDependencies, type AssessmentDependencies } from './application/dependencies';
import {
  firebaseTestDesignRepository,
  firebaseTestDraftRepository,
  firebaseTestItemRepository,
  firebaseTestSittingRepository,
} from './infrastructure/FirebaseTestRepositories';

export const composeAssessment = ({ onFinished }: Pick<AssessmentDependencies, 'onFinished'> = {}) =>
  provideAssessmentDependencies({
    items: firebaseTestItemRepository,
    designs: firebaseTestDesignRepository,
    sittings: firebaseTestSittingRepository,
    drafts: firebaseTestDraftRepository,
    onFinished,
  });
