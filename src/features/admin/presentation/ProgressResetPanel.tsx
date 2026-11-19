/**
 * Admin > Players > an account > Reset course progress (2026-11-16). Takes the
 * account back to the start of its course; every cleared record is archived
 * first (domain/progressReset.ts). Study participants are never reset.
 */
import { useState } from 'react';
import { useAuthSession } from '@/features/auth';
import { Button } from '@/shared/ui/button';
import { useProgressReset } from '@/features/admin/application/useProgressReset';
import { totalArchived, type ResetTarget } from '@/features/admin/domain/progressReset';
import { Panel } from './adminUi';
import { toDateTime } from './formatDate';

export const ProgressResetPanel = ({ target }: { target: ResetTarget }) => {
  const { user } = useAuthSession();
  const resets = useProgressReset(target);
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const allowed = resets.wired && !!user && !resets.checking && resets.refusal === null && !busy;

  const run = async () => {
    if (!user) return;
    setBusy(true);
    setFailure(null);
    setDone(null);
    try {
      const saved = await resets.reset({ uid: user.uid, email: user.email }, note);
      setDone(`Reset: ${totalArchived(saved.counts)} record(s) archived under ${saved.resetId}.`);
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
      title="Reset course progress"
      description="Takes this account back to the start of its course, as if it had just taken the pre-test."
    >
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Cleared:</span> the course's place, drives and their telemetry, the course log, short-quiz
          sittings (course and practice), the BKT log and profile, the open quiz or drive, and the level map's stars.
        </p>
        <p>
          <span className="font-semibold text-foreground">Kept:</span> the pre-test and post-test, enrolment, consent, mock exams, the Daily Challenge
          and the event stream. Nothing is deleted outright: every cleared record is copied to this account's archive first.
        </p>
        <p>
          <span className="font-semibold text-foreground">Not undone:</span> the shared Q-table keeps what this account's past decisions taught it.
          If the player is signed in, they should sign out first, or reload after the reset.
        </p>
      </div>

      {!resets.wired && <p className="mt-3 text-xs text-muted-foreground">Resetting is not available here.</p>}
      {resets.checking && <p className="mt-3 text-xs text-muted-foreground">Checking the account…</p>}
      {resets.refusal && <p className="mt-3 text-xs font-medium text-destructive">{resets.refusal}</p>}

      {resets.wired && !resets.refusal && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-medium text-foreground" htmlFor="reset-note">
            Reason (kept with the archive)
            <input
              id="reset-note"
              value={note}
              maxLength={500}
              onChange={event => setNote(event.target.value)}
              placeholder="e.g. test account, starting the checks again"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </label>
          {!confirming ? (
            <Button size="sm" variant="outline" disabled={!allowed} onClick={() => setConfirming(true)}>
              Reset progress
            </Button>
          ) : (
            <>
              <Button size="sm" variant="destructive" disabled={busy} aria-label="Confirm reset" onClick={() => void run()}>
                {busy ? 'Archiving…' : `Yes, reset ${target.label}`}
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
                {toDateTime(record.at)} by {record.by.email ?? record.by.uid}: {totalArchived(record.counts)} record(s) archived
                {record.status !== 'done' ? ' (not finished: run the reset again)' : ''}
                {record.note ? ` · ${record.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};
