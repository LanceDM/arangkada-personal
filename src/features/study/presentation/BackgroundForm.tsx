import { useState, type FormEvent } from 'react';
import { DEVICE_TYPES, GAMING_FREQUENCIES, type DeviceType, type GamingFrequency } from '@/domain/study/consentRecords';
import { ActionBar } from '@/shared/ui/ActionBar';
import { saveBackground } from '@/features/study/application/studyActions';
import { Say } from '@/shared/i18n/language';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { ErrorNote, SubmitButton } from './studyFields';
import { studyMessages as m } from './messages';

const GAMING_LABELS: Record<GamingFrequency, Localized> = {
  never: m.never,
  'less-than-monthly': m.lessThanOnceA,
  monthly: m.aboutOnceAMonth,
  weekly: m.everyWeek,
  daily: m.everyDay,
};

const DEVICE_LABELS: Record<DeviceType, Localized> = {
  phone: m.phone,
  tablet: m.tablet,
  laptop: m.laptop,
  desktop: m.desktopComputer,
};

const Choice = <T extends string>({
  name,
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  name: string;
  legend: Localized;
  options: readonly T[];
  labels: Record<T, Localized>;
  value: T | null;
  onChange: (value: T) => void;
}) => (
  <fieldset className="space-y-2">
    <legend className="mb-1 text-sm font-semibold">
      <Say {...legend} />
    </legend>
    {options.map(option => (
      <label key={option} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
        <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
        <Say {...labels[option]} />
      </label>
    ))}
  </fieldset>
);

/**
 * About the participant: two questions, the covariates
 * the learning curve is adjusted for besides the pre-test. The age band comes
 * from the age given at consent, so it is not asked again. Every participant
 * is a licence applicant, so neither a licence nor driving hours is asked.
 */
export const BackgroundForm = ({ uid, onDone }: { uid: string; onDone: () => void }) => {
  const [gaming, setGaming] = useState<GamingFrequency | null>(null);
  const [device, setDevice] = useState<DeviceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Localized | null>(null);
  const text = useText();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!gaming || !device) {
      setError(m.answerBothQuestions);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveBackground(uid, { gaming, device });
      onDone();
    } catch {
      setError(m.yourAnswersCouldNot);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="text-center font-display text-lg font-bold">
        <Say {...m.aboutYou} />
      </h1>
      <Choice
        name="gaming"
        legend={m.howOftenDoYou}
        options={GAMING_FREQUENCIES}
        labels={GAMING_LABELS}
        value={gaming}
        onChange={setGaming}
      />
      <Choice
        name="device"
        legend={m.whatWillYouPlay}
        options={DEVICE_TYPES}
        labels={DEVICE_LABELS}
        value={device}
        onChange={setDevice}
      />
      <ErrorNote message={error} />
      <ActionBar className="-mx-6 px-6 sm:-mx-8 sm:px-8 bg-card">
        <SubmitButton busy={busy}>{text(m.save)}</SubmitButton>
      </ActionBar>
    </form>
  );
};
