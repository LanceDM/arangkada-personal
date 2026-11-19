import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ActionBar } from '@/shared/ui/ActionBar';
import { confirmSurvey, openSurvey } from '@/features/study/application/studyActions';
import { surveyConfigured, surveyLink } from '@/features/study/domain/studyConfig';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote } from './studyFields';
import { studyMessages as m, studyValueMessages as v } from './messages';

/**
 * The survey: the team's ISO/IEC 25010 + TAM Google
 * Form, opened with the participant code filled in and nothing else, so its
 * answers link to the game's records without a name. The app cannot see a
 * Google Form being submitted, so the participant says so.
 */
export const SurveyStep = ({
  uid,
  code,
  opened,
  onDone,
}: {
  uid: string;
  code: string;
  /** The form was opened before, from this or another visit. */
  opened: boolean;
  onDone: () => void;
}) => {
  const [hasOpened, setHasOpened] = useState(opened);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();
  const ready = surveyConfigured();

  const open = async () => {
    setError(null);
    // Opened in the same click, so the browser does not block it; recorded after.
    window.open(surveyLink(code), '_blank', 'noopener');
    if (hasOpened) return;
    try {
      await openSurvey(uid);
      setHasOpened(true);
    } catch {
      setError(m.couldNotSaveThat);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmSurvey(uid);
      onDone();
    } catch {
      setError(m.couldNotSaveCheck);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.theSurvey} />
      </h1>
      <p className="text-sm">
        {text(v.surveyIntro(code))}
      </p>
      {!ready && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm" role="status">
          {text(m.theSurveyIsNot)}
        </p>
      )}
      <ErrorNote message={error} />
      {ready && (
        <ActionBar className="-mx-6 px-6 sm:-mx-8 sm:px-8 bg-card">
          <Button size="lg" variant={hasOpened ? 'outline' : 'default'} className="h-14 w-full font-display font-bold" onClick={() => void open()}>
            {text(m.openTheSurvey)}
            <ExternalLink className="h-4 w-4" />
          </Button>
          {hasOpened && (
            <Button size="lg" className="h-14 w-full font-display font-bold" disabled={busy} onClick={() => void confirm()}>
              {busy ? text(m.saving) : text(m.iVeSubmittedThe)}
            </Button>
          )}
        </ActionBar>
      )}
    </div>
  );
};
