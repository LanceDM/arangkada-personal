/**
 * Replay: one attempt as it was recorded, step by step. A pilot pool account
 * or any other signed-in player, one of their attempts, then the driving FSM's
 * log played on a game board beside its list of steps (`FsmReplayPanel`),
 * every decision, and the attempt's routing record.
 *
 * Read only. The pickers name an attempt by its level, kind, time and number
 * of decisions, never its score, and nothing here sets one account or group
 * beside another.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, History, ListChecks, RefreshCw, Route } from 'lucide-react';

import { getCompetencyLabel } from '@/domain/learner/profile';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { AttemptReplayState } from '@/features/admin/application/useAttemptReplay';
import {
  KIND_LABEL,
  matchesReplayPlayer,
  type AttemptSummary,
  type DecisionRow,
  type LevelEntrySummary,
  type RoutingSummary,
} from '@/features/admin/domain/attemptReplay';
import { visibleSteps } from '@/features/admin/domain/replayTimeline';
import { EmptyState, Notice, Panel, SearchField, SectionHeader } from './adminUi';
import { FsmReplayPanel } from './FsmReplayPanel';
import { durationLabel, thetaLabel as theta } from './replayFormat';
import { toShortDateTime } from './formatDate';

const GROUP_LABEL: Record<string, string> = { conventional: 'Conventional', optimized: 'Optimized', legacy: 'Legacy' };

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[16rem]';

const percent = (value: number | null) => (value === null ? '-' : `${Math.round(value * 100)}%`);

/** One label and its value, as the attempt and routing panels list them. */
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
  </div>
);

const Code = ({ children }: { children: ReactNode }) => (
  <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>
);

// --- the pickers ------------------------------------------------------------------

const tabClass =
  'rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const PilotPicker = ({ replay }: { replay: AttemptReplayState }) => (
  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
    Account
    <select
      aria-label="Account"
      value={replay.pilot.account?.code ?? ''}
      onChange={event => replay.selectAccount(event.target.value || null)}
      className={SELECT_CLASS}
    >
      <option value="">Choose a participant</option>
      {replay.pilot.accounts.map(account => (
        <option key={account.code} value={account.code}>
          {account.code} · {account.cohort} · {plural(account.attempts, 'attempt')}
        </option>
      ))}
    </select>
  </label>
);

