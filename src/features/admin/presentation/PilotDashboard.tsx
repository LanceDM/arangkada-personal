import { Fragment, useState } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { STUDY_COHORTS, type StudyCohort } from '@/domain/study/participantCode';
import type { StudyStage } from '@/domain/study/studyStage';
import { formatAgo, type PilotRow } from '@/features/admin/domain/pilotProgress';
import type { PilotSessions } from '@/features/admin/application/usePilotSessions';
import type { StudyInvites } from '@/features/admin/application/useStudyInvites';
import { SectionHeader } from './adminUi';
import { stageLabel } from './stageFormat';
import { InvitesPanel } from './InvitesPanel';
import { dateTime, deviceCheckLabel, deviceLabel, gamingLabel, testLabel } from './profileFormat';

interface PilotDashboardProps {
  sessions: PilotSessions;
  invites: StudyInvites;
}

const COHORT_LABEL: Record<StudyCohort, string> = { study: 'Study', dryrun: 'Dry run', test: 'Test' };

const GROUP_LABEL = { conventional: 'Conventional', optimized: 'Optimized' } as const;

const STAGE_TONE: Partial<Record<StudyStage, string>> = {
  tutorial: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  levels: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  final: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
  done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  withdrawn: 'bg-destructive/10 text-destructive border-destructive/30',
};

const enrolledOn = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** What the participant told the study, for the team alone: never exported. */
const ParticipantDetails = ({ row }: { row: PilotRow }) => {
  const { profile, steps } = row;
  const facts: Array<[string, string]> = [
    ['Username', profile.username ?? (steps.consentedAt === null ? 'After consent' : 'Not recorded')],
    ['Age', profile.age === null ? '—' : String(profile.age)],
    ['Consented', steps.consentedAt === null ? '—' : `${dateTime(steps.consentedAt)}${profile.consentVersion ? ` · text ${profile.consentVersion}` : ''}`],
    ['Enrolled', dateTime(row.enrolledAt)],
    ['Plays video games', gamingLabel(profile.gaming)],
    ['Will play on', deviceLabel(profile.device)],
    ['Device check', deviceCheckLabel(profile.deviceCheck)],
    ['Pre-test', testLabel(steps.preTest)],
    ['Post-test', testLabel(steps.postTest)],
    [
      'Survey',
      steps.surveyConfirmedAt !== null
        ? `Submitted ${dateTime(steps.surveyConfirmedAt)}`
        : steps.surveyOpenedAt !== null
          ? 'Opened, not confirmed'
          : '—',
    ],
    ...(row.withdrawnAt !== null ? [['Withdrew', dateTime(row.withdrawnAt)] as [string, string]] : []),
  ];
  return (
    <dl className="grid gap-x-6 gap-y-2 py-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {facts.map(([term, value]) => (
        <div key={term} className="flex gap-2">
          <dt className="w-32 shrink-0 text-muted-foreground">{term}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

const CohortTable = ({ cohort, rows, now }: { cohort: StudyCohort; rows: PilotRow[]; now: number }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {COHORT_LABEL[cohort]} ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Now at</TableHead>
              <TableHead>Drives</TableHead>
              <TableHead>Last activity</TableHead>
              <TableHead title="The frozen design's group, played until redesign step 6">Group (frozen)</TableHead>
              <TableHead>
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
                  Nobody has joined with a {COHORT_LABEL[cohort].toLowerCase()} invite yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map(row => (
              <Fragment key={row.code}>
                <TableRow>
                  <TableCell className="text-sm font-semibold tabular-nums">{row.code}</TableCell>
                  <TableCell className="text-sm">{row.name ?? <span className="text-xs text-muted-foreground">No consent yet</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{enrolledOn(row.enrolledAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STAGE_TONE[row.stage] ?? 'bg-muted text-muted-foreground border-transparent'}>
                      {stageLabel(row.stage)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.place}</TableCell>
                  <TableCell className="text-xs tabular-nums">{row.storyAttempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.lastActivityAt === null ? '—' : formatAgo(row.lastActivityAt, now)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.group ? GROUP_LABEL[row.group] : 'None'}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      aria-expanded={open === row.code}
                      onClick={() => setOpen(open === row.code ? null : row.code)}
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                    >
                      {open === row.code ? 'Hide' : 'Details'}
                    </button>
                  </TableCell>
                </TableRow>
                {open === row.code && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={9}>
                      <ParticipantDetails row={row} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

/**
 * The study's enrolled participants, by code, name and cohort,
 * followed live, each at their stage of the study's order; and the invites
 * they join with. Progress only, never a score or a result.
 */
export const PilotDashboard = ({ sessions, invites }: PilotDashboardProps) => (
  <div className="space-y-6">
    <SectionHeader
      title="Participants"
      description="Everyone who joined with an invite: the code the app gave them, the name they gave at consent, so you know who to help, and their stage in the study. Details adds their username, age and background answers. It shows progress only, and the export carries the code and the age band alone."
    />

    <InvitesPanel invites={invites} />

    {sessions.error && (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-4 text-sm text-destructive">Could not follow the participants: {sessions.error}</CardContent>
      </Card>
    )}

    {sessions.loading ? (
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    ) : (
      STUDY_COHORTS.map(cohort => (
        <CohortTable key={cohort} cohort={cohort} rows={sessions.rows.filter(row => row.cohort === cohort)} now={sessions.now} />
      ))
    )}
  </div>
);
