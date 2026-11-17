/**
 * What the three course views share: the cohort picker with its Load button,
 * the notices about what was read, and a legend panel. Built from adminUi.
 */
import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { STUDY_COHORTS, type StudyCohort } from '@/domain/study/participantCode';
import type { CourseRecordsState } from '@/features/admin/application/useCourseRecords';
import { Notice, Panel } from './adminUi';
import { COHORT_LABEL } from './courseFormat';

export const Legend = ({ title, items }: { title: string; items: ReadonlyArray<{ term: ReactNode; meaning: string }> }) => (
  <Panel title={title}>
    <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={i}>
          <dt className="font-semibold text-foreground">{item.term}</dt>
          <dd className="text-muted-foreground">{item.meaning}</dd>
        </div>
      ))}
    </dl>
  </Panel>
);

/** The cohort picker and Load button, for a SectionHeader's actions. */
export const CohortLoad = ({ course }: { course: CourseRecordsState }) => {
  const shown = course.data?.cohort;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Cohort
        <select
          aria-label="Cohort"
          value={course.cohort}
          onChange={event => course.setCohort(event.target.value as StudyCohort)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          {STUDY_COHORTS.map(c => (
            <option key={c} value={c}>
              {COHORT_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" aria-label="Load the records" onClick={() => course.load(course.cohort)} disabled={course.loading}>
        <Download className="mr-2 h-4 w-4" />
        {course.loading ? 'Reading…' : shown === course.cohort ? 'Reload' : 'Load the records'}
      </Button>
    </div>
  );
};

export const RecordsNotices = ({ course }: { course: CourseRecordsState }) => (
  <>
    {course.error && <Notice tone="error">{course.error}</Notice>}
    {course.data && course.data.cohort !== course.cohort && (
      <Notice>
        Showing {COHORT_LABEL[course.data.cohort]}. Press Load the records to read {COHORT_LABEL[course.cohort]}.
      </Notice>
    )}
    {course.data && course.data.unread > 0 && <Notice>{course.data.unread} course-log document(s) left out: not a course record.</Notice>}
  </>
);
