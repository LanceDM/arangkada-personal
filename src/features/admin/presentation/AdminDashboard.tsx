import {
  Activity,
  BookOpen,
  ChevronRight,
  Cpu,
  Download,
  Layers,
  LogOut,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { LEVELS } from '@/features/driving-sim';

import { toDateTime } from './formatDate';
import { QTablePanel } from './QTablePanel';
import type {
  AttemptRow,
  DailyRow,
  LegacyLevelResult,
  RuleSummary,
  UserActionLog,
  UserRow,
} from '@/features/admin/domain/adminReport';

interface AdminDashboardProps {
  userEmail?: string | null;
  users: UserRow[];
  attempts: AttemptRow[];
  examResultsCount: number;
  dailyResultsCount: number;
  isLoading: boolean;
  loadError: string | null;
  collectionErrors: Record<string, string>;
  onRefresh: () => void;
  onSignOut: () => void;
  rules: RuleSummary[];
  levelFilter: string;
  onLevelFilterChange: (value: string) => void;
  selectedUser: UserRow | null;
  onSelectUser: (userId: string) => void;
  onClearSelectedUser: () => void;
  filteredAttempts: AttemptRow[];
  selectedUserResults: LegacyLevelResult[];
  selectedUserAttempts: AttemptRow[];
  selectedUserDailyResults: DailyRow[];
  selectedUserLogs: UserActionLog[];
  completedLevelCount: number;
  totalViolations: number;
  totalCorrect: number;
  averageScore: number;
  topWeakCompetencies: [string, number][];
  onExportJSON: () => void;
  onExportAttemptsCSV: () => void;
  /** Study data of the per-competency course (no IRT). */
  onExportStudy: (kind: 'json' | 'bkt' | 'decisions' | 'rewards' | 'background' | 'qupdates' | 'bktlog') => void;
  studyParticipants: number;
}

export const AdminDashboard = ({
  userEmail,
  users,
  attempts,
  examResultsCount,
  dailyResultsCount,
  isLoading,
  loadError,
  collectionErrors,
  onRefresh,
  onSignOut,
  rules,
  levelFilter,
  onLevelFilterChange,
  selectedUser,
  onSelectUser,
  onClearSelectedUser,
  filteredAttempts,
  selectedUserResults,
  selectedUserAttempts,
  selectedUserDailyResults,
  selectedUserLogs,
  completedLevelCount,
  totalViolations,
  totalCorrect,
  averageScore,
  topWeakCompetencies,
  onExportJSON,
  onExportAttemptsCSV,
  onExportStudy,
  studyParticipants,
}: AdminDashboardProps) => (
  <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="font-display text-sm tracking-widest text-primary">ARANGKADA ADMIN</h1>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/play">Game</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-4 p-4">
      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Users" value={users.length} />
        <MetricCard icon={Activity} label="Attempts" value={attempts.length} />
        <MetricCard icon={BookOpen} label="Completed levels" value={completedLevelCount} />
        <MetricCard icon={Cpu} label="Average score" value={averageScore} />
      </section>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">
            <Activity className="mr-1 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="attempts">
            <Layers className="mr-1 h-4 w-4" />
            Attempts
          </TabsTrigger>
          <TabsTrigger value="qtable">
            <Cpu className="mr-1 h-4 w-4" />
            Q-table (live)
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Cpu className="mr-1 h-4 w-4" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-1 h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Players</CardTitle>
                {collectionErrors.users && (
                  <p className="text-xs text-destructive">users collection: {collectionErrors.users}</p>
                )}
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          No player documents loaded from Firestore users.
                        </TableCell>
                      </TableRow>
                    )}
                    {users.map((row) => {
                      const results = Object.values(row.progress?.levelResults ?? {});
                      const completed = results.filter((result) => result.completed).length;

                      return (
                        <TableRow key={row.id} className="cursor-pointer" onClick={() => onSelectUser(row.id)}>
                          <TableCell>
                            <div className="text-xs font-semibold">{row.username || 'Driver'}</div>
                            <div className="max-w-[220px] truncate text-[10px] text-muted-foreground">{row.email}</div>
                          </TableCell>
                          <TableCell className="text-xs">{row.totalScore ?? row.progress?.totalScore ?? 0}</TableCell>
                          <TableCell className="text-xs">
                            {completed}/{LEVELS.length}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">{toDateTime(row.createdAt)}</TableCell>
                          <TableCell className="w-8">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {selectedUser ? (
              <UserProgressCard
                user={selectedUser}
                results={selectedUserResults}
                attempts={selectedUserAttempts}
                dailyResults={selectedUserDailyResults}
                logs={selectedUserLogs}
                onClose={onClearSelectedUser}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Learning signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground">Correct decisions</div>
                      <div className="font-display text-2xl text-primary">{totalCorrect}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground">Violations</div>
                      <div className="font-display text-2xl text-destructive">{totalViolations}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground">Exam attempts</div>
                      <div className="font-display text-2xl text-primary">{examResultsCount}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <div className="text-xs text-muted-foreground">Daily results</div>
                      <div className="font-display text-2xl text-primary">{dailyResultsCount}</div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Weakest competencies
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {topWeakCompetencies.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No weakness data yet.</span>
                      ) : (
                        topWeakCompetencies.map(([name, count]) => (
                          <Badge key={name} variant="outline">
                            {name.replace(/_/g, ' ')}: {count}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="attempts">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-sm">Attempts</CardTitle>
                <p className="text-xs text-muted-foreground">Ordered by latest saved run.</p>
              </div>
              <div className="sm:ml-auto">
                <Input
                  className="h-9 w-32"
                  placeholder="Level"
                  value={levelFilter}
                  onChange={(event) => onLevelFilterChange(event.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead>Violations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map((attempt, index) => (
                    <TableRow key={`${attempt.userId}-${attempt.timestamp}-${index}`}>
                      <TableCell className="text-xs">{toDateTime(attempt.timestamp)}</TableCell>
                      <TableCell className="max-w-[160px] truncate font-mono text-[10px]">{attempt.userId}</TableCell>
                      <TableCell className="text-xs">{attempt.levelId}</TableCell>
                      <TableCell className="text-xs">{attempt.finalScore}</TableCell>
                      <TableCell className="text-xs text-primary">{attempt.correctDecisions}</TableCell>
                      <TableCell className="text-xs text-destructive">{attempt.violations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Production rule inventory</CardTitle>
              <p className="text-xs text-muted-foreground">
                Derived from level scenario events and weighted by the learning engine at runtime.
              </p>
            </CardHeader>
            <CardContent className="max-h-[560px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Expected action</TableHead>
                    <TableHead>Levels</TableHead>
                    <TableHead>Avg points</TableHead>
                    <TableHead>Citation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-[10px]">{rule.id}</TableCell>
                      <TableCell className="text-xs">{rule.type}</TableCell>
                      <TableCell className="text-xs">{rule.expectedAction}</TableCell>
                      <TableCell className="text-xs">{rule.levelIds.join(', ')}</TableCell>
                      <TableCell className="text-xs">{(rule.totalPoints / rule.fires).toFixed(1)}</TableCell>
                      <TableCell className="max-w-md text-[10px] text-muted-foreground">
                        {rule.lawCitation ?? '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qtable">
          <QTablePanel />
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Data export</CardTitle>
              <p className="text-xs text-muted-foreground">
                Export Firebase training data for analysis, reporting, and thesis appendices.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={onExportAttemptsCSV}>
                <Download className="h-4 w-4" />
                Attempts CSV
              </Button>
              <Button variant="outline" onClick={onExportJSON}>
                <Download className="h-4 w-4" />
                Full JSON
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Study data: per-competency course</CardTitle>
              <p className="text-xs text-muted-foreground">
                {studyParticipants} participant(s). BKT is replayed per participant and also exported as logged; the Q-table is
                shared, with its full update log. Participants appear by user id and study code. IRT (ability, item difficulty) is not
                included.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => onExportStudy('json')}>
                <Download className="h-4 w-4" />
                Study JSON
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('bkt')}>
                <Download className="h-4 w-4" />
                BKT trajectory CSV
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('decisions')}>
                <Download className="h-4 w-4" />
                Decisions CSV
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('rewards')}>
                <Download className="h-4 w-4" />
                Rewards CSV
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('background')}>
                <Download className="h-4 w-4" />
                Background CSV
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('qupdates')}>
                <Download className="h-4 w-4" />
                Q-table log CSV
              </Button>
              <Button variant="outline" onClick={() => onExportStudy('bktlog')}>
                <Download className="h-4 w-4" />
                BKT log CSV (as logged)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  </div>
);

const UserProgressCard = ({
  user,
  results,
  attempts,
  dailyResults,
  logs,
  onClose,
}: {
  user: UserRow;
  results: LegacyLevelResult[];
  attempts: AttemptRow[];
  dailyResults: DailyRow[];
  logs: UserActionLog[];
  onClose: () => void;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
      <div>
        <CardTitle className="text-sm">{user.username || 'Driver'} progress</CardTitle>
        <p className="max-w-[280px] truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Close
      </Button>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Total score</div>
          <div className="font-display text-2xl text-primary">{user.progress?.totalScore ?? user.totalScore ?? 0}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Unlocked</div>
          <div className="font-display text-2xl text-primary">{user.progress?.unlockedLevels?.length ?? 0}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Attempts</div>
          <div className="font-display text-2xl text-primary">{attempts.length}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">Daily answers</div>
          <div className="font-display text-2xl text-primary">
            {Object.keys(user.progress?.daily?.answersByDate ?? {}).length || dailyResults.length}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Level results</div>
        <div className="max-h-56 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Stars</TableHead>
                <TableHead>Correct</TableHead>
                <TableHead>Violations</TableHead>
                <TableHead>Weakest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.levelId}>
                  <TableCell className="text-xs">{result.levelId}</TableCell>
                  <TableCell className="text-xs">{result.score}</TableCell>
                  <TableCell className="text-xs">{result.stars}</TableCell>
                  <TableCell className="text-xs text-primary">{result.correctActions}</TableCell>
                  <TableCell className="text-xs text-destructive">{result.violations}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">
                    {result.weakestCompetency?.replace(/_/g, ' ') ?? '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {results.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">No level progress saved yet.</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent actions</div>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="text-xs text-muted-foreground">No action logs yet.</div>
          ) : (
            logs.map((log) => (
              <div key={`${log.levelId}-${log.timestamp}-${log.action}`} className="rounded-md border border-border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={log.result === 'correct' ? 'default' : log.result === 'violation' ? 'destructive' : 'secondary'}
                  >
                    {log.result}
                  </Badge>
                  <span className="font-semibold">Level {log.levelId}</span>
                  <span>{log.action}</span>
                  <span className="ml-auto text-muted-foreground">{toDateTime(log.timestamp)}</span>
                </div>
                {(log.ruleId || log.expectedAction) && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {log.ruleId ?? 'Rule'} · expected {log.expectedAction ?? '-'} · points {log.points}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl text-primary">{value}</div>
      </div>
    </CardContent>
  </Card>
);
