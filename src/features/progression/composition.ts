/** Progression's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideProgressionDependencies } from './application/dependencies';
import { firebaseProgressRepository } from './infrastructure/FirebaseProgressRepository';

export const composeProgression = () =>
  provideProgressionDependencies({ progress: firebaseProgressRepository });
