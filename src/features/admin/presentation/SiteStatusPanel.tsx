/**
 * Suspend or reopen the site. Two clicks either way: the first arms the
 * button, the second does it, so a stray click never stops a session.
 * Suspended, every page but the admin area shows players a paused screen at
 * once (it is read live); a drive in progress stops where it is.
 */
import { useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useAuthSession } from '@/features/auth';
import { setSiteStatus, useSiteStatus } from '@/features/admin/application/useSiteStatus';
import { MAX_SITE_MESSAGE } from '@/features/admin/domain/siteStatus';
import { Notice, Panel } from './adminUi';
import { toDateTime } from './formatDate';

export const SiteStatusPanel = () => {
  const { user } = useAuthSession();
  const { status, error } = useSiteStatus();
  const [message, setMessage] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const suspended = status?.suspended ?? false;

  const act = async () => {
    if (!user) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await setSiteStatus(user.uid, !suspended, suspended ? '' : message);
      setMessage('');
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <Panel
      title="Site status"
      description={
        suspended
          ? `Suspended${status?.updatedAt ? ` since ${toDateTime(status.updatedAt)}` : ''}: players see a paused screen; admins can still use everything.`
          : 'Open to players. Suspending shows every player a paused screen at once (a drive in progress stops); the admin area stays open.'
      }
      className={suspended ? 'border-destructive/60' : undefined}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {!suspended && (
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Message to players (optional)
            <input
              value={message}
              maxLength={MAX_SITE_MESSAGE}
              onChange={event => {
                setMessage(event.target.value);
                setArmed(false);
              }}
              placeholder="e.g. Session paused, please wait for the facilitator."
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </label>
        )}
        {suspended && status?.message && <p className="flex-1 text-sm">Players read: “{status.message}”</p>}
        <div className="flex gap-2">
          <Button variant={suspended ? 'default' : 'destructive'} onClick={() => void act()} disabled={busy || !user || status === null}>
            {suspended ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
            {busy ? 'Saving…' : armed ? (suspended ? 'Click again to reopen' : 'Click again to suspend') : suspended ? 'Reopen the site' : 'Suspend the site'}
          </Button>
          {armed && (
            <Button variant="outline" onClick={() => setArmed(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {(failure || error) && (
        <div className="mt-3">
          <Notice tone="error">{failure ?? `Could not read the site status: ${error}. Deploy the rules (npm run db:deploy).`}</Notice>
        </div>
      )}
    </Panel>
  );
};
