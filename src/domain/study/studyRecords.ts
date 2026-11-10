/**
 * The study's registry, as stored. `firestore.rules` holds each
 * shape; these types are the authoritative ones.
 *
 *   study_invites/{invite}         StudyInviteDoc, written by an admin
 *   study_counters/{cohort}        StudyCounterDoc, the next enrolment's number
 *   participants/{code}            ParticipantDoc, one per enrolment, admin-listed
 *   users/{uid}/study/enrolment    EnrolmentDoc, the account's own pointer to its code
 *
 * None of them holds a name, an age, a username or an email.
 */
import type { Withdrawal } from './consentRecords';
import type { StudyCohort } from './participantCode';

export const STUDY_SCHEMA_VERSION = 1;

export interface StudyInviteDoc {
  schemaVersion: typeof STUDY_SCHEMA_VERSION;
  cohort: StudyCohort;
  /** False once an admin has closed it; nobody can join with it then. */
  open: boolean;
  createdAt: number;
  closedAt: number | null;
}

export interface StudyCounterDoc {
  /** The number the next enrolment in the cohort takes. */
  next: number;
}

export interface ParticipantDoc {
  schemaVersion: typeof STUDY_SCHEMA_VERSION;
  code: string;
  uid: string;
  cohort: StudyCohort;
  /** The invite it joined with. */
  invite: string;
  enrolledAt: number;
  /** Set once if the participant withdraws (amendment 1); null until then. */
  withdrawal: Withdrawal | null;
}

export interface EnrolmentDoc {
  schemaVersion: typeof STUDY_SCHEMA_VERSION;
  code: string;
  cohort: StudyCohort;
  enrolledAt: number;
}

export const newInvite = (cohort: StudyCohort, at: number): StudyInviteDoc => ({
  schemaVersion: STUDY_SCHEMA_VERSION,
  cohort,
  open: true,
  createdAt: at,
  closedAt: null,
});

/** The two records one enrolment writes, which name each other. */
export const enrolmentRecords = (input: {
  code: string;
  uid: string;
  cohort: StudyCohort;
  invite: string;
  at: number;
}): { participant: ParticipantDoc; enrolment: EnrolmentDoc } => ({
  participant: {
    schemaVersion: STUDY_SCHEMA_VERSION,
    code: input.code,
    uid: input.uid,
    cohort: input.cohort,
    invite: input.invite,
    enrolledAt: input.at,
    withdrawal: null,
  },
  enrolment: {
    schemaVersion: STUDY_SCHEMA_VERSION,
    code: input.code,
    cohort: input.cohort,
    enrolledAt: input.at,
  },
});
