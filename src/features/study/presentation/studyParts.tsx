import { useState } from 'react';
import { Check, CircleHelp, Circle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { STUDY_STAGES, stageIndex, type StudyStage } from '@/domain/study/studyStage';
import { HELP_CONTACT } from '@/features/study/domain/studyConfig';
import { STAGE_LABELS } from '@/features/study/domain/studyRoutes';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import { studyMessages as m, studyValueMessages as v } from './messages';

/** The participant's code, as every study screen shows it, so it can be quoted when asking for help. */
export const CodeBadge = ({ code }: { code: string }) => (
  <p className="text-center text-xs text-muted-foreground">
    <Say {...m.participantCode} />: <span className="font-display font-bold tracking-widest text-foreground">{code}</span>
  </p>
);

/** How to reach the team, on every study screen. */
export const HelpButton = ({ code }: { code: string | null }) => {
  const [open, setOpen] = useState(false);
  const text = useText();
  return (
    <div className="text-center">
      <Button variant="ghost" size="sm" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <CircleHelp className="h-4 w-4" />
        {text(m.help)}
      </Button>
      {open && (
        <div className="mt-2 space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-left text-sm">
          <p>{text(HELP_CONTACT)}</p>
          {code && (
            <p className="text-xs text-muted-foreground">
              {text(v.sayYourCode(code))}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/** The study's order, with the steps done, the one now, and the ones to come. */
export const StudyTracker = ({ stage }: { stage: StudyStage }) => {
  const now = stageIndex(stage);
  const text = useText();
  return (
    <ol className="space-y-1.5" aria-label={text(m.yourProgressInThe)}>
      {STUDY_STAGES.map((step, index) => {
        const done = index < now;
        const current = index === now;
        return (
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className={`flex items-center gap-2 text-sm ${current ? 'font-semibold text-foreground' : done ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}
          >
            {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Circle className={`h-4 w-4 ${current ? 'text-primary' : ''}`} />}
            <span>{text(STAGE_LABELS[step])}</span>
          </li>
        );
      })}
    </ol>
  );
};
