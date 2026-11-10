/**
 * The dashboard's first page: the study's enrolled participants,
 * where they stand, and the health of their records.
 *
 * The registry part follows the Participants page's live rows. The records
 * part reads every enrolled participant's attempts and records once per tab,
 * then only what was saved since; its checks are the export's own flags.
 */
import { AlertTriangle, CheckCircle2, ClipboardCheck, HeartPulse, PlayCircle, RefreshCw, UserCheck, UserPlus, Users } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { PilotOverview } from '@/features/admin/domain/pilotOverview';
import type { HealthKind, RecordHealth } from '@/features/admin/domain/recordHealth';
import { EmptyState, Notice, Panel, SectionHeader, StatTile } from './adminUi';
import { stageLabel } from './stageFormat';

const KIND_LABEL: Record<HealthKind, string> = {
  records: 'Records',
  device: 'Device lag',
  procedure: 'Procedure',
  instrument: 'Instrument',
  fidelity: 'Fidelity',
};

export interface OverviewRecords {
  health: RecordHealth | null;
  loading: boolean;
  progress: { done: number; total: number } | null;
  error: string | null;
  readAt: number | null;
  refresh: () => void;
}

interface OverviewSectionProps {
  overview: PilotOverview;
  poolLoading: boolean;
  poolError: string | null;
  records: OverviewRecords;
}

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Bars, one per entry, the count beside each. */
const Bars = ({ entries }: { entries: Array<{ label: string; participants: number }> }) => {
  const most = Math.max(1, ...entries.map(entry => entry.participants));
  return (
    <ul className="space-y-2">
      {entries.map(entry => (
        <li key={entry.label} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm" title={`${entry.label}: ${entry.participants}`}>
          <span className="truncate text-muted-foreground">{entry.label}</span>
          <span className="h-2 rounded-r-sm bg-primary/70" style={{ width: `${(entry.participants / most) * 100}%` }} />
          <span className="text-right font-medium tabular-nums text-foreground">{entry.participants}</span>
        </li>
      ))}
    </ul>
  );
};

/** Where each of the study's participants is in the study's order. */
const Stages = ({ stages, participants }: { stages: PilotOverview['stages']; participants: number }) => (
  <Panel title="Where each participant is in the study" description={`All ${participants} of the study's participants, at the stage their own home shows them.`}>
    {participants === 0 ? (
      <p className="text-sm text-muted-foreground">Nobody has joined the study yet.</p>
    ) : (
      <Bars entries={stages.map(entry => ({ label: stageLabel(entry.stage), participants: entry.participants }))} />
    )}
  </Panel>
);

/** Where the next Continue takes each participant in the course: one bar per place, the count beside it. */
const Places = ({ places }: { places: PilotOverview['places'] }) => {
  const most = Math.max(1, ...places.map(entry => entry.participants));
  return (
    <Panel title="Where the next Continue takes each participant" description="The study's participants in the course: the tutorial, Levels 1–11 or the Final Mission.">
      {places.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody is in the course yet.</p>
      ) : (
        <ul className="space-y-2">
          {places.map(entry => (
            <li key={entry.place} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3 text-sm" title={`${entry.place}: ${entry.participants}`}>
              <span className="truncate text-muted-foreground">{entry.place}</span>
              <span className="h-2 rounded-r-sm bg-primary/70" style={{ width: `${(entry.participants / most) * 100}%` }} />
              <span className="text-right font-medium tabular-nums text-foreground">{entry.participants}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const HealthPanel = ({ records }: { records: OverviewRecords }) => {
  const { health, loading, progress, error, readAt } = records;
  const clean = health !== null && health.issues.length === 0 && health.pending.length === 0 && health.unreadable.length === 0;
  const status = loading
    ? progress
      ? `Reading accounts: ${progress.done} of ${progress.total}`
      : 'Reading the participants'
    : readAt !== null
      ? `Read at ${time(readAt)}${health ? `: ${health.accountsRead} accounts, ${health.attemptsRead} attempts` : ''}`
      : '';
  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          Data health
        </span>
      }
      description={
        <>
          The export's own flags, read from every enrolled participant's attempts and the three records beside each. A refresh reads only
          what was saved since.{status && <span className="block pt-1 text-foreground/80">{status}</span>}
        </>
      }
      actions={
        <Button size="sm" variant="outline" disabled={loading} onClick={records.refresh}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh records
        </Button>
      }
      bodyClassName="space-y-3"
    >
      {error && <Notice tone="error">Could not read the records: {error}</Notice>}
      {clean && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Every record is there, and no check found anything.
        </p>
      )}
      {health && health.pending.length > 0 && (
        <Notice>
          Records on their way (saved moments ago, read again on the next refresh):{' '}
          {health.pending.map(entry => `${entry.code} (${entry.attempts})`).join(', ')}
        </Notice>
      )}
      {health && health.unreadable.length > 0 && (
        <Notice tone="error">
          {health.unreadable.map(entry => (
            <span key={entry.code} className="block">
              {entry.code} could not be read: {entry.error}
            </span>
          ))}
        </Notice>
      )}
      {health && health.issues.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>What it means</TableHead>
                <TableHead>Accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.issues.map(issue => (
                <TableRow key={issue.id}>
                  <TableCell className="whitespace-nowrap align-top">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="font-mono text-xs">{issue.id}</span>
                    </div>
                    <Badge variant="outline" className="mt-1 text-[10px]">
                      {KIND_LABEL[issue.kind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top text-sm text-muted-foreground">{issue.meaning}</TableCell>
                  <TableCell className="align-top text-sm">{issue.codes.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {!health && !loading && !error && <EmptyState title="Not read yet">Refresh records reads every enrolled participant.</EmptyState>}
    </Panel>
  );
};

export const OverviewSection = ({ overview, poolLoading, poolError, records }: OverviewSectionProps) => {
  const { study, cohorts } = overview;
  return (
    <div className="space-y-6">
      <SectionHeader title="Overview" description="Who has joined the study, where they stand, and whether every record is being saved." />

      {poolError && <Notice tone="error">Could not follow the participants: {poolError}</Notice>}

      {poolLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={Users} label="Study participants" value={overview.participants} hint={`${cohorts.dryrun} dry run, ${cohorts.test} test accounts apart`} />
            <StatTile icon={UserPlus} label="Joined today" value={study.enrolledToday} hint={`${study.activeNow} active in the last 15 min`} />
            <StatTile icon={PlayCircle} label="In the course" value={study.inCourse} hint="The tutorial, Levels 1–11 or the Final Mission" />
            <StatTile icon={ClipboardCheck} label="Finished" value={study.done} hint={`${study.withdrawn} withdrawn`} />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
            <Stages stages={overview.stages} participants={overview.participants} />
            <Places places={overview.places} />
          </div>
        </>
      )}

      <HealthPanel records={records} />

      {!poolLoading && overview.participants === 0 && (
        <EmptyState icon={UserCheck} title="Nobody has joined the study yet">
          Participants join at /study/join with the study's invite code.
        </EmptyState>
      )}
    </div>
  );
};
