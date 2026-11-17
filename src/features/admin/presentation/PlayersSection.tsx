/**
 * Admin > Players: search any account by name, email, study code or id, then
 * read it in one place: the account, where it stands in the course, its BKT
 * now as the course logged it, its course log, and its history of saved
 * drives and course steps. Ported from the groupmate's repository
 * (arangkada-personal, PlayersSection) and adapted to the records kept here.
 *
 * Not ported, because they write or rest on what this repository does not
 * keep: the pilot mark and the BKT value set (his BKT calibration, which the
 * ledger rules out), the progress reset (an admin write), and the history of
 * sign-ins, sign-outs and page views (his `users/{uid}/events` stream, which
 * nothing here writes). Nothing on this page writes, and it shows no score.
 */
import { useState } from 'react';
import { RefreshCw, UserSearch } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { COMPETENCIES, getCompetencyLabel } from '@/domain/learner/profile';
import { MASTERY_DESCRIPTORS } from '@/domain/competencyRouting/mastery';
import { usePlayerDirectory, usePlayerRecords } from '@/features/admin/application/usePlayerDirectory';
import { searchPlayers, type DirectoryPlayer } from '@/features/admin/domain/playerDirectory';
import { EmptyState, Notice, Panel, SearchField, SectionHeader } from './adminUi';
import { Legend } from './courseUi';
import { toDateTime } from './formatDate';

const LEGEND = [
  { term: 'Search', meaning: 'Matches name, email, study code or account id; every word typed must match.' },
  { term: 'Label', meaning: 'A study participant is named by their code; any other account by its username.' },
  { term: 'BKT now', meaning: "P(L) per competency after the account's last graded answer, as the course's BKT log wrote it. Nothing is recomputed." },
  { term: 'History', meaning: 'Saved drives (level and time) and course steps (quiz, drive, final, with the decisions taken), newest first. No score is shown.' },
  {
    term: 'Not here',
    meaning: 'Sign-ins, sign-outs and page views: the game logs no event stream for them, so the history cannot show them.',
  },
] as const;

const Fact = ({ term, children }: { term: string; children: React.ReactNode }) => (
  <div>
    <dt className="font-semibold text-foreground">{term}</dt>
    <dd className="break-all text-muted-foreground">{children}</dd>
  </div>
);

const PlayerDetail = ({ player }: { player: DirectoryPlayer }) => {
  const { records, loading, error, refresh } = usePlayerRecords(player.uid, player.label);
  const standing = records?.standing ?? null;
  const bkt = records?.bkt ?? null;

  return (
    <div className="space-y-4">
      <Panel
        title={player.label}
        description="The account and where it stands in the course."
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Fact term="Username">{player.username ?? '–'}</Fact>
          <Fact term="Email">{player.email ?? '–'}</Fact>
          <Fact term="Study code">{player.code ? `${player.code} (${player.cohort})` : 'not enrolled'}</Fact>
          <Fact term="Account id">{player.uid}</Fact>
          <Fact term="Created">{toDateTime(player.createdAt)}</Fact>
          <Fact term="Language">{player.language ?? '–'}</Fact>
          <Fact term="Course">
            {standing ? `${standing.lastPhase ?? '–'}${standing.endReason ? ` (${standing.endReason})` : ''}, last ${toDateTime(standing.lastAt)}` : records ? 'no course records yet' : '…'}
          </Fact>
          <Fact term="Drives saved">{records ? records.drives : '…'}</Fact>
          <Fact term="Graded answers in BKT">{records ? (bkt?.answers ?? 0) : '…'}</Fact>
        </dl>
        {error && <p className="mt-2 text-xs text-destructive">Could not read this account's records: {error}</p>}
        {records && records.unread > 0 && <p className="mt-2 text-xs text-destructive">{records.unread} course-log document(s) could not be read.</p>}
      </Panel>

      {standing && standing.standing.length > 0 && (
        <Panel title="This stage" description="The newest stage's competencies, as its decisions left them.">
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {standing.standing.map(s => (
              <li key={s.competency}>
                <span className="font-semibold">{getCompetencyLabel(s.competency)}</span>: {s.status}
                {s.lastAction ? `, last ${s.lastAction}` : ''} · {s.attempts} decision(s)
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="BKT now" description={bkt ? `From ${bkt.answers} graded answer(s) in the BKT log, last ${toDateTime(bkt.lastAt)}.` : 'No graded answers logged yet.'}>
        {bkt && (
          <div className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {COMPETENCIES.map(c => {
              const competency = bkt.competencies[c];
              const total = competency.answers.pre_test + competency.answers.quiz + competency.answers.drive;
              return (
                <p key={c}>
                  <span className="font-semibold">{getCompetencyLabel(c)}</span>: {competency.p.toFixed(3)}, M{competency.level} {MASTERY_DESCRIPTORS[competency.level]} · {total} answer(s)
                </p>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel
        title="History"
        description={records ? `${records.history.length} entr${records.history.length === 1 ? 'y' : 'ies'}, newest first.` : 'Reading the records…'}
        bodyClassName="p-0"
      >
        {records && records.history.length === 0 && <p className="p-4 text-xs text-muted-foreground">Nothing saved yet.</p>}
        {records && records.history.length > 0 && (
          <div className="max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.history.slice(0, 500).map((row, i) => (
                  <TableRow key={`${row.at}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs">{toDateTime(row.at)}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={row.kind === 'course' ? 'secondary' : 'outline'}>{row.title}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground" title={row.detail}>
                      {row.detail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
};

export const PlayersSection = ({ enabled }: { enabled: boolean }) => {
  const directory = usePlayerDirectory(enabled);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const matches = searchPlayers(directory.players, query);
  const player = directory.players.find(p => p.uid === selected) ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Players"
        description="Find any account by name, email, study code or id, and read it in one place: where it stands in the course, its BKT now and its history."
        meta={directory.loading ? 'Reading the accounts…' : `${directory.players.length} account(s)`}
        actions={
          <Button variant="outline" size="sm" onClick={directory.refresh} disabled={directory.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      {directory.error && <Notice tone="error">{directory.error}</Notice>}
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
                      {p.cohort && <Badge variant="secondary">{p.cohort}</Badge>}
                    </div>
                    <div className="truncate text-muted-foreground">{[p.username !== p.label ? p.username : null, p.email].filter(Boolean).join(' · ') || p.uid}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        {player ? (
          <PlayerDetail key={player.uid} player={player} />
        ) : (
          <EmptyState icon={UserSearch} title="Pick an account">
            Search on the left, then click an account to read it.
          </EmptyState>
        )}
      </div>
    </div>
  );
};
