/**
 * Admin > Players (2026-11-13): search any account by name, email, study code
 * or id, then read it in one place: the account, its BKT value set and pilot
 * mark, its BKT now, its course log, and its history as logged, sign-ins and
 * sign-outs included.
 */
import { useMemo, useState } from 'react';
import { RefreshCw, UserSearch } from 'lucide-react';
import { useAuthSession } from '@/features/auth';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { setLabel } from '@/domain/learner/mastery/bktValueSets';
import type { CourseAdmin } from '@/features/admin/application/useCourseAdmin';
import { usePlayerEvents } from '@/features/admin/application/usePlayerEvents';
import { MASTERY_DESCRIPTORS, playerLabel } from '@/features/admin/domain/courseAdmin';
import { accountActivity, directoryPlayers, playerHistory, searchPlayers, type DirectoryPlayer, type EventKind } from '@/features/admin/domain/playerDirectory';
import { EmptyState, Legend, Notice, Panel, SearchField, SectionHeader } from './adminUi';
import { toDateTime } from './formatDate';

const KIND_STYLE: Record<EventKind, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  account: 'default',
  course: 'secondary',
  navigation: 'outline',
  error: 'destructive',
  other: 'outline',
};

const LEGEND = [
  { term: 'Search', meaning: 'Matches name, email, study code or account id; every word typed must match.' },
  { term: 'Values', meaning: 'The BKT value set the player runs on, kept from their start to the end of their course.' },
  { term: 'Pilot', meaning: 'Ticked: their answers feed the next BKT calibration. Every change is logged.' },
  { term: 'History', meaning: 'The player\'s event stream as logged, newest first: sign-ins, sign-ups and sign-outs (account), course steps, errors. Page views are hidden unless asked for.' },
  { term: 'Session restored', meaning: 'The app was opened while already signed in; a sign-in on that load is logged as "Signed in".' },
] as const;

const Fact = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <div>
    <dt className="font-semibold text-foreground">{term}</dt>
    <dd className="break-all text-muted-foreground">{children}</dd>
  </div>
);

