/**
 * Where the BKT values stand: collecting pilot data, enough data to
 * calibrate, or calibrated values in force. Shown on the admin's BKT pages.
 */
import { Check } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { BKT_CALIBRATION } from '@/domain/learner/mastery/buildBKTProfile';
import { RUN_CONFIG_VERSION } from '@/domain/study/runConfig';
import { PILOT_PLAYERS, calibrationProgress } from '@/features/admin/domain/bktCalibration';
import type { PlayerMastery } from '@/features/admin/domain/courseAdmin';
import { Panel } from './adminUi';

export const BktStagePanel = ({ mastery }: { mastery: readonly PlayerMastery[] }) => {
  const progress = calibrationProgress(mastery, BKT_CALIBRATION);
  const steps = [
    {
      title: 'Collecting pilot data',
      detail: `The published starting values are in force (start 0.30). ${progress.preTestPlayers} of ${PILOT_PLAYERS} pilot player(s) have pre-test answers; ${progress.competenciesReady} of ${progress.competencies} competencies have them from ${progress.playersNeeded} or more players.`,
    },
    {
      title: 'Ready to calibrate',
      detail: 'Every competency has enough pre-tests. Run the calibration in Model evaluation, review the values with the group, and close the pilot.',
    },
    {
      title: 'Calibrated values in force',
      detail: progress.appliedOn
        ? `Applied on ${progress.appliedOn}.`
        : 'The group start per competency and the fitted T, slip and guess are set in the code under a new settings version, for the main study.',
    },
  ];
  return (
    <Panel
      title={`BKT calibration stage: ${steps[progress.step - 1].title}`}
      description={`Settings version ${RUN_CONFIG_VERSION}. Values change between the pilot and the main study, never during one.`}
    >
      <ol className="grid gap-3 text-xs md:grid-cols-3">
        {steps.map((step, i) => {
          const number = i + 1;
          const done = number < progress.step;
          const current = number === progress.step;
          return (
            <li key={step.title} aria-current={current ? 'step' : undefined} className={`rounded-lg border p-3 ${current ? 'border-primary bg-primary/5' : 'border-border'} ${!current && !done ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">{done ? <Check className="h-3 w-3" /> : number}</span>
                {step.title}
                {current && <Badge>now</Badge>}
              </div>
              <p className="mt-1 text-muted-foreground">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
};
