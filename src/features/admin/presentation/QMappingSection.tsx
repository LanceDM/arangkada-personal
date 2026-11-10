/**
 * Q-learning mapping: the table the Optimized group's routing plays, as a
 * game board of its 36 states, each tile coloured by what it tries first.
 * Three tabs:
 * - **The table**: click a tile to read its whole order;
 * - **One participant**: each choice it made for an Optimized account, stepped;
 * - **Pool visits**: how often each state was read, and what it took there.
 *
 * Read only, and process only. The table was trained in simulation and is
 * only read here, as the game reads it.
 */
import { useState, type ReactNode } from 'react';
import { BrainCircuit, FlaskConical, Grid3x3, RefreshCw } from 'lucide-react';

import { MASTERY_BUCKETS } from '@/domain/learner/adaptive/qLearningPolicy';
import { BUDGET_LEFT, ROUTING_ACTIONS, ROUTING_STAGES, type RoutingQState } from '@/domain/learner/adaptive/routingQPolicy';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import type { QMappingState, QMappingView } from '@/features/admin/application/useQMapping';
import { ACTION_LABEL, type QDimensionLabels, type QGridRow, type QStateVisits } from '@/features/admin/domain/qMapping';
import { EmptyState, Notice, Panel, SectionHeader, SectionTabs, StatTile } from './adminUi';
import { QChoicePanel } from './QChoicePanel';
import { BoardScreen } from './boardControls';
import { QBoard, QStateCard } from './QBoard';
import { toShortDateTime } from './formatDate';

const VIEWS: ReadonlyArray<{ value: QMappingView; label: string }> = [
  { value: 'table', label: 'The table' },
  { value: 'participant', label: 'One participant' },
  { value: 'pool', label: 'Pool visits' },
];

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[16rem]';

