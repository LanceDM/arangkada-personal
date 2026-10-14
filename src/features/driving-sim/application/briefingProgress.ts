/** Briefing/lesson progress, through the port rather than localStorage directly. */
import { drivingSimDeps } from './dependencies';
import type { BriefingProgress } from './ports';

export type { BriefingProgress };

export const loadBriefingProgress = (moduleId: string): Partial<BriefingProgress> =>
  drivingSimDeps().briefingProgress.load(moduleId);

export const saveBriefingProgress = (moduleId: string, progress: BriefingProgress): void =>
  drivingSimDeps().briefingProgress.save(moduleId, progress);

/**
 * What the standalone `/learn/:levelId` route calls: it knows the reader
 * finished and nothing about the quiz, and the record is shared with the
 * briefing's own reader so a module read in either place counts once.
 */
export const markLessonsRead = (moduleId: string): void =>
  drivingSimDeps().briefingProgress.markLessonsRead(moduleId);
