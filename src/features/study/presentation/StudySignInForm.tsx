import { useState, type FormEvent } from 'react';
import { USERNAME_MAX } from '@/features/auth';
import { signInToStudy, StudyJoinError } from '@/features/study/application/joinStudy';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, Field, FIELD, PasswordInput, SubmitButton } from './studyFields';
import { studyMessages as m } from './messages';

/** A participant's sign-in, by username. */
export const StudySignInForm = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signInToStudy(username, password);
      onSignedIn();
    } catch (failure) {
      setError(failure instanceof StudyJoinError ? failure.text : m.couldNotSignIn);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field id="study-sign-in-username" label={<Say {...m.username} />}>
        <input
          id="study-sign-in-username"
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
      <Field id="study-sign-in-password" label={<Say {...m.password} />}>
        <PasswordInput id="study-sign-in-password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <ErrorNote message={error} />
      <SubmitButton busy={busy}>{text(m.signIn)}</SubmitButton>
    </form>
  );
};