const Definition = ({ term, children }: { term: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium text-foreground">{term}</dt>
    <dd className="mt-0.5 text-xs text-muted-foreground">{children}</dd>
  </div>
);

const HowToRead = ({ labels }: { labels: QDimensionLabels }) => (
  <Panel
    title="How to read it"
    description="A state is what the table reads after a level ends: four things, each with a few values. An action is what it may add to the move the pass guard already decided."
  >
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Definition term="Stage: the level just played">
        {ROUTING_STAGES.map(stage => `${labels.stage[stage].label}, ${labels.stage[stage].levels}`).join(' · ')}
      </Definition>
      <Definition term="Weakest competency's mastery (BKT)">
        {MASTERY_BUCKETS.map(bucket => `${labels.mastery[bucket].label}, ${labels.mastery[bucket].range}`).join(' · ')}. The
        weakest is read over the account's whole history, ties to the least observed.
      </Definition>
      <Definition term="The level just played">Passed or failed: the verdict handed to the routing FSM.</Definition>
      <Definition term="Budget left">
        {BUDGET_LEFT.map(bucket => `${labels.budget[bucket].label}: ${labels.budget[bucket].range}`).join(' · ')}. Graded
        decisions of course entries; free replays and the post-test are not counted.
      </Definition>
    </dl>
    <dl className="mt-5 grid gap-4 border-t border-border pt-4 md:grid-cols-2 xl:grid-cols-4">
      {ROUTING_ACTIONS.map(action => (
        <Definition key={action} term={ACTION_LABEL[action].label}>
          {ACTION_LABEL[action].detail}
        </Definition>
      ))}
    </dl>
    <p className="mt-4 text-xs text-muted-foreground">
      An action is <b className="font-medium text-foreground">masked</b> where the routing FSM lists no such move, and is then
      never taken. The table is asked only where at least two of its actions are legal; everywhere else the plain move is
      taken without asking. A row lists the actions training tried in that state, best first, and ends at Nothing added;
      the first legal one is taken. A row training never reached is empty, so it takes the plain move.
    </p>
  </Panel>
);

/** A state's four parts, as a card's heading. */
const stateHeading = (row: QGridRow, labels: QDimensionLabels) =>
  [labels.stage[row.stage].label, labels.mastery[row.mastery].label, labels.outcome[row.outcome].label, labels.budget[row.budget].label]
    .join(' · ')
    .toUpperCase();

/** The board with one tile's card under it: the whole table, or the pool's visits. */
const TableBoard = ({
  rows,
  labels,
  visits,
}: {
  rows: readonly QGridRow[];
  labels: QDimensionLabels;
  visits?: Readonly<Record<string, QStateVisits>>;
}) => {
  const [selected, setSelected] = useState<RoutingQState>(() => (rows.find(row => !row.untrained) ?? rows[0]).state);
  const row = rows.find(each => each.state === selected) ?? rows[0];
  const counts = visits && Object.fromEntries(Object.entries(visits).map(([state, read]) => [state, read.visits]));
  const read = visits?.[row.state];
  return (
    <BoardScreen>
      <QBoard
        rows={rows}
        labels={labels}
        selected={row.state}
        onSelect={setSelected}
        counts={counts}
        label={visits ? 'The table as a board, with how often each state was read' : 'The table as a board: click a tile to read its order'}
      />
      <QStateCard
        row={row}
        labels={labels}
        heading={stateHeading(row, labels)}
        takenCounts={read?.taken}
        details={
          visits ? (
            <p className="text-xs text-[#C7CCE0]" data-read={read?.visits ?? 0}>
              Read {read?.visits ?? 0} time{read?.visits === 1 ? '' : 's'} by the Optimized participants.
            </p>
          ) : undefined
        }
      />
    </BoardScreen>
  );
};

export const QMappingSection = ({ q }: { q: QMappingState }) => {
  const { records, designated, labels } = q;
  const table = designated.status === 'ready' ? designated.table : null;
  const untrained = q.grid.filter(row => row.untrained).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Q-learning mapping"
        description="The table the Optimized group's routing plays: for each of its 36 states, the order in which it tries its four actions. Read only."
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
      <div className="flex gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground" role="note">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <b className="font-semibold">Trained in simulation, and never retrained in the game.</b>{' '}
          {table ? (
            <>
              This is table <code className="rounded bg-muted px-1 font-mono text-xs">{table.tableId}</code>, trained on simulated
              learners before the pilot (training seed {table.seed}, at a budget of {table.budgetSize} graded decisions). The game
              reads it from the results file exactly as recorded, checked against its id, and nothing in the game writes or
              updates it: what players do never changes it.
            </>
          ) : (
            'The game reads it from the results file exactly as recorded, checked against its id, and nothing in the game writes or updates it.'
          )}
        </p>
      </div>
      {records.error && <Notice tone="error">The records could not be read: {records.error}</Notice>}
      {designated.status === 'error' && <Notice tone="error">The table could not be read: {designated.error}</Notice>}
      {!table || !labels ? (
        designated.status === 'loading' && <div className="h-64 animate-pulse rounded-xl bg-muted" aria-label="Reading the table" />
      ) : (
        <>
          <HowToRead labels={labels} />
          <SectionTabs value={q.view} onChange={q.selectView} options={VIEWS} />

          {q.view === 'table' && (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Grid3x3 className="h-4 w-4 text-primary" />
                  Table {table.tableId}
                </span>
              }
              description={`Each tile is one of the ${q.grid.length} situations the table can be in, coloured by what it tries first. Click a tile to read its whole order. ${untrained} situations were never reached in training: the plain move.`}
            >
              <TableBoard rows={q.grid} labels={labels} />
            </Panel>
          )}

          {q.view === 'participant' && (
            <div className="space-y-4">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Optimized account
                <select
                  aria-label="Optimized account"
                  value={q.account?.code ?? ''}
                  onChange={event => q.selectAccount(event.target.value || null)}
                  className={SELECT_CLASS}
                >
                  <option value="">{q.accounts.length === 0 ? 'No Optimized account read yet' : 'Choose an Optimized participant'}</option>
                  {q.accounts.map(account => (
                    <option key={account.code} value={account.code}>
                      {account.code} · {account.cohort}
                    </option>
                  ))}
                </select>
              </label>
              {q.account && q.choices ? (
                <QChoicePanel key={q.account.code} rows={q.grid} labels={labels} read={q.choices} code={q.account.code} />
              ) : (
                <Panel>
                  <EmptyState icon={BrainCircuit} title="Choose an Optimized participant">
                    Only the Optimized group's moves are chosen by the table; a Conventional account always takes the plain move.
                  </EmptyState>
                </Panel>
              )}
            </div>
          )}

          {q.view === 'pool' && q.pool && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Optimized participants" value={q.pool.accounts} />
                <StatTile label="Choices on the table" value={q.pool.choices} />
                <StatTile label="Plain moves, not asked" value={q.pool.unasked} hint="fewer than two actions legal, or no reading yet" />
                <StatTile
                  label="States read"
                  value={Object.values(q.pool.byState).filter(state => state.visits > 0).length}
                  hint={`of ${q.grid.length}`}
                />
              </div>
              <Panel
                title="Which states were read"
                description="Over every Optimized participant of the study cohort, dry-run and test accounts left out: the count on each tile is how often the table read that state. Click a tile to see how often it took each action there. Process only."
              >
                <TableBoard rows={q.grid} labels={labels} visits={q.pool.byState} />
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
};
