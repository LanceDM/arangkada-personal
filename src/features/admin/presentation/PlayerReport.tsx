/**
 * The player report: every account's activity across the game's three modes.
 * A row of totals, then four tabs: the players (with one player's detail
 * beside the list), every Story attempt, the scoring rules, and downloads.
 */
import {
  BookOpenCheck,
  CalendarCheck,
  Car,
  Check,
  Download,
  FileBraces,
  FileSpreadsheet,
  RefreshCw,
  Scale,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { PlayerReportState } from '@/features/admin/application/usePlayerReport';
import { levelName, passMarkOf, type ReportPlayer } from '@/features/admin/domain/playerReport';
import { EmptyState, Notice, Panel, SearchField, SectionHeader, StatTile } from './adminUi';
import { toDate, toRelative, toShortDateTime } from './formatDate';

const COLLECTION_LABEL: Record<string, string> = {
  users: 'Players',
  attempts: 'Story attempts',
  examAttempts: 'Mock exam sittings',
  dailyAttempts: 'Daily challenge answers',
};

const percent = (part: number, whole: number) => (whole === 0 ? '-' : `${Math.round((part / whole) * 100)}%`);
const dash = (value: number | null) => (value === null ? '-' : value);
const humanize = (value: string) => value.replace(/_/g, ' ');

const tabClass =
  'rounded-none border-b-2 border-transparent px-1 pb-2 pt-1 text-sm text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none';

/** A score read against the level's pass mark. */
const ScoreAgainstPass = ({ score, levelId }: { score: number; levelId: number }) => {
  const pass = passMarkOf(levelId);
  const reached = pass !== null && score >= pass;
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span className={reached ? 'font-medium text-foreground' : 'text-foreground'}>{score}</span>
      {pass !== null && <span className="text-xs text-muted-foreground">/ {pass}</span>}
      {reached && <Check aria-label="at or above the pass mark" className="h-3.5 w-3.5 self-center text-emerald-600 dark:text-emerald-400" />}
    </span>
  );
};

const PlayerName = ({ player }: { player: Pick<ReportPlayer, 'name' | 'detail'> }) => (
  <div className="min-w-0">
    <div className="truncate text-sm font-medium text-foreground">{player.name}</div>
    <div className="truncate text-xs text-muted-foreground">{player.detail}</div>
  </div>
);

const DetailFigure = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg bg-muted/50 px-3 py-2">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
  </div>
);

