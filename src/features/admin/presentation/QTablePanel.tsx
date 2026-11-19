import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useLiveQTable } from '@/features/admin/application/useLiveQTable';
import { toDateTime } from './formatDate';
import { QTableResetPanel } from './QTableResetPanel';
import { tableIsEmpty } from '@/features/admin/domain/qTableReset';
import type { QTable } from '@/domain/competencyRouting/qLearning';
import { Legend } from './adminUi';
import { DEFAULT_WARM_UP } from '@/domain/competencyRouting/qLearning';
import { Q_TABLE_LABEL, qTableDocId, type QTableId } from '@/domain/competencyRouting/qTables';

const w = DEFAULT_WARM_UP;

/** What the live table's codes mean. */
const Q_TABLE_LEGEND = [
  { term: 'M1–M4', meaning: 'The competency\'s BKT mastery level after the drive: M1 below 0.50 (Emerging), M2 0.50–0.79 (Developing), M3 0.80–0.94 (Connecting), M4 0.95+ (Benchmarking; needs 3 drive answers).' },
  { term: 'passed / failed', meaning: 'Its scenario result in that drive: 2 of its 3 scenarios right is a pass.' },
  { term: 'none', meaning: 'Done: it leaves the repeat drives. Legal only after a pass at M2 or above.' },
  { term: 'practice', meaning: 'Its 3 scenarios again in a repeat drive, new variants. Always legal.' },
  { term: 'review', meaning: 'Its module section, then its scenarios. Legal only after a fail.' },
  { term: 'not legal', meaning: 'The rules forbid that action in that state; the Q-table never chooses it.' },
  { term: 'No choice (only_legal)', meaning: 'One legal action, so it is applied without the table (M1-passed: only practice).' },
  { term: 'Exploring', meaning: `Warm-up: explore_1 gives each legal action ${w.exploreFirst} random visits; explore_2 gives the others ${w.exploreSecond} more after the first commit.` },
  { term: 'Exploiting', meaning: `commit_1 picks the leader until it has ${w.commitLeader} visits; final_commit from then on. Every other legal action keeps probability ${w.floor}.` },
  { term: 'Q', meaning: 'The action\'s value: the running average of its targets r + 0.9 · max Q(next state). – = not updated yet.' },
  { term: 'n', meaning: 'Rewards it has learned from (α = 1/n). A decision is rewarded later, at the competency\'s next measurement.' },
  { term: 'visits', meaning: 'Times it was chosen in that state, whoever chose it. The warm-up counts these.' },
  { term: 'leader (bold)', meaning: 'The highest Q; ties go to fewer visits, then the fallback rule.' },
] as const;

import { COMPETENCY_ACTIONS, legalActions, Q_STATES, stateKey } from '@/domain/competencyRouting/qLearning';

const STATES = Q_STATES.map(stateKey);
const ACTIONS = COMPETENCY_ACTIONS;

/** The routing rules' own legality: none needs a pass at mastery 2+, review needs a fail. */
const legal = (key: string, action: (typeof ACTIONS)[number]) => legalActions(Q_STATES[STATES.indexOf(key)]).includes(action);

