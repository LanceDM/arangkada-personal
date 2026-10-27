/** The bound implementation of Mock Exam's port. Provided by `app/dependencies`. */
import type { ExamRepository } from './ports';

export interface MockExamDependencies {
  exam: ExamRepository;
}

let bound: MockExamDependencies | null = null;

export const provideMockExamDependencies = (dependencies: MockExamDependencies) => {
  bound = dependencies;
};

export const mockExamDeps = (): MockExamDependencies => {
  if (!bound) {
    throw new Error('Mock Exam dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
