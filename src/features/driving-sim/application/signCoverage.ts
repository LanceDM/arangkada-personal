/** Sign coverage, through the port rather than localStorage directly. */
import { drivingSimDeps } from './dependencies';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';

export const loadSignCoverage = (): SignCoverage => drivingSimDeps().signCoverage.load();

export const recordSignOutcome = (plateName: string, isCorrect: boolean): void =>
  drivingSimDeps().signCoverage.record(plateName, isCorrect);
