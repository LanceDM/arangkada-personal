/**
 * The participant's own study records, written as the
 * rules expect them. Given their database, so the rules' tests run the app's
 * own writes without the app's Firebase client.
 *
 * The consent record (`consents/{uid}`: name, typed signature, age) goes in
 * the same write as its marker (`users/{uid}/study/consent`), and is never
 * read back by the participant: only an admin reads it.
 */
import { doc, getDoc, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { BackgroundDoc, ConsentDoc, ConsentMarker, DeviceCheckDoc, SurveyDoc, Withdrawal } from '@/domain/study/consentRecords';

const studyDoc = (db: Firestore, uid: string, id: 'consent' | 'background' | 'device' | 'survey') =>
  doc(db, 'users', uid, 'study', id);

export const saveConsentRecords = (db: Firestore, uid: string, { consent, marker }: { consent: ConsentDoc; marker: ConsentMarker }) => {
  const batch = writeBatch(db);
  batch.set(doc(db, 'consents', uid), consent);
  batch.set(studyDoc(db, uid, 'consent'), marker);
  return batch.commit();
};

export const saveBackground = (db: Firestore, uid: string, background: BackgroundDoc) => setDoc(studyDoc(db, uid, 'background'), background);

export const saveDeviceCheck = (db: Firestore, uid: string, check: DeviceCheckDoc) => setDoc(studyDoc(db, uid, 'device'), check);

export const openSurveyRecord = (db: Firestore, uid: string, at: number) =>
  setDoc(studyDoc(db, uid, 'survey'), { schemaVersion: 1, openedAt: at, confirmedAt: null } satisfies SurveyDoc);

export const confirmSurveyRecord = (db: Firestore, uid: string, at: number) =>
  updateDoc(studyDoc(db, uid, 'survey'), { confirmedAt: at });

export const recordWithdrawal = (db: Firestore, code: string, withdrawal: Withdrawal) =>
  updateDoc(doc(db, 'participants', code), { withdrawal });

/** Which of the participant's own steps are recorded. Reads no consent record. */
export const loadStudyRecords = async (db: Firestore, uid: string, code: string) => {
  const [consent, background, device, survey, participant] = await Promise.all([
    getDoc(studyDoc(db, uid, 'consent')),
    getDoc(studyDoc(db, uid, 'background')),
    getDoc(studyDoc(db, uid, 'device')),
    getDoc(studyDoc(db, uid, 'survey')),
    getDoc(doc(db, 'participants', code)),
  ]);
  const surveyData = survey.exists() ? (survey.data() as Partial<SurveyDoc>) : null;
  return {
    consented: consent.exists(),
    background: background.exists(),
    deviceChecked: device.exists(),
    survey: {
      openedAt: typeof surveyData?.openedAt === 'number' ? surveyData.openedAt : null,
      confirmedAt: typeof surveyData?.confirmedAt === 'number' ? surveyData.confirmedAt : null,
    },
    withdrawn: participant.exists() && (participant.data() as { withdrawal?: unknown }).withdrawal != null,
  };
};
