import { useState, type FormEvent } from 'react';
import type { EnrolmentDoc } from '@/domain/study/studyRecords';
import { enrolWithInvite, StudyJoinError } from '@/features/study/application/joinStudy';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, Field, InviteInput, SubmitButton } from './studyFields';
import { studyMessages as m } from './messages';

/**
 * For a study account that is signed in but has no code yet: its join
 * stopped after the account was made. Asks for the invite alone.
 */
export const StudyInviteForm = ({ uid, onJoined }: { uid: string; onJoined: (enrolment: EnrolmentDoc) => void }) => {
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onJoined(await enrolWithInvite(uid, invite));
    } catch (failure) {
      setError(failure instanceof StudyJoinError ? failure.text : m.couldNotJoinTry);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {text(m.yourAccountIsMade)}
      </p>
      <Field id="study-invite" label={<Say {...m.inviteCode} />}>
        <InviteInput value={invite} onChange={setInvite} />
      </Field>
      <ErrorNote message={error} />
      <SubmitButton busy={busy}>{text(m.join)}</SubmitButton>
    </form>
  );
};
