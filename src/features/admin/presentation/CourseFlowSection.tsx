/**
 * Admin > Course flow: the routing FSM the study runs (the per-competency
 * course, 2026-10-28) as a table of its states and moves, with the rules it
 * runs under taken from the code, and where each player is in it now.
 */
import { useState } from 'react';
import { RefreshCw, Route } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { RUN_CONFIG, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { MASTERY_CUTOFFS } from '@/domain/competencyRouting/mastery';
import { ADDED_DECISIONS_PER_ACTION } from '@/domain/competencyRouting/course';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import type { PlayerCourseRow } from '@/features/admin/domain/courseAdmin';
import { EmptyState, Legend, Notice, Panel, SectionHeader, SectionTabs } from './adminUi';
import { toDateTime } from './formatDate';

const r = RUN_CONFIG.rules;

/** The machine, M = (Q, Σ, δ, q₀, F): each row one guarded move of δ. */
const COURSE_TRANSITIONS: ReadonlyArray<{ from: string; when: string; to: string }> = [
  { from: 'Sign-in → pre-test', when: `The 60-item pre-test is finished (no feedback; its answers set each competency's starting BKT, T = 0)`, to: 'MODULE(0)' },
  { from: 'MODULE(0) tutorial', when: 'Lessons read', to: 'DRIVE(0)' },
  { from: 'DRIVE(0)', when: 'Any result (no per-competency decisions, not in BKT)', to: 'MODULE(1)' },
  { from: 'MODULE(L)', when: 'Lessons read', to: 'QUIZ(L)' },
  { from: 'QUIZ(L)', when: `Every competency passed (${r.quizPassCorrect} of ${r.quizItemsPerCompetency} each)`, to: 'DRIVE(L)' },
  { from: 'QUIZ(L)', when: `Some failed, attempts left (max ${r.quizAttemptCap})`, to: `QUIZ(L) retake: the failed competencies only, ${r.quizItemsPerCompetency} unseen items each` },
  { from: 'QUIZ(L)', when: `Attempt ${r.quizAttemptCap} failed`, to: 'QUIZ_REVIEW(L): the module sections of the failed competencies, then DRIVE(L) (what follows the review is Open)' },
  { from: 'DRIVE(L) / REPEAT(L)', when: 'Each competency of the stage: verdict, then one policy decision (none / practice / review)', to: 'its own next step, below' },
  { from: '— a competency', when: `none (legal after a pass at mastery ≥ ${MASTERY_CUTOFFS.developing.toFixed(2)})`, to: 'done: it leaves the repeat drives' },
  { from: '— a competency', when: `practice (legal always; adds ${ADDED_DECISIONS_PER_ACTION.practice} graded decisions)`, to: `REPEAT(L) with its ${r.driveItemsPerCompetency} scenarios again, new variants` },
  { from: '— a competency', when: `review (legal after a fail; adds ${ADDED_DECISIONS_PER_ACTION.review})`, to: 'its module section, then REPEAT(L) with its scenarios' },
  { from: '— a competency', when: `${r.competencyAttemptCap} attempts without none`, to: 'done and flagged (cap)' },
  { from: 'DRIVE(L) / REPEAT(L)', when: 'Every competency done', to: 'MODULE(L+1), or FINAL after Level 11' },
  { from: 'FINAL', when: 'Passed / failed', to: 'CERTIFIED / FINAL retry' },
  { from: 'CERTIFIED', when: 'The 30-item two-stage post-test is finished', to: "Course over: each competency's share right is its last measurement (rewards waiting decisions)" },
];

const PLAYERS_LEGEND = [
  { term: 'Last step', meaning: 'The newest course-log entry: quiz, drive, final or post-test, at its phase, e.g. REPEAT(3) is a repeat drive in Level 3.' },
  { term: 'open', meaning: 'The competency still has repeat drives coming: its last decision was practice or review.' },
  { term: 'done', meaning: 'The policy chose none after a pass at mastery 0.50+: it left the repeat drives.' },
  { term: 'flagged', meaning: 'It reached the 3-attempt cap without none: done, and marked for the analysis.' },
  { term: '1/3', meaning: 'Its scenarios right out of those it had in the newest drive.' },
  { term: 'certified / cap_reached', meaning: 'The final mission was passed, or an entry ended a competency at the cap.' },
  { term: 'Decisions · rewards', meaning: 'Per-competency decisions made, and how many have been rewarded so far.' },
] as const;

const STATUS_STYLE: Record<'open' | 'done' | 'flagged', 'secondary' | 'default' | 'destructive'> = {
  open: 'secondary',
  done: 'default',
  flagged: 'destructive',
};

const MachinePanel = () => (
  <div className="space-y-4">
    <Panel
      title="The routing FSM (per-competency course)"
      description={`States Q = {MODULE(L), QUIZ(L), QUIZ_REVIEW(L), DRIVE(L), REPEAT(L), FINAL, CERTIFIED}, q₀ = MODULE(0), F = {CERTIFIED}. The rules choose what is legal and when a stage ends; the Q-table chooses among the legal actions. Settings version ${RUN_CONFIG_VERSION}.`}
      bodyClassName="p-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>When</TableHead>
            <TableHead>To</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {COURSE_TRANSITIONS.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="whitespace-nowrap font-mono text-xs">{row.from}</TableCell>
              <TableCell className="text-xs">{row.when}</TableCell>
              <TableCell className="text-xs">{row.to}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
    <Panel title="Competency verdict in a drive" description="What the decision's state reads.">
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          Each competency the drive covers gets {r.driveItemsPerCompetency} scenarios; it passes with {r.drivePassCorrect} of {r.driveItemsPerCompetency} first answers right.
        </li>
        <li>
          Its mastery level is its BKT P(L) after the drive: 1 below {MASTERY_CUTOFFS.developing}, 2 to {MASTERY_CUTOFFS.connecting}, 3 to {MASTERY_CUTOFFS.benchmarking}, 4 above (level 4 needs {RUN_CONFIG.minDriveEvidenceForLevel4} drive answers).
        </li>
        <li>State = mastery level × passed/failed: 8 states, one table shared by every competency.</li>
        <li>An in-drive question left unanswered after its time limit is logged and is not BKT evidence.</li>
      </ul>
    </Panel>
  </div>
);

const Standing = ({ row }: { row: PlayerCourseRow }) => (
  <div className="flex flex-wrap gap-1">
    {row.standing.map(s => (
      <Badge key={s.competency} variant={STATUS_STYLE[s.status]} title={`${s.attempts} decision(s), last ${s.lastAction ?? '–'}${s.lastTotal ? `, ${s.lastCorrect}/${s.lastTotal}` : ''}`}>
        {getCompetencyLabel(s.competency)} · {s.status}
        {s.lastTotal ? ` ${s.lastCorrect}/${s.lastTotal}` : ''}
      </Badge>
    ))}
  </div>
);

const PlayersPanel = ({ course }: { course: CourseAdmin }) => {
  const [open, setOpen] = useState<string | null>(null);
  if (course.players.length === 0) {
    return <EmptyState icon={Route} title="No course records yet">Each player appears here after their first short quiz or drive.</EmptyState>;
  }
  const logs = open ? course.courseLogs.filter(row => row.userId === open).sort((a, b) => a.timestamp - b.timestamp) : [];
  return (
    <div className="space-y-4">
      <Legend title="Legend: players" items={PLAYERS_LEGEND} />
      <Panel title="Where each player is" description="From their course log: the newest entry, and the newest stage's competencies as its decisions left them." bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Last step</TableHead>
              <TableHead>Stage competencies</TableHead>
              <TableHead>Decisions · rewards</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {course.players.map(row => (
              <TableRow key={row.uid} className="cursor-pointer" onClick={() => setOpen(open === row.uid ? null : row.uid)}>
                <TableCell className="font-mono text-xs">{row.label}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.lastPhase}
                  {row.endReason && <Badge className="ml-2">{row.endReason}</Badge>}
                </TableCell>
                <TableCell>
                  <Standing row={row} />
                </TableCell>
                <TableCell className="text-xs">
                  {row.decisions} · {row.rewards}
                </TableCell>
                <TableCell className="text-xs">{toDateTime(row.lastAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {open && (
        <Panel title={`Course log: ${course.players.find(p => p.uid === open)?.label}`} description="Every quiz, drive, final and post-test entry, oldest first." bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Verdicts</TableHead>
                <TableHead>Decisions</TableHead>
                <TableHead>Rewards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.timestamp)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.kind} · {row.phase}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.verdicts.map(v => `${getCompetencyLabel(v.competency)} ${v.correct}/${v.total}${v.passed ? ' ✓' : ' ✗'} (P ${v.masteryP.toFixed(2)})`).join(' · ') || '–'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.decisions.map(d => `${getCompetencyLabel(d.competency)}: M${d.state.mastery}-${d.state.result} → ${d.action} (${d.source}, p ${d.probability.toFixed(2)})`).join(' · ') || '–'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.rewards.map(w => `${getCompetencyLabel(w.competency)} ${w.action}: r ${w.reward.toFixed(3)} (A ${w.accuracy.toFixed(2)}, pass ${w.passed ? 1 : 0}, H ${w.addedDecisions}, by ${w.measuredBy})`).join(' · ') || '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
};

export const CourseFlowSection = ({ course }: { course: CourseAdmin }) => {
  const [view, setView] = useState<'machine' | 'players'>('machine');
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Course flow"
        description="The routing FSM the study runs: module, short quiz (the gate), drive, then a decision per competency and repeat drives until every competency is done."
        meta={course.loading ? 'Reading the course logs…' : `${course.players.length} player(s) with course records`}
        actions={
          <Button variant="outline" size="sm" onClick={course.refresh} disabled={course.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {course.error && <Notice tone="error">{course.error}</Notice>}
      <SectionTabs
        value={view}
        onChange={setView}
        options={[
          { value: 'machine', label: 'The machine' },
          { value: 'players', label: 'Players' },
        ]}
      />
      {view === 'machine' ? <MachinePanel /> : <PlayersPanel course={course} />}
    </div>
  );
};
