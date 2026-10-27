/** The bound implementation of Progression's port. Provided by `app/dependencies`. */
import type { ProgressRepository } from './ports';

export interface ProgressionDependencies {
  progress: ProgressRepository;
}

let bound: ProgressionDependencies | null = null;

export const provideProgressionDependencies = (dependencies: ProgressionDependencies) => {
  bound = dependencies;
};

export const progressionDeps = (): ProgressionDependencies => {
  if (!bound) {
    throw new Error('Progression dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
