/** The bound implementation of Admin's port. Provided by `app/dependencies`. */
import type { AdminReportRepository } from './ports';

export interface AdminDependencies {
  report: AdminReportRepository;
}

let bound: AdminDependencies | null = null;

export const provideAdminDependencies = (dependencies: AdminDependencies) => {
  bound = dependencies;
};

export const adminDeps = (): AdminDependencies => {
  if (!bound) {
    throw new Error('Admin dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
