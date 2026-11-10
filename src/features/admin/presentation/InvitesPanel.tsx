import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { STUDY_COHORTS, formatInviteCode, type StudyCohort } from '@/domain/study/participantCode';
import { appUrl } from '@/shared/lib/appUrl';
import type { StudyInvites } from '@/features/admin/application/useStudyInvites';
import { Notice, Panel } from './adminUi';

const COHORT_LABEL: Record<StudyCohort, string> = { study: 'Study', dryrun: 'Dry run', test: 'Test' };

const COHORT_NOTE: Record<StudyCohort, string> = {
  study: 'The participants the thesis reports.',
  dryrun: 'The dry run before the study, which fits its parameters.',
  test: "The team's own checks: never counted.",
};

/** The join page with the invite filled in: what the team sends a participant. */
const joinLink = (code: string) => `${window.location.origin}${appUrl('/study/join')}?invite=${code}`;

/**
 * The study's invites: each cohort's codes, open or
 * closed, a new one created on request and an open one closed once, after a
 * second press. Anyone holding an open invite can join its cohort, so the
 * team shares it only with the people it means to invite, and closes it when
 * the cohort is full.
 */
export const InvitesPanel = ({ invites }: { invites: StudyInvites }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key);
    setFailure(null);
    try {
      await work();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(joinLink(code));
      setCopied(code);
    } catch {
      setFailure('The link could not be copied; select it instead.');
    }
  };

  return (
    <Panel
      title="Invites"
      description="A participant joins at /study/join with an open invite, and is given that cohort's next code. Close an invite when its cohort is full: a closed one lets nobody join."
      bodyClassName="space-y-4"
    >
      {invites.error && <Notice tone="error">Could not read the invites: {invites.error}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      {STUDY_COHORTS.map(cohort => {
        const own = invites.invites.filter(invite => invite.cohort === cohort);
        return (
          <section key={cohort} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">{COHORT_LABEL[cohort]}</span>{' '}
                <span className="text-xs text-muted-foreground">{COHORT_NOTE[cohort]}</span>
              </p>
              <Button size="sm" variant="outline" disabled={busy !== null || invites.loading} onClick={() => void run(`new:${cohort}`, () => invites.create(cohort))}>
                <Plus className="h-4 w-4" />
                {busy === `new:${cohort}` ? 'Creating…' : 'New invite'}
              </Button>
            </div>
            {own.length === 0 ? (
              <p className="text-xs text-muted-foreground">No {COHORT_LABEL[cohort].toLowerCase()} invite yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {own.map(invite => (
                  <li key={invite.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <span className="font-mono font-semibold tracking-wider">{formatInviteCode(invite.code)}</span>
                    <Badge variant="outline" className={invite.open ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
                      {invite.open ? 'Open' : 'Closed'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      created {new Date(invite.createdAt).toLocaleDateString()}
                      {invite.closedAt !== null && `, closed ${new Date(invite.closedAt).toLocaleDateString()}`}
                    </span>
                    {invite.open && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => void copy(invite.code)}>
                          <Copy className="h-3.5 w-3.5" />
                          {copied === invite.code ? 'Link copied' : 'Copy join link'}
                        </Button>
                        {confirming === invite.code ? (
                          <Button size="sm" variant="destructive" className="h-8 px-2 text-xs" disabled={busy !== null} onClick={() => void run(invite.code, () => invites.close(invite.code))}>
                            {busy === invite.code ? 'Closing…' : 'Close it for good'}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={busy !== null} onClick={() => setConfirming(invite.code)}>
                            Close
                          </Button>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </Panel>
  );
};
