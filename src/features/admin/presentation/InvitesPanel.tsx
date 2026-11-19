import { useState } from 'react';
import { Copy, Mail, Plus, Share2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { STUDY_COHORTS, formatInviteCode, type StudyCohort } from '@/domain/study/participantCode';
import { appUrl } from '@/shared/lib/appUrl';
import type { StudyInvites } from '@/features/admin/application/useStudyInvites';
import type { InviteEntry } from '@/features/admin/application/pilotPorts';
import { inviteGmailUrl, inviteMailto, inviteMessage, parseRecipients } from '@/features/admin/domain/inviteShare';
import { Notice, Panel } from './adminUi';

const COHORT_LABEL: Record<StudyCohort, string> = { study: 'Study', dryrun: 'Dry run', test: 'Test' };

const COHORT_NOTE: Record<StudyCohort, string> = {
  study: 'The participants the thesis reports.',
  dryrun: 'The dry run before the study, which fits its parameters.',
  test: "The team's own checks: never counted.",
};

/** The join page with the invite filled in: what the team sends a participant. */
const joinLink = (code: string) => `${window.location.origin}${appUrl('/study/join')}?invite=${code}`;

const SMALL = 'h-8 px-2 text-xs';

/** Copies text; falls back to a hidden textarea where the clipboard API is blocked. */
const copyText = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Fall through to the older way.
  }
  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy refused');
};

/**
 * One open invite and every way to send it (2026-11-18): the link itself,
 * copied or shared; the code alone; a ready message to paste into a chat; and
 * an email, opened in the admin's own email app with the invite written (one
 * recipient in To, several in BCC).
 */
