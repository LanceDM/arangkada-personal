/**
 * Where the BKT calibration stands, on the admin's BKT pages: which value set
 * new players get, and how many players are marked pilot with pre-tests
 * against the minimum needed to calibrate.
 */
import { Badge } from '@/shared/ui/badge';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { calibrationProgress } from '@/features/admin/domain/bktCalibration';
import type { PlayerMastery } from '@/features/admin/domain/courseAdmin';
import type { BktSets } from '@/features/admin/application/useBktSets';
import { Panel } from './adminUi';
import { toDateTime } from './formatDate';

export const BktStagePanel = ({ mastery, bkt }: { mastery: readonly PlayerMastery[]; bkt: BktSets }) => {
  const progress = calibrationProgress(mastery, bkt.pilotIds, bkt.state);
  const steps = [
    {
      title: 'Mark pilot players',
      detail: `${progress.marked} player(s) marked pilot; ${progress.markedWithPreTest} of the ${progress.needed} needed have pre-test answers. Mark players in the table below (leave test playthroughs unmarked).`,
    },
    {
      title: 'Calibrate and apply',
      detail: `Model evaluation > BKT: calibration fits the start per competency, T and the slips on every marked player, and applies them as Calibration ${progress.number + 1}.${progress.competenciesReady < progress.competencies ? ` ${progress.competenciesReady} of ${progress.competencies} competencies have pre-tests from ${progress.needed} marked players; until all do, one shared start is fitted.` : ''}`,
    },
  ];
  return (
    <Panel
      title={`BKT values for new players: ${progress.inForce}`}
      description={`${progress.number === 0 ? 'The published values (start 0.30). ' : `Applied ${toDateTime(progress.appliedAt)}. `}Every player keeps the set they started on to the end of their course; a new calibration only changes the set for players who start after it. Settings version ${RUN_CONFIG_VERSION}.`}
    >
      <ol className="grid gap-3 text-xs md:grid-cols-2">
        {steps.map((step, i) => {
          const current = i + 1 === progress.step;
          return (
            <li key={step.title} aria-current={current ? 'step' : undefined} className={`rounded-lg border p-3 ${current ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">{i + 1}</span>
                {step.title}
                {current && <Badge>now</Badge>}
              </div>
              <p className="mt-1 text-muted-foreground">{step.detail}</p>
            </li>
          );
        })}
      </ol>
      {bkt.error && <p className="mt-2 text-xs text-destructive">Could not read the value sets: {bkt.error}</p>}
    </Panel>
  );
};
