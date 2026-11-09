/**
 * The consent, the device check, the survey and a withdrawal, as stored
 *. `firestore.rules` holds each shape.
 *
 *   consents/{uid}                 ConsentDoc: name, typed signature, age, username. Admin-read only,
 *                                  never in any export, apart from every game record
 *   users/{uid}/study/consent      ConsentMarker: that it was given, which text, and the age
 *                                  band. No name and no exact age
 *   users/{uid}/study/background   BackgroundDoc: gaming and device
 *   users/{uid}/study/device       DeviceCheckDoc
 *   users/{uid}/study/survey       SurveyDoc: when the form was opened, and confirmed
 *   participants/{code}.withdrawal Withdrawal
 *
 * Name and age are personal information under RA 10173 §3(g), and the only
 * personal information the study collects: no email, no phone. The consent
 * record is the only place they are written, beside the account's username,
 * so the team can tell a participant who has lost their password which
 * username to sign in with. It is how the team knows who a
 * code is, to help a participant who has lost their password; the study's
 * records and exports name the code alone.
 */

import type { Language, Localized } from '@/shared/lib/localized';

/** The consent text's version: the record says which text was agreed to. */
export const CONSENT_VERSION = 'draft-2026-11-04b';

/**
 * The youngest age the consent page accepts. Under it the page
 * stops and saves nothing until the adviser rules on a guardian's consent
 * and the minor's assent; `firestore.rules` holds the same floor.
 */
export const CONSENT_MIN_AGE = 18;
export const CONSENT_MAX_AGE = 100;

/**
 * `adult` is the only variant offered. `guardian` is where a minor's form
 * goes if the adviser allows one: a guardian's consent and the minor's
 * assent (PHREB, 2022). Nothing offers it yet.
 */
export type ConsentVariant = 'adult' | 'guardian';

export const NAME_MAX = 100;

/**
 * The age bands the study's data carries in place of the exact age, which
 * stays in the consent record. Ten-year bands from 25, after an 18–24 band
 * for the youngest applicants (a labelled assumption; `firestore.rules`
 * computes the same band).
 */
export const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const ageBandOf = (age: number): AgeBand =>
  age < 25 ? '18-24' : age < 35 ? '25-34' : age < 45 ? '35-44' : age < 55 ? '45-54' : '55+';

/** How often the participant plays video games: a covariate of the learning curve. */
export const GAMING_FREQUENCIES = ['never', 'less-than-monthly', 'monthly', 'weekly', 'daily'] as const;
export type GamingFrequency = (typeof GAMING_FREQUENCIES)[number];

/** The device the participant says they will play on; the device check measures it too. */
export const DEVICE_TYPES = ['phone', 'tablet', 'laptop', 'desktop'] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export interface ConsentDoc {
  schemaVersion: 1;
  consentVersion: string;
  /** The language the consent text was shown in. */
  consentLanguage: Language;
  variant: ConsentVariant;
  participantCode: string;
  fullName: string;
  /** The participant's full name typed a second time, as their signature. */
  typedSignature: string;
  age: number;
  /** A guardian's name and relation, for the `guardian` variant; null for an adult. */
  guardian: null;
  agreedAt: number;
  /** The account's own username, which the rules hold to its sign-in; absent where it was not given. */
  username?: string;
}

export interface ConsentMarker {
  schemaVersion: 1;
  consentVersion: string;
  consentLanguage: Language;
  variant: ConsentVariant;
  /** The band of the age given at consent: what the study's data carries of it. */
  ageBand: AgeBand;
  agreedAt: number;
}

export interface BackgroundDoc {
  schemaVersion: 1;
  gaming: GamingFrequency;
  device: DeviceType;
  answeredAt: number;
}

export interface DeviceCheckDoc {
  schemaVersion: 1;
  /** Driven by touch, as the drive will see it. */
  touch: boolean;
  /** Held landscape when the check passed; always true on a device without touch. */
  landscape: boolean;
  viewport: { width: number; height: number };
  /** The median frame rate over the measurement. */
  medianFps: number;
  /** Below the rate at which the drive keeps real time: warned, never excluded. */
  slow: boolean;
  /** Each control pressed at least once. */
  controls: { accelerate: boolean; brake: boolean; left: boolean; right: boolean };
  checkedAt: number;
}

export interface SurveyDoc {
  schemaVersion: 1;
  openedAt: number;
  /** The participant said they submitted the form; null until then. */
  confirmedAt: number | null;
}

/**
 * A withdrawal: the app records nothing more. What was already given is kept,
 * under the code, as the consent page says before anyone agrees: the study
 * cannot lose a participant's data after the fact.
 */
export interface Withdrawal {
  at: number;
}

const tidy = (typed: string) => typed.replace(/\s+/g, ' ').trim();

export type ConsentCheck =
  | { kind: 'ok'; fullName: string; typedSignature: string; age: number }
  | { kind: 'minor' }
  | { kind: 'problem'; message: Localized };

/**
 * What the consent form's answers come to: a record to save, a minor whom
 * the page must stop for, or what to fix. The signature is the name typed
 * again, matched without regard to case or spacing.
 */
export const checkConsent = (input: { fullName: string; typedSignature: string; age: string; agreed: boolean }): ConsentCheck => {
  const fullName = tidy(input.fullName);
  const typedSignature = tidy(input.typedSignature);
  if (fullName.length < 2 || fullName.length > NAME_MAX) {
    return { kind: 'problem', message: { en: 'Type your full name.', fil: 'I-type ang iyong buong pangalan.' } };
  }
  if (!/^\d{1,3}$/.test(input.age.trim())) {
    return { kind: 'problem', message: { en: 'Type your age in years.', fil: 'I-type ang iyong edad.' } };
  }
  const age = Number(input.age.trim());
  if (age < CONSENT_MIN_AGE) return { kind: 'minor' };
  if (age > CONSENT_MAX_AGE) return { kind: 'problem', message: { en: 'Check your age.', fil: 'Tingnan ulit ang iyong edad.' } };
  if (typedSignature.toLowerCase() !== fullName.toLowerCase()) {
    return {
      kind: 'problem',
      message: { en: 'Sign by typing your full name again, as above.', fil: 'Pumirma sa pag-type ulit ng iyong buong pangalan.' },
    };
  }
  if (!input.agreed) {
    return { kind: 'problem', message: { en: 'Tick the box to agree, or leave the study.', fil: 'Lagyan ng tsek ang kahon para pumayag.' } };
  }
  return { kind: 'ok', fullName, typedSignature, age };
};

export const consentRecords = (input: {
  participantCode: string;
  fullName: string;
  typedSignature: string;
  age: number;
  username?: string | null;
  /** The language the participant read the consent text in. */
  language: Language;
  at: number;
}): { consent: ConsentDoc; marker: ConsentMarker } => ({
  consent: {
    schemaVersion: 1,
    consentVersion: CONSENT_VERSION,
    consentLanguage: input.language,
    variant: 'adult',
    participantCode: input.participantCode,
    fullName: input.fullName,
    typedSignature: input.typedSignature,
    age: input.age,
    guardian: null,
    agreedAt: input.at,
    ...(input.username ? { username: input.username } : {}),
  },
  marker: { schemaVersion: 1, consentVersion: CONSENT_VERSION, consentLanguage: input.language, variant: 'adult', ageBand: ageBandOf(input.age), agreedAt: input.at },
});
