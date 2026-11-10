import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useLiveQTable } from '@/features/admin/application/useLiveQTable';
import { toDateTime } from './formatDate';

const STATES = [1, 2, 3, 4].flatMap(m => (['passed', 'failed'] as const).map(r => `M${m}-${r}`));
const ACTIONS = ['none', 'practice', 'review'] as const;

/** Mirrors the routing rules: none needs a pass at mastery 2+, review needs a fail. */
const legal = (key: string, action: (typeof ACTIONS)[number]) => {
  const mastery = Number(key[1]);
  const passed = key.endsWith('passed');
  return action === 'none' ? passed && mastery >= 2 : action === 'review' ? !passed : true;
};

const TAG_LABEL = { exploring: 'Exploring', exploiting: 'Exploiting', no_choice: 'No choice' } as const;
const fmt = (value: unknown, digits = 3) => (typeof value === 'number' ? value.toFixed(digits) : '–');

/**
 * The shared Q-table, live: 8 states by 3 actions with Q, n and visits; each
 * state's warm-up phase and whether it is exploring or exploiting; and the
 * newest update-log entries as they land.
 */
export const QTablePanel = () => {
  const { table, updates, error } = useLiveQTable(true);
  const exploring = table ? Object.values(table.states ?? {}).filter(s => s.tag === 'exploring').length : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shared Q-table (live)</CardTitle>
          <p className="text-xs text-muted-foreground">
            {table
              ? `${table.updates} updates · ${exploring} of 8 states exploring · last change ${toDateTime(table.updatedAt)}${
                  table.lastUpdate ? ` by ${table.lastUpdate.participantCode ?? table.lastUpdate.uid} (${table.lastUpdate.kind})` : ''
                }`
              : 'No table yet: it appears with the first participant decision.'}
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
          <p className="text-xs text-muted-foreground">Every entry is kept in policy/competencyQ/updates with its full detail; the export has them all.</p>
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
              {updates.map(row => (
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
    </div>
  );
};
