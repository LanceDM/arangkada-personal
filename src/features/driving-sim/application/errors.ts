import type { CourseCursor } from '@/domain/competencyRouting/course';

/**
 * A course step was computed from a cursor that is no longer the stored one:
 * another tab or device moved the course on first, or the same step was
 * already saved. Nothing of the step was written. The stored cursor is carried
 * so the caller can refresh to it.
 */
export class CourseConflictError extends Error {
  readonly stored: CourseCursor | null;
  constructor(stored: CourseCursor | null) {
    super('The course moved on before this step was saved.');
    this.name = 'CourseConflictError';
    this.stored = stored;
  }
}

/**
 * This copy of the app is older than the one in force: the settings version in
 * `policy/config`, or the build the site now serves, differs from the one it
 * was built with (a tab left open across an update). Nothing was written; the
 * participant reloads to continue on the current version.
 */
export class OutdatedAppError extends Error {
  readonly running: string;
  readonly current: string;
  constructor(running: string, current: string) {
    super('A newer version of Arangkada is available. Reload the page to continue.');
    this.name = 'OutdatedAppError';
    this.running = running;
    this.current = current;
  }
}
