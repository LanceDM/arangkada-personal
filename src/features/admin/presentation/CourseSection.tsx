/**
 * Admin > BKT & export: each player's BKT per competency now (the replay of
 * their own pre-test, quiz and drive answers with the course's model), and
 * the study export. Every figure is from real players: nothing is simulated.
 */
import { Fragment, useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { setLabel } from '@/domain/learner/mastery/bktValueSets';
import { Download, Gauge, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { DEFAULT_BKT_MODEL } from '@/domain/learner/mastery/buildBKTProfile';
import { STUDY_EXPORTS, useStudyExport } from '@/features/admin/application/useStudyExport';
import { useCourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { MASTERY_DESCRIPTORS } from '@/features/admin/domain/courseAdmin';
import { EmptyState, Legend, Notice, Panel, SectionHeader } from './adminUi';
import { BktStagePanel } from './BktStagePanel';

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
  const [saving, setSaving] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const { user } = useAuthSession();
  const togglePilot = async (uid: string, label: string, on: boolean) => {
    if (!user) return;
    setSaving(uid);
    setMarkError(null);
    try {
      await course.bkt.setPilot({ uid, label }, on, user.uid);
    } catch (failure) {
      setMarkError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(null);
    }
  };
  if (course.mastery.length === 0) {
    return <EmptyState icon={Gauge} title="No BKT evidence yet">A player appears once their pre-test, a short quiz or a drive is saved.</EmptyState>;
  }
  return (
    <div className="space-y-3">
    <Legend
      title="Legend: BKT"
      items={[
        { term: <span className={`rounded px-1.5 ${LEVEL_CELL[1]}`}>0.42</span>, meaning: 'M1 Emerging: P(L) below 0.50.' },
        { term: <span className={`rounded px-1.5 ${LEVEL_CELL[2]}`}>0.66</span>, meaning: 'M2 Developing: 0.50–0.79.' },
        { term: <span className={`rounded px-1.5 ${LEVEL_CELL[3]}`}>0.88</span>, meaning: 'M3 Connecting: 0.80–0.94.' },
        { term: <span className={`rounded px-1.5 ${LEVEL_CELL[4]}`}>0.97</span>, meaning: 'M4 Benchmarking: 0.95+ with at least 3 drive answers.' },
        { term: 'P(L)', meaning: 'The chance the player knows the competency, after every answer so far.' },
        { term: 'Columns', meaning: COMPETENCIES.map(c => `${short(c)} ${getCompetencyLabel(c)}`).join(' · ') },
        { term: 'Answers', meaning: 'Graded answers BKT has read (pre-test, quiz, drive, post-test).' },
        { term: 'Start', meaning: 'Every competency starts at the value set\'s start (0.30 for the default values); the pre-test moves it before the course begins.' },
        { term: 'Pilot', meaning: 'Ticked: this player\'s answers feed the next BKT calibration. Leave test playthroughs unticked. Every tick and untick is logged.' },
        { term: 'Values', meaning: 'The value set the player runs on, kept from when they started to the end of their course.' },
      ]}
    />
    {markError && <Notice tone="error">Could not save the pilot mark: {markError}</Notice>}
    <Panel
      title="BKT per player"
      description={`P(L) per competency now; the colour is its mastery level (${Object.values(MASTERY_DESCRIPTORS).join(', ')}). Click a player for each competency's evidence. Each player is replayed with their own value set. Default values (Tentative): prior ${DEFAULT_BKT_MODEL.pInit}; pre-test and post-test T 0, S ${DEFAULT_BKT_MODEL.diagnostic.pSlip}, G ${DEFAULT_BKT_MODEL.diagnostic.pGuess}; quiz T ${DEFAULT_BKT_MODEL.quiz.pTransit}, S ${DEFAULT_BKT_MODEL.quiz.pSlip}, G ${DEFAULT_BKT_MODEL.quiz.pGuess}; drive T ${DEFAULT_BKT_MODEL.drive.pTransit}, S ${DEFAULT_BKT_MODEL.drive.pSlip}, G ${DEFAULT_BKT_MODEL.drive.pGuess}.`}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pilot</TableHead>
              <TableHead>Values</TableHead>
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
                  <TableCell className="text-xs" onClick={event => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Pilot: ${row.label}`}
                      checked={course.bkt.pilotIds.has(row.uid)}
                      disabled={!course.bkt.wired || saving !== null}
                      onChange={event => void togglePilot(row.uid, row.label, event.target.checked)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{setLabel(course.bkt.setOf(row.uid))}</TableCell>
                  <TableCell className="text-xs">{row.answers}</TableCell>
                  {COMPETENCIES.map(c => (
                    <TableCell key={c} className={`text-center font-mono text-xs ${LEVEL_CELL[row.level[c]]}`} title={`${getCompetencyLabel(c)}: ${MASTERY_DESCRIPTORS[row.level[c]]}`}>
                      {row.mastery[c].toFixed(2)}
                    </TableCell>
                  ))}
                </TableRow>
                {open === row.uid && (
                  <TableRow>
                    <TableCell colSpan={COMPETENCIES.length + 4} className="bg-muted/30">
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
    </div>
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
      <BktStagePanel mastery={course.mastery} bkt={course.bkt} />
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
