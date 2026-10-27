/**
 * The bound implementations of Auth's ports.
 *
 * `app/dependencies` calls `provideAuthDependencies` once at startup, through
 * this feature's `composition.ts`. Everything else reads them here.
 */
import type { AuthGateway, UserProfileRepository } from './ports';

export interface AuthDependencies {
  auth: AuthGateway;
  userProfiles: UserProfileRepository;
}

let bound: AuthDependencies | null = null;

export const provideAuthDependencies = (dependencies: AuthDependencies) => {
  bound = dependencies;
};

export const authDeps = (): AuthDependencies => {
  if (!bound) {
    throw new Error('Auth dependencies were not provided. app/dependencies must run first.');
  }
  return bound;
};
