import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { useStudyProgress } from '@/features/study/application/studyProgress';
import { nextStepOf, type NextStep } from '@/features/study/domain/studyRoutes';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import { StudyInviteForm } from './StudyInviteForm';
import { HelpButton, StudyTracker } from './studyParts';
import { WithdrawPanel } from './WithdrawPanel';
import { studyMessages as m } from './messages';

/**
 * The participant's guided home: their code, one big
 * "Next step", the study's order with where they are in it, help, and
 * withdrawal. Every step comes back here, and it reads where the participant
 * stands each time it opens, so closing the app and coming back resumes at
 * the same step.
 */
export const StudyHome = ({ uid, onNext, onSignOut }: { uid: string; onNext: (step: NextStep) => void; onSignOut: () => void }) => {
  const progress = useStudyProgress();
  const { refresh } = progress;
  const text = useText();

  // Read afresh every time the home opens: it is where every step returns.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = (
    <div className="text-center">
      <Button variant="ghost" size="sm" onClick={onSignOut}>
        {text(m.signOut)}
      </Button>
    </div>
  );

  if (progress.status === 'loading' || progress.status === 'none') return <div className="h-64 rounded-xl bg-muted animate-pulse" />;
  if (progress.status === 'error') {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-destructive">
          {text(m.yourStudyRecordCould)}
        </p>
        <Button onClick={() => void refresh()}>{text(m.tryAgain)}</Button>
        {signOut}
      </div>
    );
  }
  if (progress.status === 'not-enrolled') {
    return (
      <>
        <StudyInviteForm uid={uid} onJoined={() => void refresh()} />
        {signOut}
      </>
    );
  }

  const { enrolment, stage } = progress;
  const next = nextStepOf(stage);

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-sm text-muted-foreground">
          <Say {...m.yourParticipantCode} />
        </p>
        <p className="font-display text-4xl font-bold tracking-widest text-primary">{enrolment.code}</p>
      </div>

      {stage === 'withdrawn' ? (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-center text-sm">
          {text(m.youHaveWithdrawnFrom)}
        </p>
      ) : (
        next && (
          <Button size="lg" className="h-auto min-h-16 w-full whitespace-normal py-3 font-display text-base font-bold" onClick={() => onNext(next)}>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-xs font-normal opacity-80">{text(m.nextStep)}</span>
              <span>{text(next.label).toUpperCase()}</span>
            </span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        )
      )}

      {stage !== 'withdrawn' && <StudyTracker stage={stage} />}

      <HelpButton code={enrolment.code} />
      {stage !== 'withdrawn' && stage !== 'done' && <WithdrawPanel code={enrolment.code} onWithdrawn={() => void refresh()} />}
      {signOut}
    </div>
  );
};
