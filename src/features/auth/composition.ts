/**
 * Auth's wiring, for the composition root alone.
 *
 * Kept out of `index.ts` on purpose: ordinary consumers get screens and actions,
 * and only `app/dependencies` may reach the Firebase adapters behind them.
 */
import { provideAuthDependencies } from './application/dependencies';
import { firebaseAuthGateway } from './infrastructure/FirebaseAuthRepository';
import { firebaseUserProfileRepository } from './infrastructure/FirebaseUserRepository';

export const composeAuth = () =>
  provideAuthDependencies({
    auth: firebaseAuthGateway,
    userProfiles: firebaseUserProfileRepository,
  });
