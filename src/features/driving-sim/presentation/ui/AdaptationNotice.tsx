/**
 * The drive has been redirected, and the player is told so before it resumes.
 *
 * Mid-drive, the learner model re-reads everything answered so far and, when
 * the weakest competency changes, the route ahead is re-rolled toward it. That
 * is a real change to the level being played — the events after this point are
 * not the ones that were briefed — so it is acknowledged rather than flashed
 * past. It used to be a three-second banner over a moving road, which is the
 * one moment attention is least available.
 *
 * Distinct from the borrowed practice scenario the re-roll appends. This is the
 * route being re-aimed; that is one scenario arriving at the end of it.
 */
import { Radar } from 'lucide-react';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { getCompetencyLabel } from '@/domain/learner/profile';
import { Button } from '@/shared/ui/button';

interface AdaptationNoticeProps {
  competency: DrivingCompetency;
  onContinue: () => void;
}

const AdaptationNotice = ({ competency, onContinue }: AdaptationNoticeProps) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm">
    <section className="w-full max-w-[460px] overflow-hidden rounded-xl border-2 border-primary/50 bg-card shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" />
          <p className="font-display text-[10px] font-black uppercase tracking-[0.22em] text-primary">
            Route adapted
          </p>
        </div>
        <p className="font-display text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Paused
        </p>
      </header>

      <div className="space-y-3 p-4">
        <p className="text-sm leading-6 text-foreground">
          From how this run is going, <span className="font-semibold">{getCompetencyLabel(competency)}</span>{' '}
          is your weakest area right now, so the rest of the route has been changed to give you more
          of it.
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Only scenarios still far enough ahead to be out of sight were swapped — nothing you have
          already driven past or can see has changed.
        </p>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/50 px-4 py-3">
        <p className="text-[11px] leading-5 text-muted-foreground">The drive is paused.</p>
        <Button onClick={onContinue} className="font-display tracking-wide">
          Continue driving
        </Button>
      </footer>
    </section>
  </div>
);

export default AdaptationNotice;
