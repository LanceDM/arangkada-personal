import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { changeStudyPassword, StudyAuthError } from '@/features/auth/application/authActions';
import { STUDY_PASSWORD_MIN } from '@/features/auth/domain/studyIdentity';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { passwordMessages as m } from './messages';

const INPUT =
  'w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary/60';

/**
 * A study participant changes their password: after a reset by the
 * developers, or whenever they like. No email is involved, so the current
 * password is asked for first.
 */
const StudyPasswordForm = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: Localized } | null>(null);
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next !== again) {
      setMessage({ ok: false, text: m.theTwoNewPasswords });
      return;
    }
    setBusy(true);
    try {
      await changeStudyPassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      setMessage({ ok: true, text: m.yourPasswordIsChanged });
    } catch (failure) {
      setMessage({ ok: false, text: failure instanceof StudyAuthError ? failure.text : m.couldNotChangeIt });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 p-5">
      <p className="text-foreground font-black uppercase italic text-sm">{text(m.changePassword)}</p>
      <input type="password" aria-label="Current password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className={INPUT} />
      <input type="password" aria-label="New password" placeholder={`New password, at least ${STUDY_PASSWORD_MIN} characters`} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" className={INPUT} />
      <input type="password" aria-label="New password again" placeholder="New password again" value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" className={INPUT} />
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
          {text(message.text)}
        </p>
      )}
      <Button type="submit" size="sm" disabled={busy || !current || !next}>
        {busy ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
};

export default StudyPasswordForm;
