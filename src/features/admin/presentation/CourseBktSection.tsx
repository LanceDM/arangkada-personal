/**
 * Admin > BKT (course): each participant's BKT per competency, as the
 * course's own BKT update log wrote it after every graded answer, coloured by
 * mastery level, with each competency's evidence and its path over time.
 */
import { Fragment, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { EVIDENCE_BKT_MODEL } from '@/domain/learner/mastery/evidenceBKT';
import { MASTERY_CUTOFFS, MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING } from '@/domain/competencyRouting/mastery';
import type { CourseRecordsState } from '@/features/admin/application/useCourseRecords';
import { EmptyState, Panel, SectionHeader } from './adminUi';
import { CohortLoad, Legend, RecordsNotices } from './courseUi';
import { recordsMeta } from './courseFormat';
import { toDateTime } from './formatDate';

const LEVEL_CELL: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-red-500/15 text-red-700 dark:text-red-300',
  2: 'bg-amber-400/20 text-amber-800 dark:text-amber-200',
  3: 'bg-sky-400/20 text-sky-800 dark:text-sky-200',
  4: 'bg-emerald-400/20 text-emerald-800 dark:text-emerald-200',
};

const short = (competency: string) =>
  getCompetencyLabel(competency)
    .split(' ')
    .map(word => word[0])
    .join('');

const m = EVIDENCE_BKT_MODEL;

export const CourseBktSection = ({ course }: { course: CourseRecordsState }) => {
  const [open, setOpen] = useState<string | null>(null);
  const rows = course.derived?.bkt ?? [];
  return (
    <div className="space-y-6">
      <SectionHeader
        title="BKT (course)"
        description="Each participant's P(L) per competency, as the course's BKT update log wrote it after every graded answer: pre-test, Short Quiz and drive. Nothing is recomputed here."
        meta={recordsMeta(course)}
        actions={<CohortLoad course={course} />}
      />
      <RecordsNotices course={course} />
      {!course.derived ? (
        <EmptyState icon={Gauge} title={course.loading ? 'Reading the records…' : 'The records are not loaded'}>
          Choose a cohort and press Load the records.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={Gauge} title="No BKT evidence yet">
          A participant appears once their pre-test, a Short Quiz or a drive is saved.
        </EmptyState>
      ) : (
        <>
          <Legend
            title="Legend: BKT"
            items={[
              { term: <span className={`rounded px-1.5 ${LEVEL_CELL[1]}`}>0.42</span>, meaning: `Level 1: P(L) below ${MASTERY_CUTOFFS.developing.toFixed(2)}.` },
              { term: <span className={`rounded px-1.5 ${LEVEL_CELL[2]}`}>0.66</span>, meaning: `Level 2: ${MASTERY_CUTOFFS.developing.toFixed(2)}–0.79.` },
              { term: <span className={`rounded px-1.5 ${LEVEL_CELL[3]}`}>0.88</span>, meaning: `Level 3: ${MASTERY_CUTOFFS.connecting.toFixed(2)}–0.94.` },
              {
                term: <span className={`rounded px-1.5 ${LEVEL_CELL[4]}`}>0.97</span>,
                meaning: `Level 4: ${MASTERY_CUTOFFS.benchmarking.toFixed(2)}+ with at least ${MIN_DRIVE_EVIDENCE_FOR_BENCHMARKING} drive answers.`,
              },
              { term: 'P(L)', meaning: 'The chance the participant knows the competency, after every graded answer so far.' },
              { term: 'Columns', meaning: COMPETENCIES.map(c => `${short(c)} ${getCompetencyLabel(c)}`).join(' · ') },
              {
                term: 'Model',
                meaning: `Prior ${m.pInit}. Pre-test T ${m.pre_test.pTransit}, S ${m.pre_test.pSlip}, G ${m.pre_test.pGuess}; quiz T ${m.quiz.pTransit}, S ${m.quiz.pSlip}, G ${m.quiz.pGuess}; drive T ${m.drive.pTransit}, S ${m.drive.pSlip}, G ${m.drive.pGuess}.`,
              },
              { term: 'Path', meaning: 'Click a participant: each competency\'s P(L) after each of its answers, oldest first.' },
            ]}
          />
          <Panel title="BKT per participant" description="P(L) per competency now; the colour is its mastery level." bodyClassName="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Answers</TableHead>
                    <TableHead>Last answer</TableHead>
                    {COMPETENCIES.map(c => (
                      <TableHead key={c} title={getCompetencyLabel(c)} className="text-center">
                        {short(c)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <Fragment key={row.uid}>
                      <TableRow className="cursor-pointer" onClick={() => setOpen(open === row.uid ? null : row.uid)}>
                        <TableCell className="font-mono text-xs">{row.label}</TableCell>
                        <TableCell className="text-xs">{row.answers}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.lastAt)}</TableCell>
                        {COMPETENCIES.map(c => (
                          <TableCell
                            key={c}
                            className={`text-center font-mono text-xs ${LEVEL_CELL[row.competencies[c].level]}`}
                            title={`${getCompetencyLabel(c)}: Level ${row.competencies[c].level}`}
                          >
                            {row.competencies[c].p.toFixed(2)}
                          </TableCell>
                        ))}
                      </TableRow>
                      {open === row.uid && (
                        <TableRow>
                          <TableCell colSpan={COMPETENCIES.length + 3} className="bg-muted/30">
                            <div className="space-y-1 text-xs">
                              {COMPETENCIES.map(c => {
                                const e = row.competencies[c];
                                const total = e.answers.pre_test + e.answers.quiz + e.answers.drive;
                                return (
                                  <p key={c}>
                                    <span className="font-semibold">{getCompetencyLabel(c)}</span>: P {e.p.toFixed(3)}, Level {e.level}
                                    {e.startP !== null ? ` · after the pre-test ${e.startP.toFixed(2)}` : ''} · {total} answers ({e.answers.pre_test} pre-test,{' '}
                                    {e.answers.quiz} quiz, {e.answers.drive} drive), {e.correct} right
                                    {e.trajectory.length > 0 && (
                                      <span className="font-mono text-muted-foreground"> · {e.trajectory.map(p => p.toFixed(2)).join(' → ')}</span>
                                    )}
                                  </p>
                                );
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
};
