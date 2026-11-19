/**
 * Admin access from the admin page (2026-11-18).
 *
 * - `AdminAccessPanel`: Admin > Players > an account: make it an admin, or
 *   take that away, with a reason kept in the record.
 * - `AdminRosterPanel`: Admin > Overview: everyone with admin access, and how.
 *
 * The page's grants live in `admins/{uid}`; the script's claim is listed from
 * its records and can only be removed by the script. An admin cannot remove
 * their own access, and study participants are never made admins.
 */
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuthSession } from '@/features/auth';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useAdminAccess } from '@/features/admin/application/useAdminAccess';
import { grantRefusal, revokeRefusal, type AdminRosterRow, type AdminTarget } from '@/features/admin/domain/adminAccess';
import { Notice, Panel } from './adminUi';
import { toDateTime } from './formatDate';

const SourceBadge = ({ row }: { row: AdminRosterRow }) => (
  <Badge variant="outline" className={row.source === 'page' ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
    {row.source === 'page' ? 'Admin page' : 'Script (claim)'}
  </Badge>
);

const TAKES_EFFECT = 'It takes effect the next time that person loads or signs in to the app.';

export const AdminAccessPanel = ({ target }: { target: AdminTarget }) => {
  const { user } = useAuthSession();
  const access = useAdminAccess(true);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const row = access.roster?.find(entry => entry.uid === target.uid) ?? null;
  const refusal = access.roster && user ? (row ? revokeRefusal(target, access.roster, user.uid) : grantRefusal(target, access.roster)) : null;
  const by = user ? { uid: user.uid, email: user.email } : null;

  const run = async () => {
    if (!by) return;
    setBusy(true);
    setFailure(null);
    setDone(null);
    try {
      if (row) {
        await access.revoke({ uid: target.uid, email: target.email }, reason.trim(), by);
        setDone(`${target.label} is no longer an admin. ${TAKES_EFFECT}`);
      } else {
        await access.grant({ uid: target.uid, email: target.email, name: target.label }, reason.trim(), by);
        setDone(`${target.label} is now an admin. ${TAKES_EFFECT}`);
      }
      setReason('');
      setConfirming(false);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Admin access"
      description="An admin can open this dashboard, see every account's records, and manage the study. Admin play never teaches the Q-table and never counts as study data."
    >
      {!access.wired && <p className="text-xs text-muted-foreground">Admin access cannot be changed here.</p>}
      {access.wired && access.roster === null && !access.error && <p className="text-xs text-muted-foreground">Checking…</p>}
      {access.error && <Notice tone="error">Could not read admin access: {access.error}</Notice>}

      {access.roster && (
        <div className="space-y-3 text-xs">
          <p className="flex flex-wrap items-center gap-2">
            {row ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-foreground">Admin</span>
                <SourceBadge row={row} />
                <span className="text-muted-foreground">
                  since {row.since ? toDateTime(row.since) : '–'}
                  {row.by ? ` by ${row.by}` : ''}
                  {row.reason ? ` · ${row.reason}` : ''}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Not an admin.</span>
            )}
          </p>

          {refusal ? (
            <p className="text-muted-foreground">{refusal}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[14rem] flex-1 flex-col gap-1 font-medium text-foreground" htmlFor={`admin-reason-${target.uid}`}>
                Reason (kept in the record)
                <input
                  id={`admin-reason-${target.uid}`}
                  value={reason}
                  maxLength={300}
                  onChange={event => setReason(event.target.value)}
                  placeholder={row ? 'e.g. left the team' : 'e.g. thesis team member'}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                />
              </label>
              {!confirming ? (
                <Button size="sm" variant={row ? 'outline' : 'default'} disabled={busy || !by} onClick={() => setConfirming(true)}>
                  {row ? 'Remove admin access' : 'Make admin'}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant={row ? 'destructive' : 'default'} disabled={busy} aria-label={row ? 'Confirm removing admin access' : 'Confirm making admin'} onClick={() => void run()}>
                    {busy ? 'Saving…' : row ? `Yes, remove ${target.label}` : `Yes, make ${target.label} an admin`}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          )}
          {done && <p className="font-medium text-foreground">{done}</p>}
          {failure && <p className="text-destructive">{failure}</p>}
        </div>
      )}
    </Panel>
  );
};

export const AdminRosterPanel = () => {
  const access = useAdminAccess(true);
  return (
    <Panel
      title="Admins"
      description="Everyone with admin access. Make someone an admin from Players > their account > Admin access. Admins set by the script (npm run db:role) are listed from its records and can only be removed by it."
    >
      {!access.wired && <p className="text-xs text-muted-foreground">Admin access cannot be read here.</p>}
      {access.error && <Notice tone="error">Could not read admin access: {access.error}</Notice>}
      {access.wired && access.roster === null && !access.error && <p className="text-xs text-muted-foreground">Loading…</p>}
      {access.roster && access.roster.length === 0 && <p className="text-xs text-muted-foreground">No admins on record.</p>}
      {access.roster && access.roster.length > 0 && (
        <ul className="space-y-1.5 text-xs">
          {access.roster.map(row => (
            <li key={row.uid} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="font-semibold text-foreground">{row.name || row.email || row.uid}</span>
              {row.name && row.email && <span className="text-muted-foreground">{row.email}</span>}
              <SourceBadge row={row} />
              <span className="text-muted-foreground">
                {row.since ? `since ${toDateTime(row.since)}` : ''}
                {row.by ? ` by ${row.by}` : ''}
                {row.reason ? ` · ${row.reason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};
