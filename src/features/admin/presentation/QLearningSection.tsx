/**
 * Admin > Q-learning: the policy the course runs (2026-10-28), its settings
 * from the code, the shared table live, what each state's actions have earned
 * so far, and every decision with who chose it and its probability.
 */
import { useMemo, useState } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { RUN_CONFIG, RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { legalActions, Q_STATES, stateKey } from '@/domain/competencyRouting/qLearning';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { EmptyState, Legend, Notice, Panel, SectionHeader, SectionTabs } from './adminUi';
import { QTablePanel } from './QTablePanel';
import { toDateTime } from './formatDate';

const fmt = (value: number | null | undefined, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');
const { warmUp, reward, gamma } = RUN_CONFIG;

const SettingsPanel = () => (
  <Panel title="The policy" description={`As the code runs it (settings version ${RUN_CONFIG_VERSION}). Items marked Tentative are still the group's to decide.`}>
    <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-foreground">Decision</dt>
        <dd className="text-muted-foreground">One per competency the stage teaches, after each drive and repeat drive. Not at the tutorial or the final exam.</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">State (8)</dt>
        <dd className="text-muted-foreground">Mastery level (1–4, from BKT) × the competency's scenario result (passed / failed). One table shared by every competency.</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Actions (Tentative)</dt>
        <dd className="text-muted-foreground">none (after a pass at mastery level 2+), practice (always), review (after a fail).</dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Warm-up (Tentative)</dt>
        <dd className="text-muted-foreground">
          Double Explore-then-Commit: {warmUp.exploreFirst} random visits per legal action, then commit until the leader has {warmUp.commitLeader}, then {warmUp.exploreSecond} more per other action, then the final commit. Every non-leader keeps probability {warmUp.floor}. Ties go to fewer visits, then the fallback rule.
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Learning</dt>
        <dd className="font-mono text-muted-foreground">
          Q(s,a) ← Q(s,a) + α[r + γ·max Q(s′,a′) − Q(s,a)], α = {RUN_CONFIG.learningRate}, γ = {gamma}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-foreground">Reward (Tentative)</dt>
        <dd className="font-mono text-muted-foreground">
          r = A_next + {reward.pass}·Pass − {reward.perAddedDecision}·H
        </dd>
        <dd className="text-muted-foreground">At the competency's next measurement (a repeat drive, a later quiz or drive, the final, or the post-test). Observed data only.</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="font-semibold text-foreground">Fallback rule (tie-break only)</dt>
        <dd className="text-muted-foreground">After a pass: practice below mastery 0.80, otherwise none. After a fail: practice on the first failure, review on a repeat failure.</dd>
      </div>
    </dl>
  </Panel>
);

const EARNED_LEGEND = [
  { term: 'Chosen', meaning: 'Decisions that picked this action in this state.' },
  { term: 'explore / exploit / forced', meaning: 'A random warm-up draw, the leader by the policy, or the only legal action (or the attempt cap).' },
  { term: 'Rewarded', meaning: 'How many of those have been measured again and rewarded; the rest are waiting.' },
  { term: 'Mean r', meaning: 'Average reward r = A_next + 0.5·Pass − 0.02·H.' },
  { term: 'Mean A_next', meaning: "Average share of the competency's graded answers right at its next measurement (0–1)." },
  { term: 'Pass share', meaning: 'How often it passed at that next measurement (0–1).' },
  { term: 'Mean H', meaning: 'Graded decisions the action added (practice and review add 3, none 0).' },
] as const;

const DECISIONS_LEGEND = [
  { term: 'State (P)', meaning: 'M1–M4 and passed/failed, with the BKT P(L) it was read from.' },
  { term: 'Legal → chosen', meaning: 'The actions the rules allowed, and the one taken.' },
  { term: 'By', meaning: 'The warm-up phase that chose it (explore_1, commit_1, explore_2, final_commit), only_legal, or cap (3 attempts).' },
  { term: 'explore / exploit / forced', meaning: 'Random draw, the leader, or no choice.' },
  { term: 'p', meaning: 'The probability the chosen action had, logged for later analysis.' },
  { term: 'Reward', meaning: 'r with its parts (A, pass, H) and where it was measured; "waiting" until the competency is measured again.' },
] as const;

const EarnedPanel = ({ course }: { course: CourseAdmin }) => (
  <Panel
    title="What each action has earned"
    description="Per state and legal action: how often it was chosen (explored, exploited, forced), and the rewards it received with their parts. Compare actions within a state, never across states."
    bodyClassName="p-0"
  >
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>State</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Chosen (explore / exploit / forced)</TableHead>
          <TableHead>Rewarded</TableHead>
          <TableHead>Mean r</TableHead>
          <TableHead>Mean A_next</TableHead>
          <TableHead>Pass share</TableHead>
          <TableHead>Mean H</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Q_STATES.flatMap(state =>
          legalActions(state).map(action => {
            const row = course.stats.find(s => s.state === stateKey(state) && s.action === action)!;
            return (
              <TableRow key={`${row.state}-${action}`}>
                <TableCell className="font-mono text-xs">{row.state}</TableCell>
                <TableCell className="text-xs">{action}</TableCell>
                <TableCell className="text-xs">
                  {row.chosen} ({row.explore} / {row.exploit} / {row.forced})
                </TableCell>
                <TableCell className="text-xs">{row.rewarded}</TableCell>
                <TableCell className="text-xs font-semibold">{fmt(row.meanReward)}</TableCell>
                <TableCell className="text-xs">{fmt(row.meanAccuracy, 2)}</TableCell>
                <TableCell className="text-xs">{fmt(row.passShare, 2)}</TableCell>
                <TableCell className="text-xs">{fmt(row.meanAdded, 1)}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  </Panel>
);

const DecisionsPanel = ({ course }: { course: CourseAdmin }) => {
  const [player, setPlayer] = useState('');
  const rows = useMemo(() => course.decisions.filter(d => !player || d.uid === player).slice(0, 200), [course.decisions, player]);
  if (course.decisions.length === 0) {
    return <EmptyState icon={BrainCircuit} title="No decisions yet">The first decision is made after a player's first drive in Level 1.</EmptyState>;
  }
  return (
    <Panel
      title="Decisions"
      description="Newest first (up to 200): the state, the legal actions, the action, who chose it (warm-up phase, only legal, or the cap) and its probability, and its reward once it came."
      actions={
        <select aria-label="Player" value={player} onChange={event => setPlayer(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Every player</option>
          {course.players.map(p => (
            <option key={p.uid} value={p.uid}>
              {p.label}
            </option>
          ))}
        </select>
      }
      bodyClassName="p-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Stage · competency</TableHead>
            <TableHead>State (P)</TableHead>
            <TableHead>Legal → chosen</TableHead>
            <TableHead>By · p</TableHead>
            <TableHead>Reward</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(d => (
            <TableRow key={`${d.uid}-${d.seq}-${d.competency}`}>
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
                {d.reward ? `${d.reward.reward.toFixed(3)} (A ${d.reward.accuracy.toFixed(2)}, pass ${d.reward.passed ? 1 : 0}, H ${d.reward.addedDecisions}; ${d.reward.measuredBy})` : 'waiting'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
};

export const QLearningSection = ({ course }: { course: CourseAdmin }) => {
  const [view, setView] = useState<'table' | 'earned' | 'decisions'>('table');
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Q-learning"
        description="The per-competency policy, learned online from real players only: an empty table at the start, no pre-training and no simulated data."
        meta={course.loading ? 'Reading the course logs…' : `${course.decisions.length} decision(s) logged`}
        actions={
          <Button variant="outline" size="sm" onClick={course.refresh} disabled={course.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {course.error && <Notice tone="error">{course.error}</Notice>}
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
      {view === 'table' && <QTablePanel />}
      {view === 'earned' && (
        <>
          <Legend title="Legend: rewards" items={EARNED_LEGEND} />
          <EarnedPanel course={course} />
        </>
      )}
      {view === 'decisions' && (
        <>
          <Legend title="Legend: decisions" items={DECISIONS_LEGEND} />
          <DecisionsPanel course={course} />
        </>
      )}
    </div>
  );
};