const PlayerPicker = ({ replay }: { replay: AttemptReplayState }) => {
  const [query, setQuery] = useState('');
  const { list, player } = replay.players;
  // The chosen player stays listed whatever the search says.
  const shown = list.filter(entry => entry.uid === player?.uid || matchesReplayPlayer(entry, query));
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Search
        <SearchField label="Search players" placeholder="Username or email" value={query} onChange={setQuery} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Player
        <select
          aria-label="Player"
          value={player?.uid ?? ''}
          onChange={event => replay.selectPlayer(event.target.value || null)}
          className={SELECT_CLASS}
        >
          <option value="">{list.length === 0 ? 'No players' : `Choose a player (${shown.length} of ${list.length})`}</option>
          {shown.map(entry => (
            <option key={entry.uid} value={entry.uid}>
              {entry.name}
              {entry.email && entry.email !== entry.name ? ` · ${entry.email}` : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};

const AttemptPicker = ({ replay }: { replay: AttemptReplayState }) => {
  const chosen = replay.view === 'players' ? replay.players.player : replay.pilot.account;
  const index = replay.attempts.findIndex(item => item.id === replay.attemptId);
  const step = (by: number) => {
    const next = replay.attempts[index + by];
    if (next) replay.selectAttempt(next.id);
  };
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Attempt
        <select
          aria-label="Attempt"
          value={index >= 0 ? replay.attemptId! : ''}
          disabled={!chosen || replay.attempts.length === 0}
          onChange={event => replay.selectAttempt(event.target.value || null)}
          className={SELECT_CLASS}
        >
          <option value="">
            {replay.attemptsLoading ? 'Reading attempts…' : replay.attempts.length === 0 ? 'No attempts' : 'Choose an attempt'}
          </option>
          {replay.attempts.map(item => (
            <option key={item.id} value={item.id}>
              #{item.number} · {item.level}
              {item.kind ? ` · ${KIND_LABEL[item.kind]}` : ''} · {toShortDateTime(item.savedAt)} · {plural(item.decisions, 'decision')}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={index <= 0} onClick={() => step(-1)} aria-label="Previous attempt">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={index < 0 || index >= replay.attempts.length - 1}
          onClick={() => step(1)}
          aria-label="Next attempt"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
};

const Pickers = ({ replay }: { replay: AttemptReplayState }) => (
  <div className="space-y-4">
    <Tabs value={replay.view} onValueChange={value => replay.selectView(value as AttemptReplayState['view'])}>
      <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
        <TabsTrigger value="pilot" className={tabClass}>
          Pilot accounts
        </TabsTrigger>
        <TabsTrigger value="players" className={tabClass}>
          Players
        </TabsTrigger>
      </TabsList>
    </Tabs>
    <p className="text-xs text-muted-foreground">
      {replay.view === 'players'
        ? "Every signed-in account outside the pilot pool, admins included. A player's attempts are read when the player is chosen, and an attempt's records when it is opened."
        : 'The pilot pool, by code: the same records the Overview reads.'}
    </p>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      {replay.view === 'players' ? <PlayerPicker replay={replay} /> : <PilotPicker replay={replay} />}
      <AttemptPicker replay={replay} />
    </div>
  </div>
);

// --- the attempt ------------------------------------------------------------------

const RecordBadge = ({ name, record }: { name: string; record: AttemptSummary['records']['fsm'] }) => (
  <Badge variant={record.present ? 'secondary' : 'destructive'} className="font-normal">
    {name}: {record.present ? (record.truncated ? 'cut to fit' : 'whole') : 'missing'}
  </Badge>
);

const AttemptHeader = ({ summary }: { summary: AttemptSummary }) => (
  <Panel
    title={`Attempt #${summary.item.number} · ${summary.item.level}`}
    description={summary.item.kind ? KIND_LABEL[summary.item.kind] : undefined}
  >
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Field label="Saved">{toShortDateTime(summary.item.savedAt)}</Field>
      <Field label="Drive time">{durationLabel(summary.durationMs)}</Field>
      <Field label="Decisions logged">{summary.item.decisions}</Field>
      <Field label="Attempt seed">{summary.seed ?? '-'}</Field>
    </dl>
    <div className="mt-4 flex flex-wrap gap-2">
      <RecordBadge name="FSM log" record={summary.records.fsm} />
      <RecordBadge name="Decision record" record={summary.records.decisions} />
      <RecordBadge name="Routing record" record={summary.records.routing} />
    </div>
  </Panel>
);

// --- the decisions ------------------------------------------------------------------

const VERDICT: Record<DecisionRow['verdict'], { label: string; className: string }> = {
  correct: { label: 'Correct', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  violation: { label: 'Violation', className: 'border-destructive/40 bg-destructive/10 text-destructive' },
  neutral: { label: 'Neutral', className: 'border-border bg-muted text-muted-foreground' },
};

const responseLabel = (row: DecisionRow) =>
  row.response.kind === 'timed' ? `${row.response.ms.toLocaleString()} ms` : row.response.kind === 'censored' ? 'Window closed' : '-';

const LevelEntry = ({ entry }: { entry: LevelEntrySummary }) => (
  <dl className="grid grid-cols-2 gap-4 border-b border-border p-4 sm:grid-cols-4">
    <Field label="Played at">
      {entry.applied ? `h ${entry.applied.support} · θ ${theta(entry.applied.approachScale)}` : 'Not recorded'}
    </Field>
    <Field label="Asked for">
      {entry.requested && (entry.requested.support || entry.requested.approachScale !== null)
        ? `h ${entry.requested.support ?? '-'} · θ ${entry.requested.approachScale === null ? '-' : theta(entry.requested.approachScale)}`
        : 'Nothing'}
    </Field>
    <Field label="Practice policy">{entry.source === 'routing' ? 'Not consulted (routing)' : (entry.source ?? 'Not recorded')}</Field>
    <Field label="Re-rolls during the drive">
      {entry.rerolls.length === 0
        ? 'None'
        : entry.rerolls.map(reroll => `after #${reroll.afterDecision + 1} toward ${getCompetencyLabel(reroll.competency)}`).join('; ')}
    </Field>
  </dl>
);

const DecisionsPanel = ({ rows, entry, until }: { rows: DecisionRow[]; entry: LevelEntrySummary; until: number | null }) => {
  const unrecorded = rows.filter(row => !row.recorded).length;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          Decisions ({rows.length})
        </span>
      }
      description="Every logged decision, in the order it was made, with what the decision record kept for it. Decisions after the selected step are faded."
      bodyClassName="p-0"
    >
      <LevelEntry entry={entry} />
      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title="No decisions logged" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="whitespace-nowrap">
                <TableHead className="w-10">#</TableHead>
                <TableHead className="min-w-[15rem]">Scenario</TableHead>
                <TableHead>Competency</TableHead>
                <TableHead>Settled</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>h</TableHead>
                <TableHead>θ asked → applied</TableHead>
                <TableHead>BKT before → after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow
                  key={row.logIndex}
                  data-later={until !== null && row.at > until ? true : undefined}
                  className={cn(until !== null && row.at > until && 'opacity-45')}
                >
                  <TableCell className="tabular-nums text-muted-foreground">{row.logIndex + 1}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.scenarioId ? <Code>{row.scenarioId}</Code> : <span className="text-muted-foreground">{row.rule ?? '-'}</span>}
                      {row.practiceItem && (
                        <Badge variant="outline" className="font-normal">
                          practice item
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.competency ? getCompetencyLabel(row.competency) : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {[row.kind, row.settlement].filter(Boolean).join(' · ') || '-'}
                  </TableCell>
                  <TableCell>
                    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', VERDICT[row.verdict].className)}>
                      {VERDICT[row.verdict].label}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{responseLabel(row)}</TableCell>
                  <TableCell>{row.support ?? '-'}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.theta ? `${theta(row.theta.requested)} → ${theta(row.theta.effective)}` : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.bkt ? `${percent(row.bkt.before)} → ${percent(row.bkt.after)}` : 'Not recorded'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {unrecorded > 0 && (
        <div className="border-t border-border p-4">
          <Notice>
            {unrecorded} decision{unrecorded === 1 ? ' has' : 's have'} no decision record (missing, or cut to fit): only the
            attempt's own log is shown for {unrecorded === 1 ? 'it' : 'them'}.
          </Notice>
        </div>
      )}
    </Panel>
  );
};

// --- the routing record ---------------------------------------------------------------

const RoutingPanel = ({ routing }: { routing: RoutingSummary }) => {
  const record = routing.record;
  const entry = record?.entry ?? null;
  const observation = entry?.observation ?? null;
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          Routing record
        </span>
      }
      description="What the routing FSM did around this attempt: its kind, the move that led to it, and what was added to it."
    >
      {!record ? (
        <EmptyState icon={Route} title="No routing record">
          This attempt was saved without one, or it has not arrived yet.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="Kind">{KIND_LABEL[routing.kind]}</Field>
            <Field label="Group in effect">
              {GROUP_LABEL[record.groupInEffect] ?? record.groupInEffect}
              {record.override && ' (override)'}
            </Field>
            <Field label="Build">{record.mode === 'legacy' ? 'Legacy' : 'New'}</Field>
            <Field label="Played at">
              h {record.driving.support} · θ {theta(record.driving.approachScale)}
            </Field>
          </dl>

          {entry && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Move that led to it">
                {routing.move ? (
                  <>
                    {routing.move.label} <Code>{routing.move.id}</Code>
                  </>
                ) : (
                  'None: played outside the machine'
                )}
              </Field>
              <Field label="Practice item added">
                {entry.item ? (
                  <>
                    <Code>{entry.item.scenarioId}</Code> · {getCompetencyLabel(entry.item.competency)} · from Level {entry.item.sourceLevelId}
                  </>
                ) : (
                  'None'
                )}
              </Field>
              <Field label="Review">
                {entry.review ? `Level ${entry.review.level} for ${getCompetencyLabel(entry.review.competency)}` : 'None'}
              </Field>
              <Field label="Cursor">
                {entry.cursorBefore && entry.cursorAfter ? (
                  <>
                    <Code>{entry.cursorBefore.state}</Code> → <Code>{entry.cursorAfter.state}</Code>
                  </>
                ) : (
                  'Not moved'
                )}
              </Field>
              {(entry.kind === 'course' || entry.kind === 'review') && (
                <Field label="Verdict handed to the routing FSM">{entry.outcome ?? '-'}</Field>
              )}
              <Field label="Graded decisions counted">
                {entry.gradedDecisions}
                {entry.starts !== null && entry.starts > 1 && ` · entered ${entry.starts} times`}
              </Field>
              {routing.postTestSeed && (
                <Field label="Post-test roll">
                  {routing.postTestSeed.matches
                    ? `The fixed roll (${routing.postTestSeed.fixed})`
                    : `Seed ${routing.postTestSeed.seed ?? '-'}, not the fixed roll ${routing.postTestSeed.fixed}`}
                </Field>
              )}
            </dl>
          )}

          {routing.legal.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Legal moves at the decision ({routing.legal.length})</p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {routing.legal.map(move => (
                  <li key={move.id} title={move.label}>
                    <Code>{move.id}</Code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {observation && (
            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3 lg:grid-cols-4">
              <Field label="Policy asked">{observation.asked ? 'Yes' : 'No: fewer than two of its actions were legal, or not its group'}</Field>
              <Field label="Weakest competency (BKT)">
                {observation.weakest ? `${getCompetencyLabel(observation.weakest)} · ${observation.weakestScore ?? '-'}/100` : 'None'}
              </Field>
              <Field label="Budget">
                {observation.spent} graded decisions
                {observation.size !== null && ` of ${observation.size} (${observation.budgetLeft ?? '-'} left)`}
              </Field>
              <Field label="Q-state → action">
                {observation.qState ? (
                  <>
                    <Code>{observation.qState}</Code> → {observation.action ?? 'plain move'}
                    {observation.row && <span className="text-muted-foreground"> (row {observation.row.join(', ')})</span>}
                  </>
                ) : (
                  '-'
                )}
              </Field>
            </dl>
          )}

          <div>
            <p className="text-xs text-muted-foreground">Routing log entries this attempt added ({routing.log.length})</p>
            {routing.log.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">None</p>
            ) : (
              <ol className="mt-1.5 space-y-1 text-sm">
                {routing.log.map(row => (
                  <li key={row.seq} className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">#{row.seq}</span>
                    <Code>{row.from}</Code>→<Code>{row.to}</Code>
                    <span>{row.transition}</span>
                    <span className="text-muted-foreground">after a {row.outcome} entry · {toShortDateTime(row.at)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
            <Field label="Played on">
              {record.play ? `${record.play.input}${record.play.touchControls ? ' (touch controls shown)' : ''}` : 'Not recorded'}
            </Field>
            <Field label="Window">{record.play ? `${record.play.viewport.width}×${record.play.viewport.height}` : '-'}</Field>
            <Field label="Frame rate">{record.play?.frameRate != null ? `${record.play.frameRate} fps` : '-'}</Field>
            <Field label="Real time lost">
              {record.play ? `${record.play.lostMs.toLocaleString()} ms · ${record.play.pauses} pause${record.play.pauses === 1 ? '' : 's'}` : '-'}
            </Field>
          </dl>
          {record.truncated && <Notice tone="error">The routing log was cut to fit one document.</Notice>}
        </div>
      )}
    </Panel>
  );
};

// --- the section ------------------------------------------------------------------

/** One opened attempt. Keyed by the attempt, so the selected step starts again at the first. */
const AttemptView = ({ replay }: { replay: AttemptReplayState }) => {
  const opened = replay.opened!;
  const [hideInputs, setHideInputs] = useState(false);
  /** The selected step, by its first transition's index, so hiding inputs keeps the place. */
  const [selected, setSelected] = useState<number | null>(null);
  const log = replay.fsm?.status === 'ready' ? replay.fsm.replay : null;
  const steps = useMemo(() => (log ? visibleSteps(log.steps, hideInputs) : []), [log, hideInputs]);
  const position = useMemo(() => {
    if (steps.length === 0) return 0;
    if (selected === null) return 0;
    let at = 0;
    steps.forEach((step, index) => {
      if (step.index <= selected) at = index;
    });
    return at;
  }, [steps, selected]);
  const step = steps[position] ?? null;
  const select = useCallback((index: number) => setSelected(steps[index]?.index ?? null), [steps]);

  return (
    <div className="space-y-6">
      <AttemptHeader summary={opened.summary} />
      <FsmReplayPanel
        fsm={replay.fsm}
        graph={replay.graph}
        steps={steps}
        position={position}
        onSelect={select}
        hideInputs={hideInputs}
        onHideInputs={setHideInputs}
      />
      <DecisionsPanel rows={opened.decisions} entry={opened.levelEntry} until={step ? step.lastAt : null} />
      <RoutingPanel routing={opened.routing} />
    </div>
  );
};

/** What to say when no attempt is open. */
const emptyState = (replay: AttemptReplayState): { title: string; body: string } => {
  const { records } = replay;
  if (replay.view === 'players') {
    if (!replay.players.player) {
      return {
        title: 'Choose a player',
        body: records.loading && !records.readAt ? 'The players are being read.' : 'Players are listed by username.',
      };
    }
    if (replay.attemptsLoading) return { title: 'Reading attempts', body: "The player's attempts are being read." };
  } else if (!replay.pilot.account) {
    return {
      title: 'Choose a participant',
      body: records.loading && !records.readAt ? 'The records are being read.' : 'Pool accounts are listed by code.',
    };
  }
  return {
    title: 'Choose an attempt',
    body:
      replay.attempts.length === 0
        ? 'This account has no saved attempt yet.'
        : 'Its attempts are listed oldest first, by level, time and decisions logged.',
  };
};

export const ReplaySection = ({ replay }: { replay: AttemptReplayState }) => {
  const { records } = replay;
  const empty = emptyState(replay);
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Replay"
        description="One attempt as it was recorded, step by step: the driving FSM's transitions beside the machine, every decision, and the routing record. Read only."
        meta={
          records.progress
            ? `Reading records: ${records.progress.done} of ${records.progress.total} accounts`
            : records.readAt
              ? `${replay.view === 'players' ? 'Players' : 'Records'} read ${toShortDateTime(records.readAt)}`
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
      <Pickers replay={replay} />
      {replay.view === 'pilot' && replay.pilot.account?.error && (
        <Notice tone="error">This account's last read failed: {replay.pilot.account.error}</Notice>
      )}
      {replay.opened ? (
        <AttemptView key={replay.opened.summary.item.id} replay={replay} />
      ) : replay.opening?.status === 'error' ? (
        <Notice tone="error">This attempt's records could not be read: {replay.opening.error}</Notice>
      ) : replay.opening ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-label="Reading the attempt's records" />
      ) : (
        <Panel>
          <EmptyState icon={History} title={empty.title}>
            {empty.body}
          </EmptyState>
        </Panel>
      )}
    </div>
  );
};
