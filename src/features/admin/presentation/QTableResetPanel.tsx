/**
 * Admin > Q-learning > Reset a Q-table (2026-11-16; one per table since
 * 2026-11-19). Empties the chosen table so its warm-up starts again, or, for
 * the public table, starts it from a copy of the study table as it stands.
 * The table as it stood is kept with the reset record, and the update log is
 * untouched (domain/qTableReset.ts). Resetting one table never touches another.
 */
import { useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { Button } from '@/shared/ui/button';
import { useQTableReset } from '@/features/admin/application/useQTableReset';
import type { QTableStart } from '@/features/admin/domain/qTableReset';
import { Q_TABLE_LABEL, qTableDocId, type QTableId } from '@/domain/competencyRouting/qTables';
import { Panel } from './adminUi';
import { toDateTime } from './formatDate';

const START_LABEL: Record<QTableStart, string> = {
  empty: 'Start empty',
  study: 'Start from the study table',
};

export const QTableResetPanel = ({ tableId = 'study', empty, exists = true }: { tableId?: QTableId; empty: boolean; exists?: boolean }) => {
  const { user } = useAuthSession();
  const resets = useQTableReset(tableId);
  const [note, setNote] = useState('');
  const [start, setStart] = useState<QTableStart>('empty');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const label = Q_TABLE_LABEL[tableId];
  const canCopy = tableId === 'public';
  const chosen: QTableStart = canCopy ? start : 'empty';
  // Emptying an empty table changes nothing; copying the study's always may.
  const allowed = resets.wired && !!user && !busy && (chosen === 'study' || (exists && !empty));

  const run = async () => {
    if (!user) return;
    setBusy(true);
    setFailure(null);
    setDone(null);
    try {
      const saved = await resets.reset({ uid: user.uid, email: user.email }, note, chosen);
      setDone(
        `${label} table ${chosen === 'study' ? 'now starts from a copy of the study table' : 'emptied'}. The table as it stood is kept as ${saved.resetId}; its next update is #${saved.fromGlobalSeq}.`
      );
      setNote('');
      setConfirming(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={`Reset the ${label.toLowerCase()} Q-table`}
      description={
        canCopy
          ? 'Empties the public table, or starts it again from a copy of the study table as it stands now, so regular players begin from what the study has learned. No other table changes.'
          : `Empties the ${label.toLowerCase()} table, so its warm-up starts again. No other table changes.`
      }
    >
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Cleared:</span> every Q value, n and visit count of this table, in all 8 states
          {canCopy ? ' (or replaced by the study table’s, if you start from it)' : ''}.
        </p>
        <p>
          <span className="font-semibold text-foreground">Kept:</span> the table as it stood, with who reset it, when and why, under
          policy/{qTableDocId(tableId)}/resets; and its whole update log. The log&apos;s numbering carries on, so the reset marks where the
          fresh table&apos;s updates begin.
        </p>
        <p>
          <span className="font-semibold text-foreground">Admin play:</span> an admin account&apos;s course never changes any table.
        </p>
      </div>

      {!resets.wired && <p className="mt-3 text-xs text-muted-foreground">Resetting is not available here.</p>}

      {resets.wired && canCopy && (
        <fieldset className="mt-3 space-y-1.5 text-xs">
          <legend className="mb-1 font-medium text-foreground">Start the public table</legend>
          {(['empty', 'study'] as const).map(option => (
            <label key={option} className="flex items-center gap-2">
              <input type="radio" name={`q-start-${tableId}`} checked={start === option} onChange={() => setStart(option)} />
              <span className="text-foreground">{START_LABEL[option]}</span>
              <span className="text-muted-foreground">
                {option === 'empty' ? '— every state unvisited' : '— the study table’s Q, n and visits as they are now'}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {resets.wired && chosen === 'empty' && (!exists || empty) && (
        <p className="mt-3 text-xs text-muted-foreground">The table is already empty.</p>
      )}

      {resets.wired && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-foreground" htmlFor={`q-reset-note-${tableId}`}>
            Reason (kept with the reset)
            <input
              id={`q-reset-note-${tableId}`}
              value={note}
              maxLength={500}
              onChange={event => setNote(event.target.value)}
              placeholder={chosen === 'study' ? 'e.g. launching the public table' : 'e.g. clearing test play before the pilot'}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </label>
          {!confirming ? (
            <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirming(true)}>
              {chosen === 'study' ? 'Copy the study table' : `Reset the ${label.toLowerCase()} table`}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="destructive" disabled={busy} aria-label={`Confirm ${label} Q-table reset`} onClick={() => void run()}>
                {busy ? 'Resetting…' : chosen === 'study' ? `Yes, replace the ${label.toLowerCase()} table` : `Yes, empty the ${label.toLowerCase()} table`}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
      {done && <p className="mt-2 text-xs font-medium text-foreground">{done}</p>}
      {(failure || resets.error) && <p className="mt-2 text-xs text-destructive">{failure ?? resets.error}</p>}

      {resets.history && resets.history.length > 0 && (
        <div className="mt-4 text-xs">
          <div className="font-semibold text-foreground">Past resets of this table</div>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {resets.history.map(record => (
              <li key={record.resetId}>
                {toDateTime(record.at)} by {record.by.email ?? record.by.uid}: {record.updatesBefore} update(s) before it
                {record.startedFrom === 'study' ? ' · started from the study table' : ''}
                {record.note ? ` · ${record.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};
