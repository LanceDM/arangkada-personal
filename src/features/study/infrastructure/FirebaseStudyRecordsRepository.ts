/** The participant's own study records in Firestore. */
import { db } from '@/shared/infrastructure/firebase/client';
import type { StudyRecordsRepository } from '@/features/study/application/ports';
import {
  confirmSurveyRecord,
  loadStudyRecords,
  openSurveyRecord,
  recordWithdrawal,
  saveBackground,
  saveConsentRecords,
  saveDeviceCheck,
} from './studyRecordsWrites';

export const firebaseStudyRecordsRepository: StudyRecordsRepository = {
  load: (uid, code) => loadStudyRecords(db, uid, code),
  saveConsent: (uid, records) => saveConsentRecords(db, uid, records),
  saveBackground: (uid, background) => saveBackground(db, uid, background),
  saveDevice: (uid, check) => saveDeviceCheck(db, uid, check),
  openSurvey: (uid, at) => openSurveyRecord(db, uid, at),
  confirmSurvey: (uid, at) => confirmSurveyRecord(db, uid, at),
  withdraw: (code, withdrawal) => recordWithdrawal(db, code, withdrawal),
};