const OpenInvite = ({ invite, onClose, closing, busy }: { invite: InviteEntry; onClose: () => void; closing: boolean; busy: boolean }) => {
  const link = joinLink(invite.code);
  const message = inviteMessage(invite.code, link);
  const [copied, setCopied] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (what: string, value: string) => {
    setProblem(null);
    try {
      await copyText(value);
      setCopied(what);
      window.setTimeout(() => setCopied(current => (current === what ? null : current)), 2500);
    } catch {
      setProblem('Could not copy: select the text instead.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: message.subject, text: message.body });
    } catch {
      // Cancelled, or not allowed here: nothing to report.
    }
  };

  /** The addresses typed, or null after saying what is wrong with them. */
  const readRecipients = (): string[] | null => {
    const { valid, invalid } = parseRecipients(recipients);
    if (invalid.length > 0) {
      setProblem(`Not an email: ${invalid.join(', ')}`);
      return null;
    }
    if (valid.length === 0) {
      setProblem('Type at least one email address.');
      return null;
    }
    setProblem(null);
    return valid;
  };

  const gmail = () => {
    const valid = readRecipients();
    if (valid) window.open(inviteGmailUrl(valid, message), '_blank', 'noopener,noreferrer');
  };

  const email = () => {
    const valid = readRecipients();
    if (valid) window.location.href = inviteMailto(valid, message);
  };

  return (
    <li className="space-y-2 rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold tracking-wider">{formatInviteCode(invite.code)}</span>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
          Open
        </Badge>
        <span className="text-xs text-muted-foreground">created {new Date(invite.createdAt).toLocaleDateString()}</span>
        <span className="ml-auto">
          {confirming ? (
            <span className="flex gap-1.5">
              <Button size="sm" variant="destructive" className={SMALL} disabled={busy} onClick={onClose}>
                {closing ? 'Closing…' : 'Close it for good'}
              </Button>
              <Button size="sm" variant="outline" className={SMALL} disabled={busy} onClick={() => setConfirming(false)}>
                Keep open
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" className={SMALL} disabled={busy} onClick={() => setConfirming(true)}>
              Close
            </Button>
          )}
        </span>
      </div>

      <input
        readOnly
        value={link}
        aria-label={`Join link for ${formatInviteCode(invite.code)}`}
        onFocus={event => event.currentTarget.select()}
        className="h-8 w-full rounded-md border border-input bg-muted/40 px-2 font-mono text-xs"
      />

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className={SMALL} onClick={() => void copy('link', link)}>
          <Copy className="h-3.5 w-3.5" />
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="outline" className={SMALL} onClick={() => void copy('code', formatInviteCode(invite.code))}>
          <Copy className="h-3.5 w-3.5" />
          {copied === 'code' ? 'Code copied' : 'Copy code'}
        </Button>
        <Button size="sm" variant="outline" className={SMALL} onClick={() => void copy('message', message.body)}>
          <Copy className="h-3.5 w-3.5" />
          {copied === 'message' ? 'Message copied' : 'Copy message'}
        </Button>
        {canShare && (
          <Button size="sm" variant="outline" className={SMALL} onClick={() => void share()}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        )}
        <Button size="sm" variant={emailing ? 'default' : 'outline'} className={SMALL} onClick={() => setEmailing(open => !open)} aria-expanded={emailing}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
      </div>

      {emailing && (
        <div className="space-y-1.5 rounded-md bg-muted/30 p-2">
          <label className="flex flex-col gap-1 text-xs font-medium" htmlFor={`invite-to-${invite.code}`}>
            Send to (one or more emails, separated by commas)
            <input
              id={`invite-to-${invite.code}`}
              type="text"
              inputMode="email"
              value={recipients}
              onChange={event => setRecipients(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') gmail();
              }}
              placeholder="juan@example.com, maria@example.com"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className={SMALL} onClick={gmail}>
              <Mail className="h-3.5 w-3.5" />
              Open in Gmail
            </Button>
            <Button size="sm" variant="outline" className={SMALL} onClick={email}>
              Other email app
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Gmail opens in a new tab with the invite written: check it and press Send there. Several people go in BCC, so they do not see each
            other. Not on Gmail? "Other email app" opens your computer's own email app, if it has one set up; otherwise use Copy message.
          </p>
        </div>
      )}
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </li>
  );
};

/**
 * The study's invites: each cohort's codes, open or closed, a new one created
 * on request and an open one closed once, after a second press. Anyone holding
 * an open invite can join its cohort, so the team sends it only to the people
 * it means to invite, and closes it when the cohort is full.
 */
export const InvitesPanel = ({ invites }: { invites: StudyInvites }) => {
  const [busy, setBusy] = useState<string | null>(null);
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
    }
  };

  return (
    <Panel
      title="Invites"
      description="Send a participant an open invite: by link, by email, or as a message in a chat. They join with it and get that cohort's next code. Close an invite when its cohort is full: a closed one lets nobody join."
      bodyClassName="space-y-4"
    >
      {invites.error && <Notice tone="error">Could not read the invites: {invites.error}</Notice>}
      {failure && <Notice tone="error">{failure}</Notice>}
      {STUDY_COHORTS.map(cohort => {
        const own = invites.invites.filter(invite => invite.cohort === cohort);
        const open = own.filter(invite => invite.open);
        const closed = own.filter(invite => !invite.open);
        return (
          <section key={cohort} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">{COHORT_LABEL[cohort]}</span> <span className="text-xs text-muted-foreground">{COHORT_NOTE[cohort]}</span>
              </p>
              <Button size="sm" variant="outline" disabled={busy !== null || invites.loading} onClick={() => void run(`new:${cohort}`, () => invites.create(cohort))}>
                <Plus className="h-4 w-4" />
                {busy === `new:${cohort}` ? 'Creating…' : 'New invite'}
              </Button>
            </div>
            {own.length === 0 && <p className="text-xs text-muted-foreground">No {COHORT_LABEL[cohort].toLowerCase()} invite yet.</p>}
            {open.length > 0 && (
              <ul className="space-y-1.5">
                {open.map(invite => (
                  <OpenInvite
                    key={invite.code}
                    invite={invite}
                    busy={busy !== null}
                    closing={busy === invite.code}
                    onClose={() => void run(invite.code, () => invites.close(invite.code))}
                  />
                ))}
              </ul>
            )}
            {closed.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">{closed.length} closed invite(s)</summary>
                <ul className="mt-1 space-y-0.5">
                  {closed.map(invite => (
                    <li key={invite.code}>
                      <span className="font-mono">{formatInviteCode(invite.code)}</span>, created {new Date(invite.createdAt).toLocaleDateString()}
                      {invite.closedAt !== null && `, closed ${new Date(invite.closedAt).toLocaleDateString()}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
    </Panel>
  );
};
