/**
 * Admin > Q-learning > Reset the shared Q-table (2026-11-16). Empties the
 * table so its warm-up starts again; the table as it stood is kept with the
 * reset record, and the update log is untouched (domain/qTableReset.ts).
 */
import { useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { Button } from '@/shared/ui/button';
import { useQTableReset } from '@/features/admin/application/useQTableReset';
import { Panel } from './adminUi';
import { toDateTime } from './formatDate';

export const QTableResetPanel = ({ empty }: { empty: boolean }) => {
  const { user } = useAuthSession();
  const resets = useQTableReset();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const allowed = resets.wired && !!user && !busy && !empty;

  const run = async () => {
    if (!user) return;
    setBusy(true);
    setFailure(null);
    setDone(null);
    try {
      const saved = await resets.reset({ uid: user.uid, email: user.email }, note);
      setDone(`Reset. The table as it stood is kept as ${saved.resetId}; its next update is #${saved.fromGlobalSeq}.`);
      setNote('');
      setConfirming(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Reset the shared Q-table" description="Empties the table every participant's decisions learn from, so its warm-up starts again.">
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Cleared:</span> every Q value, n and visit count, in all 8 states.
        </p>
        <p>
          <span className="font-semibold text-foreground">Kept:</span> the table as it stood, with who reset it, when and why, under
          policy/competencyQ/resets; and the whole update log. The log&apos;s numbering carries on, so the reset marks where the fresh
          table&apos;s updates begin.
        </p>
        <p>
          <span className="font-semibold text-foreground">Admin play:</span> an admin account&apos;s course never changes the table. Its
          decisions are read from it, but nothing it does is learned.
        </p>
      </div>

      {!resets.wired && <p className="mt-3 text-xs text-muted-foreground">Resetting is not available here.</p>}
      {resets.wired && empty && <p className="mt-3 text-xs text-muted-foreground">The table is already empty.</p>}

      {resets.wired && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-foreground" htmlFor="q-reset-note">
            Reason (kept with the reset)
            <input
              id="q-reset-note"
              value={note}
              maxLength={500}
              onChange={event => setNote(event.target.value)}
              placeholder="e.g. clearing test play before the pilot"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </label>
          {!confirming ? (
            <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirming(true)}>
              Reset Q-table
            </Button>
          ) : (
            <>
              <Button size="sm" variant="destructive" disabled={busy} aria-label="Confirm Q-table reset" onClick={() => void run()}>
                {busy ? 'Resetting…' : 'Yes, empty the shared table'}
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
          <div className="font-semibold text-foreground">Past resets</div>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {resets.history.map(record => (
              <li key={record.resetId}>
                {toDateTime(record.at)} by {record.by.email ?? record.by.uid}: {record.updatesBefore} update(s) before it
                {record.note ? ` · ${record.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};
