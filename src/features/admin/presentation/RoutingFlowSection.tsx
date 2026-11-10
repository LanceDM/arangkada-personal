/**
 * Routing flow: the machine that decides, after each level, which level comes
 * next and what is added to it. Three tabs:
 * - **The machine**: drawn from its own table, with the table's rows in its
 *   own words;
 * - **One participant**: their path through it, move by move;
 * - **Pool**: how often each move was taken, per group.
 *
 * Read only, and process only: moves and what they added, never a score.
 */
import { useMemo, useState } from 'react';
import { Network, RefreshCw, Route, Users } from 'lucide-react';

import { getCompetencyLabel } from '@/domain/learner/profile';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { RoutingFlowState, RoutingFlowView } from '@/features/admin/application/useRoutingFlow';
import type { FlowCounts, FlowGroup, PoolFlow } from '@/features/admin/domain/routingFlow';
import type { RoutingGraph } from '@/features/admin/domain/routingGraph';
import { EmptyState, Notice, Panel, SectionHeader, SectionTabs, StatTile } from './adminUi';
import { RoutingBoard } from './RoutingBoard';
import { RoutingPathPanel } from './RoutingPathPanel';
import { GROUP_LABEL } from './routingFormat';
import { edgeShape, placeStops, type EdgeShape } from './routingBoardMap';
import { toShortDateTime } from './formatDate';

const VIEWS: ReadonlyArray<{ value: RoutingFlowView; label: string }> = [
  { value: 'machine', label: 'The machine' },
  { value: 'participant', label: 'One participant' },
  { value: 'pool', label: 'Pool' },
];

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[16rem]';

const SHAPE_WORDS: Record<EdgeShape['kind'], string> = {
  road: 'a stretch of the course road',
  loop: 'a count on its stop',
  detour: 'a detour to or from the review lane',
};

const KIND_WORDS: Record<string, string> = { DRIVE: 'a level', REVIEW: 'a review', FINAL: 'the Final Mission', CERTIFIED: 'certified' };

// --- the machine ------------------------------------------------------------------

const MachineView = ({ graph }: { graph: RoutingGraph }) => {
  const [showAll, setShowAll] = useState(true);
  const stops = useMemo(() => placeStops(graph), [graph]);
  const everyStop = useMemo(() => new Set(graph.stops.map(stop => stop.id)), [graph]);
  const rows = useMemo(
    () =>
      graph.rows.map(row => {
        const edges = graph.edges.filter(edge => edge.row === row.row);
        const shapes = [...new Set(edges.map(edge => edgeShape(edge, stops).kind))];
        const leadsTo = [...new Set(edges.map(edge => (edge.from === edge.to ? 'the same stop' : KIND_WORDS[stops[edge.to].kind])))];
        return { ...row, labels: new Set(edges.flatMap(edge => edge.labels)).size, shapes, leadsTo };
      }),
    [graph, stops]
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Stops" value={graph.stops.length} hint={`standing for the machine's ${graph.stateCount} states`} icon={Network} />
        <StatTile label="Rows of the table" value={graph.rows.length} />
        <StatTile label="Move labels" value={graph.labelCount} hint="every move the table can name" />
        <StatTile label="Roads" value={graph.edges.length} hint="row × from × to, as drawn" />
      </div>
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            The routing FSM, from its own table
          </span>
        }
        description="Each level of the course is a stop on one road, then the Final Mission and certification; under it runs the review lane. A review stop stands for every place a review can return to. Every road is a move the table offers somewhere, found by asking the table itself."
        actions={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />
            Every review detour
          </label>
        }
      >
        <RoutingBoard
          graph={graph}
          counts={{ edges: {}, practice: {} }}
          reached={everyStop}
          current={null}
          showAll={showAll}
          label="The routing FSM as a board: every stop, and every road its table offers"
        />
      </Panel>
      <Panel title="The seven rows" description="The table as the machine holds it, tried in this order. The guards are the table's own words." bodyClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="whitespace-nowrap">
                <TableHead>Row</TableHead>
                <TableHead>Leaves</TableHead>
                <TableHead>On</TableHead>
                <TableHead>Leads to</TableHead>
                <TableHead className="min-w-[18rem]">Guard; what may be added</TableHead>
                <TableHead>Labels</TableHead>
                <TableHead>On the board</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.row} data-row={row.row}>
                  <TableCell className="whitespace-nowrap font-medium">{row.row}</TableCell>
                  <TableCell>
                    <code className="font-mono text-xs">{row.from}</code> · {row.where}
                  </TableCell>
                  <TableCell>{row.on}</TableCell>
                  <TableCell>{row.leadsTo.join(', ')}</TableCell>
                  <TableCell className="text-muted-foreground">{row.guard}</TableCell>
                  <TableCell className="tabular-nums">{row.labels}</TableCell>
                  <TableCell>{row.shapes.map(shape => SHAPE_WORDS[shape]).join('; ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </div>
  );
};

