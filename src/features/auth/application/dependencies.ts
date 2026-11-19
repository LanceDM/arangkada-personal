/**
 * The bound implementations of Auth's ports.
 *
 * `app/dependencies` calls `provideAuthDependencies` once at startup, through
 * this feature's `composition.ts`. Everything else reads them here.
 */
import type { AuthGateway, DeviceLanguageRepository, DeviceVehicleSkinRepository, UserProfileRepository } from './ports';

export interface AuthDependencies {
  auth: AuthGateway;
  userProfiles: UserProfileRepository;
  deviceLanguage: DeviceLanguageRepository;
  /** Optional so a test may leave it out: the skin then lasts only for the page. */
  deviceVehicleSkin?: DeviceVehicleSkinRepository;
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
