/**
 * Admin > Course flow: the per-competency routing FSM the study runs, as a
 * table of its guarded moves with the rules taken from the code, and where
 * each participant is in it, with their whole course log.
 */
import { useState } from 'react';
import { Route } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { RUN_CONFIG, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { MASTERY_CUTOFFS } from '@/domain/competencyRouting/mastery';
import { ADDED_DECISIONS_PER_ACTION, COMPETENCY_ATTEMPT_CAP } from '@/domain/competencyRouting/course';
import type { CourseRecordsState } from '@/features/admin/application/useCourseRecords';
import type { PlayerCourseRow } from '@/features/admin/domain/courseAdmin';
import { EmptyState, Panel, SectionHeader, SectionTabs } from './adminUi';
import { CohortLoad, Legend, RecordsNotices } from './courseUi';
import { recordsMeta, rewardDetail } from './courseFormat';
import { toDateTime } from './formatDate';

const r = RUN_CONFIG.rules;

/** δ of M = (Q, Σ, δ, q₀, F), as `domain/competencyRouting/course.ts` defines it. */
const COURSE_TRANSITIONS: ReadonlyArray<{ from: string; when: string; to: string }> = [
  { from: 'MODULE(0)', when: 'Lessons read', to: 'DRIVE(0), the tutorial: no quiz, no decisions' },
  { from: 'DRIVE(0)', when: 'Drive ended', to: 'MODULE(1)' },
  { from: 'MODULE(L)', when: 'Lessons read', to: 'QUIZ(L)' },
  { from: 'QUIZ(L)', when: `Every competency passed (${r.quizPassCorrect} of ${r.quizItemsPerCompetency} each)`, to: 'DRIVE(L)' },
  { from: 'QUIZ(L)', when: `Some failed, attempts left (max ${r.quizAttemptCap})`, to: 'QUIZ(L): the failed competencies, new items' },
  { from: 'QUIZ(L)', when: `Attempt ${r.quizAttemptCap} failed`, to: 'QUIZ_REVIEW(L): module review, then DRIVE(L)' },
  { from: 'DRIVE(L) / REPEAT(L)', when: 'Each competency of the stage: its verdict, then one decision (none / practice / review)', to: 'its own next step, below' },
  { from: '— a competency', when: `none (legal after a pass at mastery ≥ ${MASTERY_CUTOFFS.developing.toFixed(2)})`, to: 'done: it leaves the repeat drives' },
  { from: '— a competency', when: `practice (always legal; adds ${ADDED_DECISIONS_PER_ACTION.practice} graded decisions)`, to: 'REPEAT(L): its scenarios again, new variants' },
  { from: '— a competency', when: `review (legal after a fail; adds ${ADDED_DECISIONS_PER_ACTION.review})`, to: 'its module section, then REPEAT(L) with its scenarios' },
  { from: '— a competency', when: `${COMPETENCY_ATTEMPT_CAP} attempts without none`, to: 'done, flagged unless none was legal then (cap)' },
  { from: 'DRIVE(L) / REPEAT(L)', when: 'Every competency done', to: 'MODULE(L+1), or FINAL after Level 11' },
  { from: 'DRIVE(L) / REPEAT(L)', when: 'Otherwise', to: 'REPEAT(L): only the competencies not done' },
  { from: 'FINAL', when: 'Passed / failed', to: 'CERTIFIED / FINAL' },
];

const PLAYERS_LEGEND = [
  { term: 'Last step', meaning: 'The newest course-log entry, at its phase: REPEAT(3) is a repeat drive in Level 3.' },
  { term: 'open', meaning: 'The competency still has repeat drives coming: its last decision was practice or review.' },
  { term: 'done', meaning: 'The policy chose none: it left the repeat drives.' },
  { term: 'flagged', meaning: `It reached the ${COMPETENCY_ATTEMPT_CAP}-attempt cap: done, and marked for the analysis.` },
  { term: '1/3', meaning: 'Its scenarios right out of those it had in the newest drive.' },
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
      description={`Q = {MODULE(L), QUIZ(L), QUIZ_REVIEW(L), DRIVE(L), REPEAT(L), FINAL, CERTIFIED}, q₀ = MODULE(0), F = {CERTIFIED}. The rules decide what is legal and when a stage ends; the Q-table chooses among the legal actions. Settings version ${RUN_CONFIG_VERSION}.`}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
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
      </div>
    </Panel>
    <Panel title="A competency's verdict in a drive" description="What a decision's state reads.">
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          Each competency the drive covers gets {r.driveItemsPerCompetency} scenarios; it passes with {r.drivePassCorrect} of {r.driveItemsPerCompetency} right.
        </li>
        <li>
          Its mastery level is its BKT P(L) after the drive: 1 below {MASTERY_CUTOFFS.developing}, 2 to {MASTERY_CUTOFFS.connecting}, 3 to {MASTERY_CUTOFFS.benchmarking}, 4
          above (level 4 needs {RUN_CONFIG.minDriveEvidenceForLevel4} drive answers).
        </li>
        <li>State = mastery level × passed/failed: one table per cohort, shared by every competency.</li>
        <li>The pre-test seeds BKT with no learning step; the post-test rewards nothing.</li>
      </ul>
    </Panel>
  </div>
);

const Standing = ({ row }: { row: PlayerCourseRow }) => (
  <div className="flex flex-wrap gap-1">
    {row.standing.map(s => (
      <Badge key={s.competency} variant={STATUS_STYLE[s.status]} title={`${s.attempts} decision(s), last ${s.lastAction ?? '–'}`}>
        {getCompetencyLabel(s.competency)} · {s.status}
        {s.lastTotal ? ` ${s.lastCorrect}/${s.lastTotal}` : ''}
      </Badge>
    ))}
  </div>
);

const PlayersPanel = ({ course }: { course: CourseRecordsState }) => {
  const [open, setOpen] = useState<string | null>(null);
  const players = course.derived!.players;
  if (players.length === 0) {
    return (
      <EmptyState icon={Route} title="No course records yet">
        A participant appears after their first Short Quiz or drive.
      </EmptyState>
    );
  }
  const logs = open ? course.data!.courseLogs.filter(row => row.userId === open).sort((a, b) => a.timestamp - b.timestamp) : [];
  return (
    <div className="space-y-4">
      <Legend title="Legend: participants" items={PLAYERS_LEGEND} />
      <Panel title="Where each participant is" description="From their course log: the newest entry, and the newest stage's competencies as its decisions left them. Click a row for the whole log." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Last step</TableHead>
                <TableHead>Stage competencies</TableHead>
                <TableHead>Decisions · rewards</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(row => (
                <TableRow key={row.uid} className="cursor-pointer" onClick={() => setOpen(open === row.uid ? null : row.uid)}>
                  <TableCell className="font-mono text-xs">{row.label}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.lastPhase ?? '–'}
                    {row.endReason && <Badge className="ml-2">{row.endReason}</Badge>}
                  </TableCell>
                  <TableCell>
                    <Standing row={row} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.decisions} · {row.rewards}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.lastAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      {open && (
        <Panel title={`Course log: ${players.find(p => p.uid === open)?.label}`} description="Every quiz, drive and final entry, oldest first." bodyClassName="p-0">
          <div className="overflow-x-auto">
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
                      {row.rewards
                        .map(w => `${getCompetencyLabel(w.competency)} ${w.action}: r ${rewardDetail(w)}`)
                        .join(' · ') || '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
};

export const CourseFlowSection = ({ course }: { course: CourseRecordsState }) => {
  const [view, setView] = useState<'machine' | 'participants'>('machine');
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Course flow"
        description="The per-competency routing FSM the study runs: module, Short Quiz (the gate), drive, then a decision per competency and repeat drives until every competency is done."
        meta={recordsMeta(course)}
        actions={<CohortLoad course={course} />}
      />
      <RecordsNotices course={course} />
      <SectionTabs
        value={view}
        onChange={setView}
        options={[
          { value: 'machine', label: 'The machine' },
          { value: 'participants', label: 'Participants' },
        ]}
      />
      {view === 'machine' ? (
        <MachinePanel />
      ) : course.derived ? (
        <PlayersPanel course={course} />
      ) : (
        <EmptyState icon={Route} title={course.loading ? 'Reading the records…' : 'The records are not loaded'}>
          Choose a cohort and press Load the records.
        </EmptyState>
      )}
    </div>
  );
};
