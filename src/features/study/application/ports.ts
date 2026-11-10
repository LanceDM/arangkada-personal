/**
 * What the study needs from the outside world. Bound in
 * `app/dependencies`: the registry by this feature's own Firebase adapter,
 * the accounts by Auth's public actions.
 */
import type { StudyCohort } from '@/domain/study/participantCode';
import type { EnrolmentDoc, StudyInviteDoc } from '@/domain/study/studyRecords';
import type { BackgroundDoc, ConsentDoc, ConsentMarker, DeviceCheckDoc, Withdrawal } from '@/domain/study/consentRecords';
import type { CourseProgress, TestProgress } from '@/domain/study/studyStage';

/** The study's registry: invites, the counters, the participants. */
export interface StudyRegistryRepository {
  /** The invite with this code, or null where there is none. */
  invite(code: string): Promise<StudyInviteDoc | null>;
  /** The account's enrolment, or null where it has not enrolled. */
  enrolmentOf(uid: string): Promise<EnrolmentDoc | null>;
  /**
   * Takes the cohort's next code for the account, in one transaction with
   * its records and the counter; the enrolment it already has, if any.
   */
  enrol(input: { uid: string; invite: string; cohort: StudyCohort; at: number }): Promise<EnrolmentDoc>;
}

/**
 * Auth's study accounts. Every rejection carries a message the screen shows
 * as it is: Auth never passes Firebase's own text, which names the identity.
 */
export interface StudyAccountsGateway {
  create(username: string, password: string): Promise<{ uid: string }>;
  signIn(username: string, password: string): Promise<{ uid: string }>;
}

/** What the study has recorded of a participant's own steps. */
export interface StudyRecordsState {
  consented: boolean;
  background: boolean;
  deviceChecked: boolean;
  survey: { openedAt: number | null; confirmedAt: number | null };
  withdrawn: boolean;
}

/** The participant's own study records. The consent record is written here and never read back. */
export interface StudyRecordsRepository {
  load(uid: string, code: string): Promise<StudyRecordsState>;
  /** The consent record and its marker, in one write. */
  saveConsent(uid: string, records: { consent: ConsentDoc; marker: ConsentMarker }): Promise<void>;
  saveBackground(uid: string, background: BackgroundDoc): Promise<void>;
  saveDevice(uid: string, check: DeviceCheckDoc): Promise<void>;
  openSurvey(uid: string, at: number): Promise<void>;
  confirmSurvey(uid: string, at: number): Promise<void>;
  withdraw(code: string, withdrawal: Withdrawal): Promise<void>;
}

/**
 * The two other features the study's order reads, bound in `app/dependencies`:
 * the course only as `CourseProgress` (the narrow seam: started, the level
 * Continue enters, and why it ended) and the tests only as their progress.
 * No BKT, Q-table or policy crosses it.
 */
export interface StudySources {
  course(uid: string): Promise<CourseProgress>;
  tests(uid: string): Promise<{ pre: TestProgress; post: TestProgress }>;
}