const PlayerDetail = ({ report }: { report: PlayerReportState }) => {
  const { selected } = report;
  if (!selected) {
    return (
      <Panel className="xl:sticky xl:top-20">
        <EmptyState icon={UserRound} title="Select a player">
          Their levels, recent decisions and other modes appear here.
        </EmptyState>
      </Panel>
    );
  }
  const { player, levels, decisions, exams, legacy } = selected;
  return (
    <Panel
      className="xl:sticky xl:top-20"
      title={player.name}
      description={`${player.detail} · joined ${toDate(player.joinedAt)}`}
      actions={
        <Button size="sm" variant="ghost" aria-label="Close player" onClick={() => report.selectPlayer(null)}>
          <X className="h-4 w-4" />
        </Button>
      }
      bodyClassName="space-y-5"
    >
      <div className="grid grid-cols-2 gap-2">
        <DetailFigure label="Story attempts" value={player.storyAttempts} />
        <DetailFigure label="Average score" value={dash(player.averageScore)} />
        <DetailFigure label="Correct decisions" value={player.correct} />
        <DetailFigure label="Mistakes" value={player.mistakes} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Levels: best score / pass mark</h4>
        {levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Story Mode drive saved yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {levels.map(level => (
              <li key={level.levelId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 text-xs">
                <span className="truncate text-foreground" title={level.name}>
                  {level.name}
                </span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {level.attempts} {level.attempts === 1 ? 'try' : 'tries'}
                </span>
                <span className="whitespace-nowrap">
                  <ScoreAgainstPass score={level.bestScore} levelId={level.levelId} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent decisions</h4>
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No graded decision yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {decisions.map(decision => (
              <li key={`${decision.levelId}-${decision.timestamp}-${decision.action}`} className="flex items-start gap-2 px-3 py-2">
                <span
                  className={
                    decision.result === 'correct'
                      ? 'mt-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300'
                      : 'mt-0.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive'
                  }
                >
                  {decision.result === 'correct' ? 'Correct' : 'Mistake'}
                </span>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="text-foreground">
                    Level {decision.levelId} · {humanize(decision.action)}
                    {decision.expectedAction && decision.result === 'violation' && (
                      <span className="text-muted-foreground"> (expected {humanize(decision.expectedAction)})</span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {[decision.competency && humanize(decision.competency), `${decision.points > 0 ? '+' : ''}${decision.points} pts`]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{toShortDateTime(decision.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other modes</h4>
        <div className="grid grid-cols-2 gap-2">
          <DetailFigure label="Mock exam sittings" value={exams.length} />
          <DetailFigure label="Best mock exam" value={dash(player.examBest)} />
          <DetailFigure label="Daily answers" value={player.dailyAnswers} />
          <DetailFigure label="Daily correct" value={percent(player.dailyCorrect, player.dailyAnswers)} />
        </div>
      </div>

      {legacy && (
        <Notice>
          Saved before progress moved to its own record: {legacy.unlockedLevels?.length ?? 0} levels unlocked, total score{' '}
          {legacy.totalScore ?? 0}. Nothing in this report is counted from it.
        </Notice>
      )}
    </Panel>
  );
};

const PlayersTab = ({ report }: { report: PlayerReportState }) => (
  <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
    <Panel
      title="Players"
      description={`${report.players.length} of ${report.playerCount}, most recently active first. Attempts are Story Mode drives; select a player for their detail.`}
      actions={<SearchField label="Search players" placeholder="Search name, email or code" value={report.playerQuery} onChange={report.setPlayerQuery} />}
      bodyClassName="p-0"
    >
      {report.players.length === 0 ? (
        <EmptyState icon={Users} title={report.playerCount === 0 ? 'No players yet' : 'No player matches'}>
          {report.playerCount === 0 ? 'Accounts appear here once they sign up.' : 'Try a shorter search.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Player</TableHead>
                <TableHead className="whitespace-nowrap text-right">Attempts</TableHead>
                <TableHead className="hidden whitespace-nowrap text-right md:table-cell">Levels</TableHead>
                <TableHead className="hidden whitespace-nowrap text-right md:table-cell">Avg score</TableHead>
                <TableHead className="hidden whitespace-nowrap text-right lg:table-cell">Exam best</TableHead>
                <TableHead className="whitespace-nowrap pr-4">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.players.map(player => {
                const active = report.selected?.player.id === player.id;
                return (
                  <TableRow
                    key={player.id}
                    aria-selected={active}
                    tabIndex={0}
                    onClick={() => report.selectPlayer(player.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        report.selectPlayer(player.id);
                      }
                    }}
                    className={`cursor-pointer ${active ? 'bg-primary/10 hover:bg-primary/10' : ''}`}
                  >
                    <TableCell className="max-w-[16rem] pl-4">
                      <PlayerName player={player} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{player.storyAttempts}</TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums md:table-cell">
                      {player.levelsPlayed === 0 ? '-' : player.levelsPlayed}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums md:table-cell">{dash(player.averageScore)}</TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums lg:table-cell">{dash(player.examBest)}</TableCell>
                    <TableCell className="whitespace-nowrap pr-4 text-xs text-muted-foreground" title={toShortDateTime(player.lastActiveAt)}>
                      {player.lastActiveAt ? toRelative(player.lastActiveAt) : 'Never played'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
    <PlayerDetail report={report} />
  </div>
);

const AttemptsTab = ({ report }: { report: PlayerReportState }) => (
  <Panel
    title="Story attempts"
    description={`${report.attemptsMatching} attempt${report.attemptsMatching === 1 ? '' : 's'}, newest first. Scores are read against each level's pass mark.`}
    actions={
      <>
        <select
          aria-label="Level"
          value={report.attemptLevel ?? ''}
          onChange={event => report.setAttemptLevel(event.target.value === '' ? null : Number(event.target.value))}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All levels</option>
          {report.levels.map(level => (
            <option key={level.id} value={level.id}>
              Level {level.id} · {level.name}
            </option>
          ))}
        </select>
        <SearchField label="Search attempts by player" placeholder="Player name, email or code" value={report.attemptQuery} onChange={report.setAttemptQuery} />
      </>
    }
    bodyClassName="p-0"
  >
    {report.attempts.length === 0 ? (
      <EmptyState icon={Car} title="No attempt matches">
        Story Mode drives appear here once they are saved.
      </EmptyState>
    ) : (
      <>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">When</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Score / pass</TableHead>
                <TableHead className="text-right">Correct</TableHead>
                <TableHead className="pr-4 text-right">Mistakes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.attempts.map((attempt, index) => {
                const player = report.playersById.get(attempt.userId);
                return (
                  <TableRow key={`${attempt.userId}-${attempt.timestamp}-${index}`}>
                    <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">{toShortDateTime(attempt.timestamp)}</TableCell>
                    <TableCell className="max-w-[14rem]">
                      {player ? <PlayerName player={player} /> : <span className="font-mono text-xs text-muted-foreground">{attempt.userId}</span>}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-sm" title={levelName(attempt.levelId)}>
                      {levelName(attempt.levelId)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <ScoreAgainstPass score={attempt.finalScore} levelId={attempt.levelId} />
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{attempt.correctDecisions}</TableCell>
                    <TableCell className="pr-4 text-right text-sm tabular-nums">{attempt.violations}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {report.attempts.length} of {report.attemptsMatching}
          </span>
          {report.attempts.length < report.attemptsMatching && (
            <Button size="sm" variant="outline" onClick={report.showMoreAttempts}>
              Show more
            </Button>
          )}
        </div>
      </>
    )}
  </Panel>
);

const RulesTab = ({ report }: { report: PlayerReportState }) => (
  <Panel
    title="Scoring rules"
    description={`${report.rules.length} of ${report.ruleCount} rules: each kind of scenario the levels grade, the action it expects, and the law it cites.`}
    actions={<SearchField label="Search rules" placeholder="Rule, scenario, action or law" value={report.ruleQuery} onChange={report.setRuleQuery} />}
    bodyClassName="p-0"
  >
    {report.rules.length === 0 ? (
      <EmptyState icon={Scale} title="No rule matches" />
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Scenario</TableHead>
              <TableHead>Correct action</TableHead>
              <TableHead>Levels</TableHead>
              <TableHead className="text-right">Avg points</TableHead>
              <TableHead className="pr-4">Legal basis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rules.map(rule => (
              <TableRow key={rule.id}>
                <TableCell className="pl-4">
                  <div className="text-sm capitalize text-foreground">{humanize(rule.type)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{rule.id}</div>
                </TableCell>
                <TableCell className="text-sm capitalize">{humanize(rule.expectedAction)}</TableCell>
                <TableCell>
                  <div className="flex max-w-[12rem] flex-wrap gap-1">
                    {rule.levelIds.map(id => (
                      <span key={id} className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {id}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{(rule.totalPoints / rule.fires).toFixed(1)}</TableCell>
                <TableCell className="max-w-md pr-4 text-xs text-muted-foreground">
                  <span className="line-clamp-2" title={rule.lawCitation}>
                    {rule.lawCitation ?? '-'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )}
  </Panel>
);

const DownloadOption = ({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof FileBraces;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) => (
  <Panel>
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="flex-1 text-sm text-muted-foreground">{children}</p>
      <div>{action}</div>
    </div>
  </Panel>
);

const DownloadsTab = ({ report }: { report: PlayerReportState }) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <DownloadOption
        icon={FileSpreadsheet}
        title="Story attempts (CSV)"
        action={
          <Button onClick={report.exportAttemptsCSV}>
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        }
      >
        One row per saved Story Mode drive: the account id, level, time, score, mistakes and correct decisions. Opens in any
        spreadsheet.
      </DownloadOption>
      <DownloadOption
        icon={FileBraces}
        title="Everything (JSON)"
        action={
          <Button variant="outline" onClick={report.exportJSON}>
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
        }
      >
        Every player, Story attempt with its decision log, Mock Exam sitting and Daily Challenge answer, with the scoring
        rules.
      </DownloadOption>
    </div>
    <Notice>
      These are quick downloads of what this page shows, and they include emails. The pilot's data for the analysis comes from
      the developers' export script instead, which names accounts by code only.
    </Notice>
  </div>
);

export const PlayerReport = ({ report }: { report: PlayerReportState }) => {
  const { totals } = report;
  const failed = Object.entries(report.collectionErrors);
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Player report"
        description="Every account's activity across Story Mode, the Mock Exam and the Daily Challenge. A pilot account is listed under its code."
        meta={report.loading ? 'Loading...' : report.loadedAt ? `Loaded ${toShortDateTime(report.loadedAt)}` : null}
        actions={
          <Button size="sm" variant="outline" onClick={report.refresh} disabled={report.loading}>
            <RefreshCw className={`h-4 w-4 ${report.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {failed.length > 0 && (
        <Notice tone="error">
          Some records could not be loaded:
          <ul className="mt-1 list-disc pl-4">
            {failed.map(([key, message]) => (
              <li key={key}>
                {COLLECTION_LABEL[key] ?? key}: {message}
              </li>
            ))}
          </ul>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Users} label="Players" value={totals.players} hint={`${totals.playersInStory} played Story Mode`} />
        <StatTile
          icon={Car}
          label="Story attempts"
          value={totals.storyAttempts}
          hint={totals.averageScore === null ? 'No drive yet' : `Average score ${totals.averageScore}`}
        />
        <StatTile
          icon={BookOpenCheck}
          label="Mock exams"
          value={totals.examSittings}
          hint={totals.examSittings === 0 ? 'None yet' : `${totals.examPassed} passed`}
        />
        <StatTile
          icon={CalendarCheck}
          label="Daily answers"
          value={totals.dailyAnswers}
          hint={totals.dailyAnswers === 0 ? 'None yet' : `${percent(totals.dailyCorrect, totals.dailyAnswers)} correct`}
        />
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="players" className={tabClass}>
            Players
          </TabsTrigger>
          <TabsTrigger value="attempts" className={tabClass}>
            Story attempts
          </TabsTrigger>
          <TabsTrigger value="rules" className={tabClass}>
            Scoring rules
          </TabsTrigger>
          <TabsTrigger value="downloads" className={tabClass}>
            Downloads
          </TabsTrigger>
        </TabsList>
        <TabsContent value="players" className="mt-0">
          <PlayersTab report={report} />
        </TabsContent>
        <TabsContent value="attempts" className="mt-0">
          <AttemptsTab report={report} />
        </TabsContent>
        <TabsContent value="rules" className="mt-0">
          <RulesTab report={report} />
        </TabsContent>
        <TabsContent value="downloads" className="mt-0">
          <DownloadsTab report={report} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
