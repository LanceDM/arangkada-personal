import { useEffect } from 'react';
import { ChevronRight, ClipboardList, ExternalLink } from 'lucide-react';
import { SURVEY_URL } from '@/shared/lib/survey';
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
 *
 * The survey's Google Form is open from every stage (2026-11-19), like the
 * homepage's: a participant need not finish the course to answer it. The
 * in-app survey step keeps its place in the order.
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

      {stage !== 'withdrawn' && (
        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border-2 border-primary/60 bg-primary/10 p-3 transition-colors hover:bg-primary/20"
        >
          <ClipboardList className="h-6 w-6 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="block font-display text-sm font-bold">{text(m.takeTheSurvey)}</span>
            <span className="block text-xs text-muted-foreground">{text(m.surveyAnyTime)}</span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
      )}

      {stage !== 'withdrawn' && <StudyTracker stage={stage} />}

      <HelpButton code={enrolment.code} />
      {stage !== 'withdrawn' && stage !== 'done' && <WithdrawPanel code={enrolment.code} onWithdrawn={() => void refresh()} />}
      {signOut}
    </div>
  );
};
