/** Daily Challenge's wiring, for the composition root alone. Kept out of `index.ts`. */
import { provideDailyDependencies } from './application/dependencies';
import { firebaseDailyRepository } from './infrastructure/FirebaseDailyRepository';
import { localDailyRepository } from './infrastructure/LocalDailyRepository';

export const composeDailyChallenge = () =>
  provideDailyDependencies({ remote: firebaseDailyRepository, local: localDailyRepository });
