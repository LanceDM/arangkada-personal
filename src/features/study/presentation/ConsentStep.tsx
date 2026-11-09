import { useState, type FormEvent } from 'react';
import { CONSENT_MIN_AGE, checkConsent } from '@/domain/study/consentRecords';
import { giveConsent } from '@/features/study/application/studyActions';
import { CONSENT_AGREEMENT, CONSENT_SECTIONS } from '@/features/study/domain/consentText';
import { Say } from '@/shared/i18n/language';
import { useLanguage, useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, Field, FIELD, SubmitButton } from './studyFields';
import { studyMessages as m, studyValueMessages as v } from './messages';

/**
 * The study information, then consent. The name, the
 * typed signature and the age go to the admin-only consent record and nowhere
 * else. Anyone under 18 is stopped before anything is saved (D4); a
 * guardian's form and the minor's assent are the `guardian` variant, which
 * nothing offers until the adviser rules.
 *
 * The text is shown in the participant's language, and the records say which
 * one it was: a consent is to the text that was read.
 */
export const ConsentStep = ({ uid, code, username, onDone }: { uid: string; code: string; username: string | null; onDone: () => void }) => {
  const [fullName, setFullName] = useState('');
  const [typedSignature, setTypedSignature] = useState('');
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
    const checked = checkConsent({ fullName, typedSignature, age, agreed });
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
        <p className="font-semibold">
          {text(v.forAdults(CONSENT_MIN_AGE))}
        </p>
        <p className="text-muted-foreground">
          {text(m.nothingYouTypedWas)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.studyInformationAndConsent} />
      </h1>
      <div className="space-y-4">
        {CONSENT_SECTIONS.map(section => (
          <section key={section.title.en} className="space-y-1">
            <h2 className="text-sm font-semibold">{text(section.title)}</h2>
            <p className="text-sm">{text(section.body)}</p>
          </section>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {text(m.yourNameAndAge)}
        </p>
        <Field id="consent-name" label={<Say {...m.fullName} />}>
          <input id="consent-name" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" className={FIELD} />
        </Field>
        <Field id="consent-age" label={<Say {...m.age} />}>
          <input id="consent-age" value={age} onChange={e => setAge(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={3} className={FIELD} />
        </Field>
        <Field
          id="consent-signature"
          label={<Say {...m.signatureTypeYourFull} />}
        >
          <input id="consent-signature" value={typedSignature} onChange={e => setTypedSignature(e.target.value)} autoComplete="off" className={FIELD} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1" />
          <span>{text(CONSENT_AGREEMENT)}</span>
        </label>
        <ErrorNote message={error} />
        <SubmitButton busy={busy}>{text(m.iAgree)}</SubmitButton>
      </form>
    </div>
  );
};
