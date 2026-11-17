/**
 * Enrolment in the study's registry, as one transaction: the
 * counter is read, the cohort's next code is taken with both records, the
 * counter moves on by one, and the profile's username becomes the code.
 * `firestore.rules` checks every part against the others, so a write that
 * skips a code or takes one twice is refused.
 *
 * Two joining at once read the same counter. The one that commits second is
 * refused by the rules, its code being taken, before Firestore's own
 * contention retry can run, so a refusal is tried again, reading the counter
 * afresh, a few times. A refusal that stands (a closed invite) is refused
 * each time and then reported.
 *
 * Kept apart from the repository, and given its database, so the rules'
 * tests run the app's own transaction without the app's Firebase client.
 */
import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import { isStudyCohort, participantCode, type StudyCohort } from '@/domain/study/participantCode';
import { enrolmentRecords, type EnrolmentDoc, type StudyCounterDoc } from '@/domain/study/studyRecords';

export const readEnrolment = (data: unknown): EnrolmentDoc | null => {
  const value = data as Partial<EnrolmentDoc> | undefined;
  return value && typeof value.code === 'string' && isStudyCohort(value.cohort) ? (value as EnrolmentDoc) : null;
};

/** Times a refused enrolment is tried again on a fresh read of the counter. */
export const ENROL_ATTEMPTS = 12;

/** How refused enrolments are retried: attempts, and the cap on each wait. */
export interface EnrolRetry {
  attempts: number;
  capMs: number;
}

/** About 5 s in all at worst for a refusal that stands, as a closed invite's does. */
export const ENROL_RETRY: EnrolRetry = { attempts: ENROL_ATTEMPTS, capMs: 1000 };

const refused = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'permission-denied';

/** Enrols the account, or returns the enrolment it already has. */
export const enrolInRegistry = async (
  firestore: Firestore,
  input: { uid: string; invite: string; cohort: StudyCohort; at: number },
  retry: EnrolRetry = ENROL_RETRY
): Promise<EnrolmentDoc> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await enrolOnce(firestore, input);
    } catch (error) {
      if (!refused(error) || attempt >= retry.attempts) throw error;
      // Spread the retries, so accounts that collided do not collide again:
      // exponential with full jitter, capped. Twenty joining in the same
      // second lost all of five linear retries in the scripted check (run 6).
      await new Promise(resolve => setTimeout(resolve, Math.random() * Math.min(retry.capMs, 100 * 2 ** attempt)));
    }
  }
};

const enrolOnce = (
  firestore: Firestore,
  { uid, invite, cohort, at }: { uid: string; invite: string; cohort: StudyCohort; at: number }
): Promise<EnrolmentDoc> =>
  runTransaction(firestore, async transaction => {
    const enrolmentRef = doc(firestore, 'users', uid, 'study', 'enrolment');
    const counterRef = doc(firestore, 'study_counters', cohort);
    const existing = await transaction.get(enrolmentRef);
    const counter = await transaction.get(counterRef);
    const already = existing.exists() ? readEnrolment(existing.data()) : null;
    if (already) return already;

    const n = counter.exists() ? (counter.data() as StudyCounterDoc).next : 1;
    const code = participantCode(cohort, n);
    const { participant, enrolment } = enrolmentRecords({ code, uid, cohort, invite, at });
    transaction.set(doc(firestore, 'participants', code), participant);
    transaction.set(enrolmentRef, enrolment);
    transaction.set(counterRef, { next: n + 1 } satisfies StudyCounterDoc);
    // A participant's profile carries their code as its username, as a pool
    // account's did: the admin report lists accounts by it.
    transaction.set(doc(firestore, 'users', uid), { username: code }, { merge: true });
    return enrolment;
  });
