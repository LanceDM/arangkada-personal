/** The course views' formatting: cohort names, numbers and the line saying what was read. */
import type { RewardRecord } from '@/domain/competencyRouting/course';
import type { StudyCohort } from '@/domain/study/participantCode';
import { isTerminal } from '@/features/admin/domain/courseAdmin';
import type { CourseRecordsState } from '@/features/admin/application/useCourseRecords';
import { toDateTime } from './formatDate';

export const COHORT_LABEL: Record<StudyCohort, string> = { study: 'Study (P-)', dryrun: 'Dry run (D-)', test: 'Test (T-)' };

export const fmt = (value: unknown, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');

/**
 * One reward as the course logged it (Option 2): a step names only its cost,
 * a terminal reward its outcome, its cost and where it was measured.
 */
export const rewardDetail = (reward: RewardRecord) =>
  isTerminal(reward)
    ? `${reward.reward.toFixed(3)} (terminal: A ${reward.accuracy.toFixed(2)}, H ${reward.addedDecisions}; ${reward.measuredBy})`
    : `${reward.reward.toFixed(3)} (step: H ${reward.addedDecisions}; ${reward.measuredBy})`;

/** One line under the header: what was read, and when. */
export const recordsMeta = (course: CourseRecordsState) =>
  course.data
    ? `${COHORT_LABEL[course.data.cohort]}: read ${toDateTime(course.data.loadedAt)}; ${course.data.codes.size} participant(s), ${course.data.courseLogs.length} course-log entr${course.data.courseLogs.length === 1 ? 'y' : 'ies'}, ${course.data.bktUpdates.length} BKT update(s)`
    : 'Records not loaded: choose a cohort and press Load the records.';

