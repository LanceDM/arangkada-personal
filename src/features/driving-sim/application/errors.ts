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
