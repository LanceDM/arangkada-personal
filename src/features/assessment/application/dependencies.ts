/** The bound implementations of the test's ports. Provided by `app/dependencies`. */
import type { TestSitting } from '@/domain/assessment/testResponse';
import type { TestDesignRepository, TestDraftRepository, TestItemRepository, TestSittingRepository } from './ports';

export interface AssessmentDependencies {
  items: TestItemRepository;
  designs: TestDesignRepository;
  sittings: TestSittingRepository;
  drafts: TestDraftRepository;
  /**
   * A sitting has just been saved: the course reads it (the pre-test seeds each
   * competency's BKT, the post-test is the course's last measurement). Bound by
   * the composition root; best effort, retried, never blocks the test's own save.
   */
  onFinished?: (uid: string, sitting: TestSitting) => Promise<void>;
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
