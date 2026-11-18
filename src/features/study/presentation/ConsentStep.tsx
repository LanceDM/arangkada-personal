import { useState, type FormEvent } from 'react';
import { CONSENT_MIN_AGE, checkConsent } from '@/domain/study/consentRecords';
import { giveConsent } from '@/features/study/application/studyActions';
import { CONSENT_AGREEMENT, CONSENT_INTRO, CONSENT_SECTIONS, CONSENT_TITLE } from '@/features/study/domain/consentText';
import { useLanguage, useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, Field, FIELD, SubmitButton } from './studyFields';
import { studyMessages as m, studyValueMessages as v } from './messages';

/**
 * The study information, then consent (2026-11-19), laid out like the
 * Terms and Data Use at sign-up: the text in a box to scroll through, one box
 * to tick, and the name and age. Ticking the box with the name typed is the
 * signature, so the record's typed signature is the name as typed. The name
 * and age go to the admin-only consent record and nowhere else. Anyone under
 * 18 is stopped before anything is saved (D4).
 *
 * The text is shown in the participant's language, and the records say which
 * one it was: a consent is to the text that was read.
 */
export const ConsentStep = ({ uid, code, username, onDone }: { uid: string; code: string; username: string | null; onDone: () => void }) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [minor, setMinor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const { language } = useLanguage();
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const checked = checkConsent({ fullName, typedSignature: fullName, age, agreed });
    if (checked.kind === 'minor') {
      setMinor(true);
      return;
    }
    if (checked.kind === 'problem') {
      setError(checked.message);
      return;
    }
    setBusy(true);
    try {
      await giveConsent(uid, { participantCode: code, fullName: checked.fullName, typedSignature: checked.typedSignature, age: checked.age, username, language });
      onDone();
    } catch {
      setError(m.yourConsentCouldNot);
    } finally {
      setBusy(false);
    }
  };

  if (minor) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
        <p className="font-semibold">{text(v.forAdults(CONSENT_MIN_AGE))}</p>
        <p className="text-muted-foreground">{text(m.nothingYouTypedWas)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-1 text-center">
        <h1 className="font-display text-lg font-bold">{text(CONSENT_TITLE)}</h1>
        <p className="text-xs text-muted-foreground">{text(CONSENT_INTRO)}</p>
      </div>

      <div
        className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-4 text-xs"
        tabIndex={0}
        aria-label={text(CONSENT_TITLE)}
      >
        {CONSENT_SECTIONS.map(section => (
          <section key={section.title.en} className="space-y-1">
            <h2 className="font-semibold text-foreground">{text(section.title)}</h2>
            <p className="leading-relaxed text-muted-foreground">{text(section.body)}</p>
          </section>
        ))}
      </div>

      <Field id="consent-name" label={text(m.fullName)}>
        <input id="consent-name" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" className={FIELD} />
      </Field>
      <Field id="consent-age" label={text(m.age)} hint={text(m.yourNameAndAge)}>
        <input id="consent-age" value={age} onChange={e => setAge(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={3} className={FIELD} />
      </Field>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <label className="flex items-start gap-2 text-xs text-foreground">
          <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setError(null); }} className="mt-0.5" />
          <span>{text(CONSENT_AGREEMENT)}</span>
        </label>
      </div>

      <ErrorNote message={error} />
      <SubmitButton busy={busy}>{text(m.iAgree)}</SubmitButton>
    </form>
  );
};
