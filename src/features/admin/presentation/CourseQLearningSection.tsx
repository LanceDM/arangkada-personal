/**
 * Admin > Q-learning (course): the per-competency policy the course runs,
 * its settings from the code, a cohort's shared table live, what each state's
 * actions have earned, and every decision with who chose it and its
 * probability. Learned online from real players only: the table starts empty.
 */
import { useMemo, useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { RUN_CONFIG, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { COMPETENCY_ACTIONS, Q_STATES, legalActions, stateKey } from '@/domain/competencyRouting/qLearning';
import type { CourseRecordsState } from '@/features/admin/application/useCourseRecords';
import { useLiveCourseTable } from '@/features/admin/application/useCourseRecords';
import { EmptyState, Panel, SectionHeader, SectionTabs } from './adminUi';
import { CohortLoad, Legend, RecordsNotices } from './courseUi';
import { COHORT_LABEL, fmt, recordsMeta, rewardDetail } from './courseFormat';
import { toDateTime } from './formatDate';

const { warmUp, reward, gamma } = RUN_CONFIG;

const SettingsPanel = () => (
  <Panel title="The policy" description={`As the code runs it (settings version ${RUN_CONFIG_VERSION}).`}>
    <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-foreground">Decision</dt>
        <dd className="text-muted-foreground">One per competency the stage teaches, after each drive and repeat drive. None at the tutorial or the final exam.</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">State ({Q_STATES.length})</dt>
        <dd className="text-muted-foreground">Mastery level 1–4 (from BKT) × the competency's scenario result (passed / failed). One table per cohort, shared by every competency.</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Actions</dt>
        <dd className="text-muted-foreground">none (after a pass at mastery level 2+), practice (always), review (after a fail).</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Warm-up</dt>
        <dd className="text-muted-foreground">
          {warmUp.exploreFirst} random tries per legal action
          {warmUp.commitLeader > 0 ? `, then commit until the leader has ${warmUp.commitLeader}, then ${warmUp.exploreSecond} more per other action` : ''}, then every
          other legal action keeps probability {warmUp.floor} and the leader takes the rest ({1 - warmUp.floor} with two legal actions). Ties go to fewer
          visits, then the fallback rule. Every probability is logged.
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Learning</dt>
        <dd className="font-mono text-muted-foreground">
          Q(s,a) ← Q(s,a) + α[r + γ·max Q(s′,a′) − Q(s,a)], α = {RUN_CONFIG.learningRate}, γ = {gamma}
        </dd>
        <dd className="text-muted-foreground">Episodic: one episode per competency per level, at most its attempt cap of decisions. Nothing chains across levels.</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Reward</dt>
        <dd className="font-mono text-muted-foreground">
          step: r = −{reward.perAddedDecision}·H · terminal: r = A_next − {reward.perAddedDecision}·H
        </dd>
        <dd className="text-muted-foreground">
          A practice or review followed by another decision in the same level earns only its cost (a step, s′ = that decision's state). The episode's last
          decision (a none, or the one the cap closed) earns its competency's next measurement after the level: a later quiz, drive or the final (terminal,
          s′ none). The post-test rewards nothing. A drive that ended early (a crash or time-up) measures only the topics it asked, so an unasked topic&apos;s
          decision keeps waiting.
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-semibold text-foreground">Fallback rule (tie-break only)</dt>
        <dd className="text-muted-foreground">After a pass: practice below mastery 0.80, otherwise none. After a fail: practice on the first failure, review on a repeat failure.</dd>
      </div>
    </dl>
  </Panel>
);

const TABLE_LEGEND = [
  { term: 'M1–M4', meaning: "The competency's mastery level after the drive: M1 below 0.50, M2 0.50–0.79, M3 0.80–0.94, M4 0.95+ (needs 3 drive answers)." },
  { term: 'passed / failed', meaning: 'Its scenario result in that drive: 2 of its 3 scenarios right is a pass.' },
  { term: 'not legal', meaning: 'The rules forbid that action in that state; the table never chooses it.' },
  { term: 'Exploring / Exploiting / No choice', meaning: 'Warm-up draws, commits to the leader, or the state has one legal action.' },
  { term: 'Q', meaning: 'The running average of its targets r + γ·max Q(next state). – = not updated yet.' },
  { term: 'n · visits', meaning: 'Rewards it has learned from (α = 1/n), and times it was chosen there.' },
  { term: 'leader (bold)', meaning: 'The highest Q; ties go to fewer visits, then the fallback rule.' },
] as const;

const TAG_LABEL: Record<string, string> = { exploring: 'Exploring', exploiting: 'Exploiting', no_choice: 'No choice' };

type Cell = { q?: number; n?: number; visits?: number };

const LiveTable = ({ cohort }: { cohort: CourseRecordsState['cohort'] }) => {
  const live = useLiveCourseTable(cohort);
  const table = live.table as {
    updates?: number;
    updatedAt?: number;
    table?: Record<string, Record<string, Cell>>;
    states?: Record<string, { tag?: string; phase?: string; leader?: string | null }>;
    lastUpdate?: { participantCode?: string | null; kind?: string };
  } | null;
  return (
    <div className="space-y-4">
      <Legend title="Legend: the live table" items={TABLE_LEGEND} />
      <Panel
        title={`Shared Q-table, ${COHORT_LABEL[cohort]} (live)`}
        description={
          table
            ? `${table.updates ?? 0} update(s) · last change ${toDateTime(table.updatedAt)}${table.lastUpdate ? ` by ${table.lastUpdate.participantCode ?? '–'} (${table.lastUpdate.kind})` : ''}`
            : 'No table yet: it appears with the cohort\'s first decision.'
        }
        bodyClassName="p-0"
      >
        {live.error && <p className="px-4 pt-3 text-xs text-destructive">{live.error}</p>}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Warm-up</TableHead>
                {COMPETENCY_ACTIONS.map(action => (
                  <TableHead key={action}>{action}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Q_STATES.map(state => {
                const key = stateKey(state);
                const status = table?.states?.[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs">{key}</TableCell>
                    <TableCell className="text-xs">
                      {status ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant={status.tag === 'exploring' ? 'secondary' : 'default'}>{TAG_LABEL[status.tag ?? ''] ?? status.tag}</Badge>
                          <span className="text-muted-foreground">{status.phase}</span>
                        </div>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    {COMPETENCY_ACTIONS.map(action => {
                      if (!legalActions(state).includes(action)) {
                        return (
                          <TableCell key={action} className="text-xs text-muted-foreground/50">
                            not legal
                          </TableCell>
                        );
                      }
                      const cell = table?.table?.[key]?.[action];
                      const leader = status?.leader === action;
                      return (
                        <TableCell key={action} className={`text-xs ${leader ? 'font-semibold' : ''}`}>
                          <div>Q {fmt(cell?.q)}</div>
                          <div className="text-muted-foreground">
                            n {cell?.n ?? 0} · visits {cell?.visits ?? 0}
                            {leader ? ' · leader' : ''}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <Panel title="Newest updates" description="The cohort's table update log, newest first (up to 30). Every entry keeps its full detail." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>State · action</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {live.updates.map(row => {
                const d = row.decision as Record<string, unknown> | null;
                const l = row.learning as Record<string, unknown> | null;
                return (
                  <TableRow key={String(row.eventId ?? row.globalSeq)}>
                    <TableCell className="text-xs">{String(row.globalSeq ?? '')}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.at as number)}</TableCell>
                    <TableCell className="font-mono text-xs">{String(row.participantCode ?? '–')}</TableCell>
                    <TableCell className="text-xs">{String(row.kind)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(row.stateKey)} · {String(row.action)} ({getCompetencyLabel(String(row.competency))})
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.kind === 'visit' && d
                        ? `${String(d.selection)} · ${String(d.warmUpPhase)} · p ${fmt(d.probability, 2)} · draw ${fmt(d.draw)}`
                        : l
                          ? `r ${fmt(l.reward)} · Q ${fmt(l.qBefore)} → ${fmt(l.qAfter)} · α ${fmt(l.alpha)} · by ${String(l.measuredBy)}`
                          : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
};

const EARNED_LEGEND = [
  { term: 'Chosen', meaning: 'Decisions that picked this action in this state (explored / exploited / forced).' },
  { term: 'Rewarded (step / terminal)', meaning: 'How many of those have been rewarded so far, split into steps within the level and terminal rewards after it; the rest are waiting.' },
  { term: 'Mean r', meaning: `Average reward over every reward received: steps (−${reward.perAddedDecision}·H) and terminal ones together.` },
  { term: 'Mean terminal r', meaning: `Average terminal reward, r = A_next − ${reward.perAddedDecision}·H.` },
  { term: 'Mean A_next · Mean H', meaning: 'The reward\'s parts, averaged: share right at the next measurement after the level (terminal rewards only), decisions the action added.' },
] as const;

const Earned = ({ course }: { course: CourseRecordsState }) => (
  <div className="space-y-4">
    <Legend title="Legend: rewards" items={EARNED_LEGEND} />
    <Panel
      title="What each action has earned"
      description="From the course logs. Compare actions within a state, never across states: states differ in what they can earn."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Chosen (explore / exploit / forced)</TableHead>
              <TableHead>Rewarded (step / terminal)</TableHead>
              <TableHead>Mean r</TableHead>
              <TableHead>Mean terminal r</TableHead>
              <TableHead>Mean A_next</TableHead>
              <TableHead>Mean H</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Q_STATES.flatMap(state =>
              legalActions(state).map(action => {
                const row = course.derived!.stats.find(s => s.state === stateKey(state) && s.action === action)!;
                return (
                  <TableRow key={`${row.state}-${action}`}>
                    <TableCell className="font-mono text-xs">{row.state}</TableCell>
                    <TableCell className="text-xs">{action}</TableCell>
                    <TableCell className="text-xs">
                      {row.chosen} ({row.explore} / {row.exploit} / {row.forced})
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.rewarded} ({row.steps} / {row.terminal})
                    </TableCell>
                    <TableCell className="text-xs font-semibold">{fmt(row.meanReward)}</TableCell>
                    <TableCell className="text-xs">{fmt(row.meanTerminalReward)}</TableCell>
                    <TableCell className="text-xs">{fmt(row.meanAccuracy, 2)}</TableCell>
                    <TableCell className="text-xs">{fmt(row.meanAdded, 1)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  </div>
);

const Decisions = ({ course }: { course: CourseRecordsState }) => {
  const [player, setPlayer] = useState('');
  const all = course.derived!.decisions;
  const rows = useMemo(() => all.filter(d => !player || d.uid === player).slice(0, 200), [all, player]);
  if (all.length === 0) {
    return (
      <EmptyState icon={BrainCircuit} title="No decisions yet">
        The first decision is made after a participant's first drive in Level 1.
      </EmptyState>
    );
  }
  return (
    <Panel
      title="Decisions"
      description="Newest first (up to 200): the state and its P(L), the legal actions and the one taken, who chose it (warm-up phase, only legal, or the cap) with its probability, and its reward once it came."
      actions={
        <select aria-label="Participant" value={player} onChange={event => setPlayer(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Every participant</option>
          {course.derived!.players.map(p => (
            <option key={p.uid} value={p.uid}>
              {p.label}
            </option>
          ))}
        </select>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Stage · competency</TableHead>
              <TableHead>State (P)</TableHead>
              <TableHead>Legal → chosen</TableHead>
              <TableHead>By · p</TableHead>
              <TableHead>Reward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(d => (
              <TableRow key={`${d.uid}-${d.levelId}-${d.seq}-${d.competency}`}>
                <TableCell className="whitespace-nowrap text-xs">{toDateTime(d.timestamp)}</TableCell>
                <TableCell className="font-mono text-xs">{d.label}</TableCell>
                <TableCell className="text-xs">
                  L{d.levelId} · {getCompetencyLabel(d.competency)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {stateKey(d.state)} ({d.masteryP.toFixed(2)})
                </TableCell>
                <TableCell className="text-xs">
                  {d.legal.join(' / ')} → <span className="font-semibold">{d.action}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {d.source} · {d.selection} · {d.probability.toFixed(2)}
                </TableCell>
                <TableCell className="text-xs">
                  {d.reward
                    ? rewardDetail(d.reward)
                    : 'waiting'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
};

export const CourseQLearningSection = ({ course }: { course: CourseRecordsState }) => {
  const [view, setView] = useState<'table' | 'earned' | 'decisions'>('table');
  const needRecords = (
    <EmptyState icon={BrainCircuit} title={course.loading ? 'Reading the records…' : 'The records are not loaded'}>
      Rewards and decisions come from every enrolled participant's course log. Choose a cohort and press Load the records.
    </EmptyState>
  );
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Q-learning (course)"
        description="The per-competency policy the course runs, learned online from real players only: an empty table at the start, no pre-training and no simulated data."
        meta={recordsMeta(course)}
        actions={<CohortLoad course={course} />}
      />
      <RecordsNotices course={course} />
      <SettingsPanel />
      <SectionTabs
        value={view}
        onChange={setView}
        options={[
          { value: 'table', label: 'Live table' },
          { value: 'earned', label: 'Rewards by state and action' },
          { value: 'decisions', label: 'Decisions' },
        ]}
      />
      {view === 'table' && <LiveTable cohort={course.cohort} />}
      {view === 'earned' && (course.derived ? <Earned course={course} /> : needRecords)}
      {view === 'decisions' && (course.derived ? <Decisions course={course} /> : needRecords)}
    </div>
  );
};
