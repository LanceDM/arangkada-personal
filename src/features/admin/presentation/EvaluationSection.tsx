/**
 * Admin > Model evaluation (2026-11-12): how well BKT predicted each answer
 * before it read it, for each player and for the whole model, and how the
 * Q-learning policy behaved. Computed from the logged records of real players;
 * nothing is simulated or refitted.
 */
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, LineChart, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import type { EvaluationLogs } from '@/features/admin/application/useEvaluationLogs';
import {
  PREDICTION_SOURCES,
  SOURCE_LABEL,
  evaluateBkt,
  evaluateConvergence,
  evaluateCoursePolicy,
  type BktEvaluation,
  type Interval,
  type PredictiveMetrics,
  type QConvergence,
  type Spread,
} from '@/features/admin/domain/modelEvaluation';
import { EmptyState, Legend, Notice, Panel, SectionHeader, SectionTabs } from './adminUi';
import { toDateTime } from './formatDate';

const fmt = (value: number | null | undefined, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');
const share = (part: number, whole: number) => (whole ? `${part} of ${whole} (${((100 * part) / whole).toFixed(0)}%)` : '–');
const interval = (range: Interval | null) => (range ? `${range[0].toFixed(3)} to ${range[1].toFixed(3)}` : '–');
const spreadText = (s: Spread | null) => (s ? `${s.mean.toFixed(3)}${s.sd !== null ? ` ± ${s.sd.toFixed(3)}` : ''} (${s.n})` : '–');

const BKT_LEGEND = [
  { term: 'Prediction', meaning: 'Before each answer BKT states its chance of being right: P(L)(1 − S) + (1 − P(L))G. It is logged before the answer updates the model, so no prediction has seen its own answer (test, then train).' },
  { term: 'Answers', meaning: 'Graded answers BKT predicted and then read: pre-test, short quiz, drive and post-test.' },
  { term: 'Right / Predicted', meaning: 'The share of the answers that were right, and the average chance BKT gave. Close together means well calibrated on average.' },
  { term: 'AUC', meaning: 'The chance a right answer got a higher prediction than a wrong one. 0.5 is guessing, 1 is perfect. Blank when the answers were all right or all wrong.' },
  { term: 'RMSE', meaning: 'The typical gap between the prediction and what happened (0 or 1). Lower is better. The baseline predicts the observed share right for every answer.' },
  { term: 'Accuracy', meaning: 'The share of answers predicted on the right side of 0.5. The baseline always predicts the commoner outcome.' },
  { term: 'Pooled', meaning: 'Every prediction counted once (global). Players with more answers weigh more. This is the headline figure.' },
  { term: 'Per-player average', meaning: "Each player's own figure, then averaged (mean ± SD, number of players with a value). Every player weighs the same." },
  { term: '95% interval', meaning: 'Cluster bootstrap: whole players are redrawn 1,000 times, because one player\'s answers are not independent. Needs at least two players.' },
  { term: 'ECE', meaning: 'Expected calibration error: the average gap between prediction and outcome over the ten bins, weighted by their answers.' },
] as const;

const Q_LEGEND = [
  { term: 'explore / exploit / forced', meaning: 'A random warm-up draw, the leader by the policy, or no choice (one legal action, or the 3-attempt cap).' },
  { term: 'Choices', meaning: 'Decisions that had two legal actions and were not ended by the cap.' },
  { term: 'Differs from the rule', meaning: 'The share of choices where the action is not what the fallback rule would have picked. When exploiting, this is what the table learned differently.' },
  { term: 'Illegal actions', meaning: 'Decisions whose action the rules do not allow in their state. Must be 0.' },
  { term: 'Coverage', meaning: 'Of the 15 legal state-action pairs: chosen at least once, chosen through the first exploration (2 visits), and rewarded at least once.' },
  { term: 'Mean r, 95% interval', meaning: 'Average reward of an action in a state, with a player-resampled bootstrap interval. Compare actions within a state only. Not a causal effect.' },
  { term: 'Reward by quarter', meaning: 'Rewards in time order cut in four equal parts. States differ in what they can earn, so read it with the per-state table.' },
  { term: '|ΔQ|', meaning: 'How far one learning update moved its Q value. Falling toward 0 means the table is settling.' },
  { term: 'Leader changes', meaning: "How often a state's best action changed, and how many table updates ago it last did." },
] as const;

const MetricCells = ({ m }: { m: PredictiveMetrics | null }) => (
  <>
    <TableCell className="text-xs">{m?.n ?? 0}</TableCell>
    <TableCell className="text-xs">{fmt(m?.observedRate, 2)}</TableCell>
    <TableCell className="text-xs">{fmt(m?.meanPredicted, 2)}</TableCell>
    <TableCell className="text-xs font-semibold">{fmt(m?.auc)}</TableCell>
    <TableCell className="text-xs">
      {fmt(m?.rmse)} <span className="text-muted-foreground">({fmt(m?.baselineRmse)})</span>
    </TableCell>
    <TableCell className="text-xs">
      {fmt(m?.accuracy, 2)} <span className="text-muted-foreground">({fmt(m?.baselineAccuracy, 2)})</span>
    </TableCell>
  </>
);

const MetricHeads = () => (
  <>
    <TableHead>Answers</TableHead>
    <TableHead>Right</TableHead>
    <TableHead>Predicted</TableHead>
    <TableHead>AUC</TableHead>
    <TableHead>RMSE (baseline)</TableHead>
    <TableHead>Accuracy (baseline)</TableHead>
  </>
);

const WholeModel = ({ bkt }: { bkt: BktEvaluation }) => (
  <div className="space-y-4">
    <Panel
      title="BKT, whole model"
      description={`Three ways to put every player's predictions into one figure (Pelánek, 2017): they can disagree, so all three are shown. Headline: pooled, with a ${bkt.replicates}-replicate cluster bootstrap over players (Schuetze, Yan & Carvalho, 2025).`}
      bodyClassName="p-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>How it is aggregated</TableHead>
            <TableHead>AUC</TableHead>
            <TableHead>RMSE</TableHead>
            <TableHead>Accuracy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-xs font-semibold">Pooled over {bkt.pooled?.n ?? 0} predictions (headline)</TableCell>
            <TableCell className="text-xs font-semibold">{fmt(bkt.pooled?.auc)}</TableCell>
            <TableCell className="text-xs font-semibold">{fmt(bkt.pooled?.rmse)}</TableCell>
            <TableCell className="text-xs font-semibold">{fmt(bkt.pooled?.accuracy)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-xs text-muted-foreground">— its 95% interval (players resampled)</TableCell>
            <TableCell className="text-xs">{interval(bkt.pooledInterval.auc)}</TableCell>
            <TableCell className="text-xs">{interval(bkt.pooledInterval.rmse)}</TableCell>
            <TableCell className="text-xs">{interval(bkt.pooledInterval.accuracy)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-xs text-muted-foreground">— baseline (no model)</TableCell>
            <TableCell className="text-xs">0.500</TableCell>
            <TableCell className="text-xs">{fmt(bkt.pooled?.baselineRmse)}</TableCell>
            <TableCell className="text-xs">{fmt(bkt.pooled?.baselineAccuracy)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-xs">Per-player average, mean ± SD (players)</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perPlayer.auc)}</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perPlayer.rmse)}</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perPlayer.accuracy)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="text-xs">Per-competency average, mean ± SD (competencies)</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perCompetency.auc)}</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perCompetency.rmse)}</TableCell>
            <TableCell className="text-xs">{spreadText(bkt.perCompetency.accuracy)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Panel>
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="By competency" description="Every player's predictions for one competency, pooled." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competency</TableHead>
                <TableHead>Players</TableHead>
                <MetricHeads />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bkt.byCompetency.map(row => (
                <TableRow key={row.competency}>
                  <TableCell className="text-xs font-semibold">{getCompetencyLabel(row.competency)}</TableCell>
                  <TableCell className="text-xs">{row.players}</TableCell>
                  <MetricCells m={row.metrics} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title="By source of the answer" description="Each source has its own guess and slip, so it is worth reading them apart." bodyClassName="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Players</TableHead>
                  <MetricHeads />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bkt.bySource.map(row => (
                  <TableRow key={row.source}>
                    <TableCell className="text-xs font-semibold">{SOURCE_LABEL[row.source]}</TableCell>
                    <TableCell className="text-xs">{row.players}</TableCell>
                    <MetricCells m={row.metrics} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel title="Calibration" description={`When BKT says 0.7, are about 70% right? Expected calibration error ${fmt(bkt.calibration.ece)}.`} bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Predicted</TableHead>
                <TableHead>Answers</TableHead>
                <TableHead>Mean predicted</TableHead>
                <TableHead>Share right</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bkt.calibration.bins
                .filter(bin => bin.n > 0)
                .map(bin => (
                  <TableRow key={bin.from}>
                    <TableCell className="font-mono text-xs">
                      {bin.from.toFixed(1)}–{bin.to.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-xs">{bin.n}</TableCell>
                    <TableCell className="text-xs">{fmt(bin.meanPredicted, 2)}</TableCell>
                    <TableCell className="text-xs">{fmt(bin.observedRate, 2)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  </div>
);

const PerPlayer = ({ bkt }: { bkt: BktEvaluation }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel
      title="BKT per player"
      description="Each player's own predictions. Click a player for the figures by source and by competency. A player with few answers, or answers all right or all wrong, has no stable AUC."
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <MetricHeads />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bkt.players.map(player => (
              <Fragment key={player.uid}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === player.uid ? null : player.uid)}>
                  <TableCell className="font-mono text-xs">{player.label}</TableCell>
                  <MetricCells m={player} />
                </TableRow>
                {open === player.uid && (
                  <>
                    {PREDICTION_SOURCES.filter(source => player.bySource[source]).map(source => (
                      <TableRow key={source} className="bg-muted/30">
                        <TableCell className="pl-6 text-xs text-muted-foreground">{SOURCE_LABEL[source]}</TableCell>
                        <MetricCells m={player.bySource[source] ?? null} />
                      </TableRow>
                    ))}
                    {COMPETENCIES.filter(c => player.byCompetency[c]).map(c => (
                      <TableRow key={c} className="bg-muted/30">
                        <TableCell className="pl-6 text-xs text-muted-foreground">{getCompetencyLabel(c)}</TableCell>
                        <MetricCells m={player.byCompetency[c]} />
                      </TableRow>
                    ))}
                  </>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
};

const Quarters = ({ rows }: { rows: { n: number; mean: number | null }[] }) => (
  <span className="font-mono">{rows.map((q, i) => `Q${i + 1} ${fmt(q.mean)} (${q.n})`).join(' · ')}</span>
);

const Policy = ({ course, convergence }: { course: CourseAdmin; convergence: QConvergence | null }) => {
  const policy = useMemo(() => evaluateCoursePolicy(course.courseLogs), [course.courseLogs]);
  if (policy.decisions === 0) {
    return <EmptyState icon={LineChart} title="No decisions yet">The first decision is made after a player's first drive in Level 1.</EmptyState>;
  }
  return (
    <div className="space-y-4">
      <Legend title="Legend: Q-learning metrics" items={Q_LEGEND} />
      <Panel title="How the policy behaved" description="From every player's course log.">
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Decisions</dt>
            <dd className="text-muted-foreground">
              {policy.decisions}: {policy.selection.explore} explore · {policy.selection.exploit} exploit · {policy.selection.forced} forced
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Learned-decision share</dt>
            <dd className="text-muted-foreground">Exploited {share(policy.selection.exploit, policy.choices)} of the choices</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Differs from the fallback rule</dt>
            <dd className="text-muted-foreground">
              All choices: {share(policy.disagreement.all, policy.choices)} · when exploiting: {share(policy.disagreement.exploit, policy.disagreement.exploitChoices)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Illegal actions (must be 0)</dt>
            <dd className={policy.illegal ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{policy.illegal}</dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Coverage of the {policy.coverage.pairs} legal pairs</dt>
            <dd className="text-muted-foreground">
              {policy.coverage.chosen} chosen · {policy.coverage.explored} through the first exploration · {policy.coverage.rewarded} rewarded
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Mean reward by quarter ({policy.rewards} rewards, oldest first)</dt>
            <dd className="text-muted-foreground">
              <Quarters rows={policy.rewardQuarters} />
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Reward by state and action" description="Mean reward with a 95% interval from resampling players. An interval needs rewards from at least two players." bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>State</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Chosen</TableHead>
              <TableHead>Rewarded</TableHead>
              <TableHead>Players</TableHead>
              <TableHead>Mean r</TableHead>
              <TableHead>95% interval</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policy.outcomes.map(row => (
              <TableRow key={`${row.state}-${row.action}`}>
                <TableCell className="font-mono text-xs">{row.state}</TableCell>
                <TableCell className="text-xs">{row.action}</TableCell>
                <TableCell className="text-xs">{row.chosen}</TableCell>
                <TableCell className="text-xs">{row.rewarded}</TableCell>
                <TableCell className="text-xs">{row.players}</TableCell>
                <TableCell className="text-xs font-semibold">{fmt(row.meanReward)}</TableCell>
                <TableCell className="text-xs">{interval(row.interval)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {convergence ? (
        <Panel
          title="Convergence and stability"
          description={`From the shared table's update log: ${convergence.learnUpdates} learning update(s). Mean |ΔQ| by quarter, oldest first; the last ten average ${fmt(convergence.lastTen)}.`}
          bodyClassName="p-0"
        >
          <p className="px-4 py-3 text-xs text-muted-foreground">
            <Quarters rows={convergence.deltaQuarters} />
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Leader now</TableHead>
                <TableHead>Leader changes</TableHead>
                <TableHead>Table updates since the last change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convergence.stability.map(row => (
                <TableRow key={row.state}>
                  <TableCell className="font-mono text-xs">{row.state}</TableCell>
                  <TableCell className="text-xs">{row.leader ?? '–'}</TableCell>
                  <TableCell className="text-xs">{row.changes}</TableCell>
                  <TableCell className="text-xs">{row.updatesSinceChange ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : (
        <Notice>Load the logs (top right) for convergence and leader stability: they come from the shared table's update log.</Notice>
      )}
    </div>
  );
};

export const EvaluationSection = ({ course, logs }: { course: CourseAdmin; logs: EvaluationLogs }) => {
  const [view, setView] = useState<'model' | 'players' | 'policy'>('model');
  const labels = useMemo(
    () => new Map([...course.mastery.map(row => [row.uid, row.label] as const), ...course.players.map(row => [row.uid, row.label] as const)]),
    [course.mastery, course.players]
  );
  const bkt = useMemo(
    () => (logs.data ? evaluateBkt(logs.data.bktUpdates, uid => labels.get(uid) ?? uid.slice(0, 8)) : null),
    [logs.data, labels]
  );
  const convergence = useMemo(() => (logs.data ? evaluateConvergence(logs.data.qUpdates) : null), [logs.data]);

  const needLogs = (
    <EmptyState icon={LineChart} title={logs.loading ? 'Reading the logs…' : 'The logs are not loaded'}>
      BKT is evaluated from its update log: one record per answer, per player. Press “Load the logs” to read them (a large read, so it is not done on its own).
    </EmptyState>
  );
  const noAnswers = <EmptyState icon={LineChart} title="No BKT updates logged yet">A player appears after their pre-test, a short quiz or a drive.</EmptyState>;
  const bktView = (body: (bkt: BktEvaluation) => React.ReactNode) =>
    !bkt ? needLogs : bkt.players.length === 0 ? noAnswers : (
      <div className="space-y-4">
        <Legend title="Legend: BKT metrics" items={BKT_LEGEND} />
        {bkt.skipped > 0 && <Notice>{bkt.skipped} log entr{bkt.skipped === 1 ? 'y was' : 'ies were'} left out: no usable prediction or answer.</Notice>}
        {body(bkt)}
      </div>
    );

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Model evaluation"
        description="How well BKT predicted each answer before it read it, per player and for the whole model, and how the Q-learning policy behaved. Real players only; nothing is simulated or refitted."
        meta={logs.data ? `Logs read ${toDateTime(logs.data.loadedAt)}: ${logs.data.bktUpdates.length} BKT update(s), ${logs.data.qUpdates.length} table update(s)` : 'Logs not loaded'}
        actions={
          <div className="flex gap-2">
            <Button size="sm" aria-label="Load the logs" onClick={logs.load} disabled={logs.loading}>
              <Download className="mr-2 h-4 w-4" />
              {logs.loading ? 'Reading…' : logs.data ? 'Reload the logs' : 'Load the logs'}
            </Button>
            <Button variant="outline" size="sm" onClick={course.refresh} disabled={course.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />
      {logs.error && <Notice tone="error">{logs.error}</Notice>}
      {course.error && <Notice tone="error">{course.error}</Notice>}
      <SectionTabs
        value={view}
        onChange={setView}
        options={[
          { value: 'model', label: 'BKT: whole model' },
          { value: 'players', label: 'BKT: per player' },
          { value: 'policy', label: 'Q-learning' },
        ]}
      />
      {view === 'model' && bktView(result => <WholeModel bkt={result} />)}
      {view === 'players' && bktView(result => <PerPlayer bkt={result} />)}
      {view === 'policy' && <Policy course={course} convergence={convergence} />}
      <p className="text-xs text-muted-foreground">
        The pre-test and post-test items are evaluated on the <Link to="/admin/irt" className="underline">IRT page</Link>. Not here yet, as they need the post-test of the main study: BKT against the post-test per competency, and the slip sensitivity check.
      </p>
    </div>
  );
};
