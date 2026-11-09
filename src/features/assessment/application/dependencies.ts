/** The bound implementations of the test's ports. Provided by `app/dependencies`. */
import type { TestDesignRepository, TestDraftRepository, TestItemRepository, TestSittingRepository } from './ports';

export interface AssessmentDependencies {
  items: TestItemRepository;
  designs: TestDesignRepository;
  sittings: TestSittingRepository;
  drafts: TestDraftRepository;
}

let bound: AssessmentDependencies | null = null;

export const provideAssessmentDependencies = (dependencies: AssessmentDependencies) => {
  bound = dependencies;
};

export const assessmentDeps = (): AssessmentDependencies => {
  if (!bound) {
    throw new Error('Assessment dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