// --- one participant --------------------------------------------------------------

const ParticipantView = ({ flow }: { flow: RoutingFlowState }) => (
  <div className="space-y-4">
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Account
      <select
        aria-label="Account"
        value={flow.account?.code ?? ''}
        onChange={event => flow.selectAccount(event.target.value || null)}
        className={SELECT_CLASS}
      >
        <option value="">Choose a participant</option>
        {flow.accounts.map(account => (
          <option key={account.code} value={account.code}>
            {account.code} · {account.cohort} · {account.group ? GROUP_LABEL[account.group] : 'no group'}
            {account.moves !== null ? ` · ${account.moves} move${account.moves === 1 ? '' : 's'}` : ''}
          </option>
        ))}
      </select>
    </label>
    {flow.account?.error && <Notice tone="error">This account's last read failed: {flow.account.error}</Notice>}
    {flow.account && flow.path ? (
      <RoutingPathPanel key={flow.account.code} graph={flow.graph} path={flow.path} code={flow.account.code} />
    ) : (
      <Panel>
        <EmptyState icon={Route} title="Choose a participant">
          {flow.records.loading && !flow.records.readAt ? 'The records are being read.' : 'Pool accounts are listed by code, with their group.'}
        </EmptyState>
      </Panel>
    )}
  </div>
);

// --- the pool ---------------------------------------------------------------------

const scopeLabel = (scope: FlowGroup | 'all') => (scope === 'all' ? 'All participants' : GROUP_LABEL[scope]);

const CountTable = ({
  caption,
  pool,
  rows,
}: {
  caption: string;
  pool: PoolFlow;
  rows: Array<{ key: string; label: string; count: (counts: FlowCounts) => number }>;
}) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="whitespace-nowrap">
          <TableHead>{caption}</TableHead>
          {pool.groups.map(({ group }) => (
            <TableHead key={group} className="text-right">
              {GROUP_LABEL[group]}
            </TableHead>
          ))}
          <TableHead className="text-right">All</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.key} data-count-row={row.key}>
            <TableCell>{row.label}</TableCell>
            {pool.groups.map(({ group, counts }) => (
              <TableCell key={group} data-group={group} className={cn('text-right tabular-nums', row.count(counts) === 0 && 'text-muted-foreground')}>
                {row.count(counts)}
              </TableCell>
            ))}
            <TableCell data-group="all" className="text-right font-medium tabular-nums">
              {row.count(pool.all)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const PoolView = ({ flow }: { flow: RoutingFlowState }) => {
  const { pool, graph } = flow;
  const [scope, setScope] = useState<FlowGroup | 'all'>('all');
  const counts = scope === 'all' ? pool.all : (pool.groups.find(entry => entry.group === scope)?.counts ?? pool.all);
  const reached = useMemo(
    () => new Set(graph.edges.filter(edge => (counts.edges[edge.key] ?? 0) > 0).flatMap(edge => [edge.from, edge.to])),
    [graph, counts]
  );
  const reviews = pool.all.reviewsBy;
  const found = (counts: FlowCounts, level: number, competency: string) =>
    counts.reviewsBy.find(review => review.level === level && review.competency === competency)?.count ?? 0;

  if (pool.all.accounts === 0) {
    return (
      <Panel>
        <EmptyState icon={Users} title="No participant read yet">
          {flow.records.loading ? 'The records are being read.' : 'No study participant has records yet.'}
        </EmptyState>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      <Notice>
        Process counts only: the moves the routing FSM took and what they added, never a score. The study cohort only;{' '}
        {pool.othersLeftOut} dry-run or test account{pool.othersLeftOut === 1 ? ' is' : 's are'} left out, as the analysis
        leaves them out. A move is counted for the group the account was assigned.
      </Notice>
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Every move, on the board
          </span>
        }
        description="Each road carries how often it was taken; a retry is a count on its stop, and an orange count is how many of those moves added a practice item."
        actions={
          <div role="radiogroup" aria-label="Whose moves" className="flex flex-wrap gap-1">
            {(['all', ...pool.groups.map(entry => entry.group)] as const).map(option => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={scope === option}
                onClick={() => setScope(option)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  scope === option ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {scopeLabel(option)}
              </button>
            ))}
          </div>
        }
      >
        <RoutingBoard
          graph={graph}
          counts={{ edges: counts.edges, practice: counts.practiceEdges }}
          reached={reached}
          current={null}
          showAll={false}
          label={`The routing FSM as a board, with how often each move was taken: ${scopeLabel(scope)}`}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {scopeLabel(scope)}: {counts.accounts} participant{counts.accounts === 1 ? '' : 's'}, {counts.moves} move{counts.moves === 1 ? '' : 's'}.
        </p>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Moves by row" description="Every move in the participants' routing logs, by the row of the table it was taken on." bodyClassName="p-0">
          <CountTable
            caption="Row"
            pool={pool}
            rows={[
              { key: 'participants', label: 'Participants', count: counts => counts.accounts },
              ...graph.rows.map(row => ({ key: row.row, label: row.row, count: (counts: FlowCounts) => counts.byRow.find(entry => entry.row === row.row)?.count ?? 0 })),
              { key: 'moves', label: 'All moves', count: counts => counts.moves },
            ]}
          />
        </Panel>
        <Panel title="What the moves added" description="A move adds nothing, a practice item on one competency, or a review of a passed level." bodyClassName="p-0">
          <CountTable
            caption="Added"
            pool={pool}
            rows={[
              { key: 'plain', label: 'Nothing added', count: counts => counts.plain },
              { key: 'practice', label: 'A practice item', count: counts => counts.practice },
              { key: 'reviews', label: 'A review', count: counts => counts.reviews },
              { key: 'asked', label: 'Chosen by the table (Optimized)', count: counts => counts.asked },
            ]}
          />
        </Panel>
        <Panel title="Practice items by competency" description="The competency each practice item was added for." bodyClassName="p-0">
          <CountTable
            caption="Competency"
            pool={pool}
            rows={pool.all.practiceBy.map(({ competency }) => ({
              key: competency,
              label: getCompetencyLabel(competency),
              count: (counts: FlowCounts) => counts.practiceBy.find(entry => entry.competency === competency)?.count ?? 0,
            }))}
          />
        </Panel>
        <Panel title="Reviews by level and competency" description="The level each review replayed, and the competency it was for." bodyClassName={reviews.length ? 'p-0' : undefined}>
          {reviews.length === 0 ? (
            <EmptyState title="No review was taken" />
          ) : (
            <CountTable
              caption="Review"
              pool={pool}
              rows={reviews.map(review => ({
                key: `${review.level}|${review.competency}`,
                label: `Level ${review.level} for ${getCompetencyLabel(review.competency)}`,
                count: (counts: FlowCounts) => found(counts, review.level, review.competency),
              }))}
            />
          )}
        </Panel>
      </div>
    </div>
  );
};

// --- the section ------------------------------------------------------------------

export const RoutingFlowSection = ({ flow }: { flow: RoutingFlowState }) => {
  const { records } = flow;
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Routing flow"
        description="The routing FSM decides, after each level, which level comes next and what is added to it: advance or retry by the pass guard, and in the Optimized group a practice item or a review where the table chooses one. Read only."
        meta={
          records.progress
            ? `Reading records: ${records.progress.done} of ${records.progress.total} accounts`
            : records.readAt
              ? `Records read ${toShortDateTime(records.readAt)}`
              : null
        }
        actions={
          <Button size="sm" variant="outline" onClick={records.refresh} disabled={records.loading}>
            <RefreshCw className={cn('h-4 w-4', records.loading && 'animate-spin')} />
            Refresh records
          </Button>
        }
      />
      {records.error && <Notice tone="error">The records could not be read: {records.error}</Notice>}
      <SectionTabs value={flow.view} onChange={flow.selectView} options={VIEWS} />
      {flow.view === 'machine' && <MachineView graph={flow.graph} />}
      {flow.view === 'participant' && <ParticipantView flow={flow} />}
      {flow.view === 'pool' && <PoolView flow={flow} />}
    </div>
  );
};
