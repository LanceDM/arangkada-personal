import { useState, type FormEvent } from 'react';
import { STUDY_PASSWORD_MIN, USERNAME_MAX, USERNAME_RULE } from '@/features/auth';
import type { EnrolmentDoc } from '@/domain/study/studyRecords';
import { joinStudy, StudyJoinError } from '@/features/study/application/joinStudy';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, Field, FIELD, InviteInput, PasswordInput, SubmitButton } from './studyFields';
import { studyMessages as m, studyValueMessages as v } from './messages';

const MISMATCH: Localized = m.theTwoPasswordsDiffer;

/**
 * Joining the study: the invite, a username that is not the participant's
 * name, and a password typed twice. Nothing else is asked here;
 * consent comes next.
 */
export const StudyJoinForm = ({
  initialInvite = '',
  onJoined,
  onBusy,
}: {
  initialInvite?: string;
  onJoined: (enrolment: EnrolmentDoc) => void;
  /** Called with true when the join starts and false when it ends: the account is signed in before it is enrolled. */
  onBusy?: (busy: boolean) => void;
}) => {
  const [invite, setInvite] = useState(initialInvite);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== again) {
      setError(MISMATCH);
      return;
    }
    setBusy(true);
    onBusy?.(true);
    try {
      onJoined(await joinStudy({ invite, username, password }));
    } catch (failure) {
      setError(failure instanceof StudyJoinError ? failure.text : m.couldNotJoinTry);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="study-invite" label={<Say {...m.inviteCode} />}>
        <InviteInput value={invite} onChange={setInvite} />
      </Field>
      <Field
        id="study-username"
        label={<Say {...m.chooseAUsername} />}
        hint={
          <>
            {text(USERNAME_RULE)}.{' '}
            <strong>
              <Say {...m.notYourRealName} />
            </strong>
          </>
        }
      >
        <input
          id="study-username"
          name="username"
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={USERNAME_MAX + 2}
          className={FIELD}
        />
      </Field>
      <Field
        id="study-password"
        label={<Say {...m.chooseAPassword} />}
        hint={text(v.passwordHint(STUDY_PASSWORD_MIN))}
      >
        <PasswordInput id="study-password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field id="study-password-again" label={<Say {...m.typeItAgain} />}>
        <PasswordInput id="study-password-again" value={again} onChange={setAgain} autoComplete="new-password" />
      </Field>
      <p className="text-xs text-muted-foreground">
        {text(m.keepYourUsernameAnd)}
      </p>
      <ErrorNote message={error} />
      <SubmitButton busy={busy}>{text(m.join)}</SubmitButton>
    </form>
  );
};
