import { useEffect, useRef } from 'react';
import { Gauge, Play, Route, Timer, Wrench, X } from 'lucide-react';
import type { DrivePreview } from '@/features/driving-sim/domain/scenario/drivePreview';
import { Button } from '@/shared/ui/button';

interface DriveOverviewProps {
  preview: DrivePreview;
  /** The in-drive questions' time limit, in seconds. */
  questionLimitSec: number;
  onStart: () => void;
  onClose: () => void;
}

const STAGE_LABEL = { garage: 'Before the drive', road: 'On the road', aftermath: 'After the drive' } as const;

/**
 * The drive, before it starts: the setting and every scenario in the order it
 * will be met, with its title, situation, competency and format. Nothing in
 * it gives an answer away.
 */
const DriveOverview = ({ preview, questionLimitSec, onStart, onClose }: DriveOverviewProps) => {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    startRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { setting, scenarios } = preview;
  const timed = scenarios.some(s => s.timed);
  const groups = (['garage', 'road', 'aftermath'] as const)
    .map(stage => ({ stage, items: scenarios.filter(s => s.stage === stage) }))
    .filter(group => group.items.length > 0);

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-background/95 backdrop-blur" role="dialog" aria-modal="true" aria-label="Drive overview">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[10px] font-black uppercase tracking-[0.3em] text-primary">Before you drive</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-foreground md:text-3xl">{setting.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{setting.description}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <Gauge className="mb-2 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-black text-foreground">{setting.speedLimit}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Speed limit</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <Route className="mb-2 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-black text-foreground">{scenarios.length}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Scenarios</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <Timer className="mb-2 h-5 w-5 text-primary" />
            <p className="font-display text-2xl font-black text-foreground">{timed ? `${questionLimitSec} s` : 'None'}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Time to answer a road question</p>
          </div>
        </section>

        {(setting.conditions.length > 0 || setting.garage || setting.aftermath) && (
          <section className="rounded-lg border border-border bg-card p-4 text-sm leading-6">
            <p className="mb-1 font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">Setting</p>
            {setting.garage && (
              <p>
                <Wrench className="mr-1 inline h-4 w-4 text-muted-foreground" />
                Starts in {setting.garage.plate}: {setting.garage.points} checks before you drive off.
              </p>
            )}
            {setting.conditions.map(condition => (
              <p key={condition}>Road: {condition}</p>
            ))}
            {setting.aftermath && <p>Ends at {setting.aftermath.plate}: {setting.aftermath.points} steps on foot after the drive.</p>}
          </section>
        )}

        {groups.map(group => (
          <section key={group.stage}>
            <p className="mb-2 font-display text-[10px] font-black uppercase tracking-[0.2em] text-primary">{STAGE_LABEL[group.stage]}</p>
            <ol className="space-y-2">
              {group.items.map(item => (
                <li key={`${item.stage}-${item.id}`} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {item.order}. {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.formatLabel}
                      {item.timed ? ` · ${questionLimitSec} s to answer` : ''}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  {item.competencyLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.competencyLabel}
                      {item.counted ? '' : ' · not counted'}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-4">
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button ref={startRef} onClick={onStart}>
            <Play className="h-4 w-4" />
            Start driving
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriveOverview;
