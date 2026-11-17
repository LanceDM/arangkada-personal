import { FINAL_STAGE, phaseLevel, sameCursor, startingCourse, type CourseCursor } from '@/domain/competencyRouting/course';
import type { CourseProgress } from '@/domain/study/studyStage';

/**
 * What the study flow reads of the per-competency course: whether it has started, the level the next Continue enters, and why
 * it ended. The flow reads no BKT, Q-table or policy, so
 * this is all it gets. The routing cursor's twin is `courseProgressOf`, which
 * the study reads until the game plays this course (port step 5).
 */
export const competencyCourseProgressOf = (cursor: CourseCursor | null): CourseProgress => {
  if (!cursor || sameCursor(cursor, startingCourse())) return { started: false, frontierLevel: 0, endReason: null };
  // Named only once a final has been failed, so a course without one reads as it always did.
  const failures = cursor.finalFailures ? { finalFailures: cursor.finalFailures } : {};
  if (cursor.phase.kind === 'CERTIFIED') return { started: true, frontierLevel: null, endReason: 'certified', ...failures };
  if (cursor.phase.kind === 'FINISHED') {
    const endReason = cursor.phase.reason === 'deadline' ? 'finished_at_deadline' : 'finished_after_finals';
    return { started: true, frontierLevel: null, endReason, ...failures };
  }
  if (cursor.phase.kind === 'FINAL') return { started: true, frontierLevel: FINAL_STAGE, endReason: null, ...failures };
  return { started: true, frontierLevel: phaseLevel(cursor.phase), endReason: null, ...failures };
};
