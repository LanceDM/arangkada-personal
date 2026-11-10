/**
 * Admin > BKT & export: each player's BKT per competency now (the replay of
 * their own pre-test, quiz and drive answers with the course's model), and
 * the study export. Every figure is from real players: nothing is simulated.
 */
import { Fragment, useState } from 'react';
import { Download, Gauge, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { STUDY_EXPORTS, useStudyExport } from '@/features/admin/application/useStudyExport';
import { useCourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { MASTERY_DESCRIPTORS } from '@/features/admin/domain/courseAdmin';
import { EmptyState, Notice, Panel, SectionHeader } from './adminUi';

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

const BktTable = ({ course }: { course: ReturnType<typeof useCourseAdmin> }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (course.mastery.length === 0) {
    return <EmptyState icon={Gauge} title="No BKT evidence yet">A player appears once their pre-test, a short quiz or a drive is saved.</EmptyState>;
  }
  return (
    <Panel
      title="BKT per player"
      description={`P(L) per competency now; the colour is its mastery level (${Object.values(MASTERY_DESCRIPTORS).join(', ')}). Click a player for each competency's evidence. Model (Tentative, to be fitted on the pilot): prior ${DEFAULT_BKT_MODEL.pInit}; pre-test and post-test T 0, S ${DEFAULT_BKT_MODEL.diagnostic.pSlip}, G ${DEFAULT_BKT_MODEL.diagnostic.pGuess}; quiz T ${DEFAULT_BKT_MODEL.quiz.pTransit}, S ${DEFAULT_BKT_MODEL.quiz.pSlip}, G ${DEFAULT_BKT_MODEL.quiz.pGuess}; drive T ${DEFAULT_BKT_MODEL.drive.pTransit}, S ${DEFAULT_BKT_MODEL.drive.pSlip}, G ${DEFAULT_BKT_MODEL.drive.pGuess}.`}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Answers</TableHead>
              {COMPETENCIES.map(c => (
                <TableHead key={c} title={getCompetencyLabel(c)} className="text-center">
                  {short(c)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {course.mastery.map(row => (
              <Fragment key={row.uid}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === row.uid ? null : row.uid)}>
                  <TableCell className="font-mono text-xs">{row.label}</TableCell>
                  <TableCell className="text-xs">{row.answers}</TableCell>
                  {COMPETENCIES.map(c => (
                    <TableCell key={c} className={`text-center font-mono text-xs ${LEVEL_CELL[row.level[c]]}`} title={`${getCompetencyLabel(c)}: ${MASTERY_DESCRIPTORS[row.level[c]]}`}>
                      {row.mastery[c].toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
                {open === row.uid && (
                  <TableRow>
                    <TableCell colSpan={COMPETENCIES.length + 2} className="bg-muted/30">
                      <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        {COMPETENCIES.map(c => {
                          const e = row.evidence[c];
                          return (
                            <p key={c}>
                              <span className="font-semibold">{getCompetencyLabel(c)}</span>: P {row.mastery[c].toFixed(3)}, {MASTERY_DESCRIPTORS[row.level[c]]} · {e.total} answers ({e.diagnostic} pre-test, {e.quiz} quiz, {e.drive} drive, {e.post_exam} post-test)
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
  );
};

export const CourseSection = ({ enabled }: { enabled: boolean }) => {
  const course = useCourseAdmin(enabled);
  const study = useStudyExport(enabled);
  return (
    <div className="space-y-6">
      <SectionHeader
        title="BKT & export"
        description="Each player's BKT per competency, replayed from their own answers with the course's model, and the study data export."
        meta={course.loading ? 'Reading the report…' : `${course.mastery.length} player(s) with BKT evidence`}
        actions={
          <Button variant="outline" size="sm" onClick={course.refresh} disabled={course.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {course.error && <Notice tone="error">{course.error}</Notice>}
      <BktTable course={course} />
      <Panel
        title="Study export"
        description="BKT is replayed per player from their evidence and also exported as logged; the Q-table export is its update log, in order."
      >
        <div className="flex flex-wrap gap-2">
          {STUDY_EXPORTS.map(({ kind, label }) => (
            <Button key={kind} variant={kind === 'json' ? 'default' : 'outline'} disabled={study.busy !== null || study.loading} onClick={() => void study.exportStudy(kind)}>
              <Download className="mr-2 h-4 w-4" />
              {study.busy === kind ? 'Exporting…' : label}
            </Button>
          ))}
        </div>
        {study.error && <p className="mt-3 text-sm text-destructive">{study.error}</p>}
      </Panel>
    </div>
  );
};