const TAG_LABEL = { exploring: 'Exploring', exploiting: 'Exploiting', no_choice: 'No choice' } as const;
const fmt = (value: unknown, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');

/**
 * The shared Q-table, live: 8 states by 3 actions with Q, n and visits; each
 * state's warm-up phase and whether it is exploring or exploiting; and the
 * newest update-log entries as they land.
 */
export const QTablePanel = ({ tableId = 'study' }: { tableId?: QTableId }) => {
  const { table, updates, error } = useLiveQTable(true, tableId);
  const exploring = table ? Object.values(table.states ?? {}).filter(s => s.tag === 'exploring').length : 0;
  // The log is never cleared and its numbering carries on through a reset
  // (2026-11-16): what came before the last reset is kept, but it is not this
  // table's, so it is counted and listed apart.
  const fromSeq = table?.lastReset?.fromGlobalSeq ?? 1;
  const sinceReset = table ? Math.max(0, table.updates - (fromSeq - 1)) : 0;
  const current = updates.filter(row => row.globalSeq >= fromSeq);
  const earlier = updates.length - current.length;

  return (
    <div className="space-y-4">
      <Legend title="Legend: the live table" items={Q_TABLE_LEGEND} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{Q_TABLE_LABEL[tableId]} Q-table (live)</CardTitle>
          <p className="text-xs text-muted-foreground">
            {table
              ? `${sinceReset} update${sinceReset === 1 ? '' : 's'}${
                  table.lastReset ? ` since the reset of ${toDateTime(table.lastReset.at)} (${fromSeq - 1} before it, kept in the log)` : ''
                } · ${exploring} of 8 states exploring · last change ${toDateTime(table.updatedAt)}${
                  // Before the reset, the last change is the reset itself.
                  table.lastUpdate && table.lastUpdate.globalSeq >= fromSeq
                    ? ` by ${table.lastUpdate.participantCode ?? table.lastUpdate.uid} (${table.lastUpdate.kind})`
                    : table.lastReset
                      ? ' (the reset)'
                      : ''
                }`
              : 'No table yet: it appears with the first decision that teaches it.'}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Warm-up</TableHead>
                {ACTIONS.map(action => (
                  <TableHead key={action}>{action}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {STATES.map(key => {
                const status = table?.states?.[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="font-mono">{key}</TableCell>
                    <TableCell>
                      {status ? (
                        <div className="flex flex-col gap-1">
                          <Badge variant={status.tag === 'exploring' ? 'secondary' : 'default'}>{TAG_LABEL[status.tag]}</Badge>
                          <span className="text-xs text-muted-foreground">{status.phase}</span>
                        </div>
                      ) : (
                        '–'
                      )}
                    </TableCell>
                    {ACTIONS.map(action => {
                      if (!legal(key, action)) return <TableCell key={action} className="text-muted-foreground/40">not legal</TableCell>;
                      const cell = table?.table?.[key]?.[action];
                      const leader = status?.leader === action;
                      return (
                        <TableCell key={action} className={leader ? 'font-semibold' : ''}>
                          <div>Q {fmt(cell?.q)}</div>
                          <div className="text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Newest updates</CardTitle>
          <p className="text-xs text-muted-foreground">
            Every entry is kept in policy/{qTableDocId(tableId)}/updates with its full detail.
            {table?.lastReset ? ' Listed here: only the updates since the last reset.' : ''}
          </p>
        </CardHeader>
        <CardContent>
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
              {current.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground">
                    No updates since the reset{earlier > 0 ? ` (${earlier} earlier ${earlier === 1 ? 'entry' : 'entries'} kept in the log)` : ''}.
                  </TableCell>
                </TableRow>
              )}
              {current.map(row => (
                <TableRow key={row.updateId}>
                  <TableCell>{row.globalSeq}</TableCell>
                  <TableCell>{toDateTime(row.at)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.participantCode ?? row.uid.slice(0, 8)}</TableCell>
                  <TableCell>{row.kind}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.stateKey} · {row.action} ({row.competency})
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.kind === 'visit' && row.decision
                      ? `${String(row.decision.selection)} · ${String(row.decision.warmUpPhase)} · p ${fmt(row.decision.probability, 2)} · draw ${fmt(row.decision.draw, 3)}`
                      : row.learning
                        ? `r ${fmt(row.learning.reward)} · Q ${fmt(row.learning.qBefore)} → ${fmt(row.learning.qAfter)} · α ${fmt(row.learning.alpha, 3)} · by ${String(row.learning.measuredBy)}`
                        : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <QTableResetPanel tableId={tableId} empty={tableIsEmpty(table?.table as QTable | undefined)} exists={table !== null} />
    </div>
  );
};
