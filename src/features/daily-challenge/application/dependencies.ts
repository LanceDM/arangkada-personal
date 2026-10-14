/** The bound implementations of Daily Challenge's ports. Provided by `app/dependencies`. */
import type { DailyLocalRepository, DailyRemoteRepository } from './ports';

export interface DailyDependencies {
  remote: DailyRemoteRepository;
  local: DailyLocalRepository;
}

let bound: DailyDependencies | null = null;

export const provideDailyDependencies = (dependencies: DailyDependencies) => {
  bound = dependencies;
};

export const dailyDeps = (): DailyDependencies => {
  if (!bound) {
    throw new Error('Daily Challenge dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