const PlayerDetail = ({ player, course }: { player: DirectoryPlayer; course: CourseAdmin }) => {
  const { user } = useAuthSession();
  const events = usePlayerEvents(player.uid);
  const [includePages, setIncludePages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mastery = course.mastery.find(row => row.uid === player.uid) ?? null;
  const standing = course.players.find(row => row.uid === player.uid) ?? null;
  const logs = course.courseLogs.filter(row => row.userId === player.uid).sort((a, b) => b.timestamp - a.timestamp);
  const history = useMemo(() => (events.events ? playerHistory(events.events, includePages) : []), [events.events, includePages]);
  const account = useMemo(() => (events.events ? accountActivity(events.events) : []), [events.events]);
  const pilot = course.bkt.pilotIds.has(player.uid);

  const togglePilot = async (on: boolean) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await course.bkt.setPilot({ uid: player.uid, label: player.label }, on, user.uid);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={player.label} description="The account and where it stands.">
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Fact term="Username">{player.username ?? '–'}</Fact>
          <Fact term="Email">{player.email || '–'}</Fact>
          <Fact term="Study code">{player.code ?? '–'}</Fact>
          <Fact term="Account id">{player.uid}</Fact>
          <Fact term="Created">{toDateTime(player.createdAt)}</Fact>
          <Fact term="Language">{player.user?.language ?? '–'}</Fact>
          <Fact term="Terms and Data Use">
            {player.user?.termsVersion ? `version ${player.user.termsVersion}, agreed ${toDateTime(player.user.termsAcceptedAt)}` : 'no record (account older than the agreement, or not saved)'}
          </Fact>
          <Fact term="BKT values">{setLabel(course.bkt.setOf(player.uid))}</Fact>
          <Fact term="Course">{standing ? `${standing.lastPhase}${standing.endReason ? ` (${standing.endReason})` : ''}, last ${toDateTime(standing.lastAt)}` : 'no course records yet'}</Fact>
          <Fact term="Last sign-in">{account.find(row => row.title === 'Signed in' || row.title === 'Signed up')?.at ? toDateTime(account.find(row => row.title === 'Signed in' || row.title === 'Signed up')!.at) : events.events ? 'none logged' : '…'}</Fact>
          <Fact term="Last sign-out">{account.find(row => row.title === 'Signed out')?.at ? toDateTime(account.find(row => row.title === 'Signed out')!.at) : events.events ? 'none logged' : '…'}</Fact>
          <div>
            <dt className="font-semibold text-foreground">Pilot</dt>
            <dd>
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" aria-label={`Pilot: ${player.label}`} checked={pilot} disabled={!course.bkt.wired || saving} onChange={event => void togglePilot(event.target.checked)} />
                {pilot ? 'marked: feeds the next calibration' : 'not marked'}
              </label>
            </dd>
          </div>
        </dl>
        {error && <p className="mt-2 text-xs text-destructive">Could not save the pilot mark: {error}</p>}
      </Panel>

      <Panel title="BKT now" description={mastery ? `Replayed from ${mastery.answers} graded answers with the player's value set.` : 'No graded answers yet.'}>
        {mastery && (
          <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {COMPETENCIES.map(c => (
              <p key={c}>
                <span className="font-semibold">{getCompetencyLabel(c)}</span>: {mastery.mastery[c].toFixed(3)}, M{mastery.level[c]} {MASTERY_DESCRIPTORS[mastery.level[c]]} · {mastery.evidence[c].total} answers
              </p>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="History"
        description={events.events ? `${history.length} event(s) shown of ${events.events.length} logged, newest first.` : 'Reading the event stream…'}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={includePages} onChange={event => setIncludePages(event.target.checked)} />
              Show page views
            </label>
            <Button variant="outline" size="sm" onClick={events.refresh} disabled={events.loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
        bodyClassName="p-0"
      >
        {events.error && <p className="p-4 text-xs text-destructive">{events.error}</p>}
        {events.events && history.length === 0 && <p className="p-4 text-xs text-muted-foreground">Nothing logged yet.</p>}
        {history.length > 0 && (
          <div className="max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 500).map((row, i) => (
                  <TableRow key={`${row.seq ?? 'x'}-${i}`}>
                    <TableCell className="font-mono text-xs">{row.seq ?? '–'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.at)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={KIND_STYLE[row.kind]}>{row.title}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={row.detail}>
                      {row.detail || '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel title="Course log" description={`${logs.length} quiz, drive, final and post-test entr${logs.length === 1 ? 'y' : 'ies'}, newest first.`} bodyClassName="p-0">
        {logs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Verdicts</TableHead>
                <TableHead>Decisions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.timestamp)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.kind} · {row.phase}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.verdicts.map(v => `${getCompetencyLabel(v.competency)} ${v.correct}/${v.total}${v.passed ? ' ✓' : ' ✗'}`).join(' · ') || '–'}
                  </TableCell>
                  <TableCell className="text-xs">{row.decisions.map(d => `${getCompetencyLabel(d.competency)} → ${d.action}`).join(' · ') || '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
};

export const PlayersSection = ({ course }: { course: CourseAdmin }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const players = useMemo(() => {
    const others = [...course.mastery.map(row => row.uid), ...course.courseLogs.map(row => row.userId)];
    return directoryPlayers(course.users, course.codes, others, uid => playerLabel(uid, course.codes, course.users));
  }, [course.users, course.codes, course.mastery, course.courseLogs]);
  const matches = useMemo(() => searchPlayers(players, query), [players, query]);
  const player = players.find(p => p.uid === selected) ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Players"
        description="Find any account by name, email, study code or id, and read its history: sign-ins and sign-outs, course steps, BKT and value set."
        meta={course.loading ? 'Reading the accounts…' : `${players.length} account(s)`}
        actions={
          <Button variant="outline" size="sm" onClick={course.refresh} disabled={course.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {course.error && <Notice tone="error">{course.error}</Notice>}
      <Legend title="Legend: players" items={LEGEND} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Panel title="Accounts" actions={<SearchField label="Search players" value={query} onChange={setQuery} />} bodyClassName="p-0">
          {matches.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No account matches.</p>
          ) : (
            <ul className="max-h-[40rem] divide-y divide-border overflow-y-auto">
              {matches.slice(0, 100).map(p => (
                <li key={p.uid}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.uid)}
                    className={`w-full px-4 py-2 text-left text-xs hover:bg-muted/50 ${selected === p.uid ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      {p.label}
                      {course.bkt.pilotIds.has(p.uid) && <Badge variant="secondary">pilot</Badge>}
                    </div>
                    <div className="truncate text-muted-foreground">{[p.email, p.code, setLabel(course.bkt.setOf(p.uid))].filter(Boolean).join(' · ')}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {player ? (
          <PlayerDetail key={player.uid} player={player} course={course} />
        ) : (
          <EmptyState icon={UserSearch} title="Pick an account">
            Search on the left, then click an account to see its history.
          </EmptyState>
        )}
      </div>
    </div>
  );
};
