/**
 * The participant's own steps, over the bound records
 * repository. Each is a write the rules hold to its order: consent first,
 * the background form, the device check, the survey at the end, a
 * withdrawal once.
 */
import {
  consentRecords,
  type DeviceCheckDoc,
  type DeviceType,
  type GamingFrequency,
  type Withdrawal,
} from '@/domain/study/consentRecords';
import type { Language } from '@/shared/lib/localized';
import { studyDeps } from './dependencies';

export const giveConsent = (
  uid: string,
  input: { participantCode: string; fullName: string; typedSignature: string; age: number; username?: string | null; language: Language },
  now: () => number = Date.now
) => studyDeps().records.saveConsent(uid, consentRecords({ ...input, at: now() }));

export const saveBackground = (uid: string, answers: { gaming: GamingFrequency; device: DeviceType }, now: () => number = Date.now) =>
  studyDeps().records.saveBackground(uid, { schemaVersion: 1, ...answers, answeredAt: now() });

export const saveDeviceCheck = (uid: string, check: DeviceCheckDoc) => studyDeps().records.saveDevice(uid, check);

export const openSurvey = (uid: string, now: () => number = Date.now) => studyDeps().records.openSurvey(uid, now());

export const confirmSurvey = (uid: string, now: () => number = Date.now) => studyDeps().records.confirmSurvey(uid, now());

/** Withdraws: nothing more is recorded, and what was given is kept, as the consent page says. */
export const withdrawFromStudy = (code: string, now: () => number = Date.now) => {
  const withdrawal: Withdrawal = { at: now() };
  return studyDeps().records.withdraw(code, withdrawal);
};
