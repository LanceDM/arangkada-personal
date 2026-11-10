/**
 * Joining the study and signing back in.
 *
 * The order is load-bearing: the invite is read **before** the account is
 * created, so a mistyped or closed invite leaves no account behind. An
 * account created and then not enrolled (the invite closed in between, the
 * connection dropped) is not lost: signed in, it is asked for the invite
 * again (`enrolWithInvite`).
 */
import { normalizeInviteCode } from '@/domain/study/participantCode';
import type { EnrolmentDoc, StudyInviteDoc } from '@/domain/study/studyRecords';
import type { Localized } from '@/shared/lib/localized';
import { studyDeps } from './dependencies';

/** A refused join, whose text the screen shows in the chosen language. */
export class StudyJoinError extends Error {
  readonly text: Localized;
  constructor(text: Localized) {
    super(text.en);
    this.text = text;
  }
}

export const INVITE_MESSAGES = {
  malformed: { en: 'An invite code is 10 letters and digits, like 7K3Q9-X2MT4.', fil: 'Ang invite code ay 10 titik at numero, gaya ng 7K3Q9-X2MT4.' },
  unknown: { en: 'That invite code is not recognised. Check it with the team.', fil: 'Hindi kilala ang invite code na iyan. Tingnan ulit kasama ang team.' },
  closed: { en: 'That invite is closed. Ask the team for help.', fil: 'Sarado na ang invite na iyan. Humingi ng tulong sa team.' },
  unread: { en: 'The invite could not be checked. Check your connection and try again.', fil: 'Hindi masuri ang invite. Tingnan ang koneksyon at subukan ulit.' },
  enrolFailed: { en: 'Your account is made, but joining the study did not finish. Try again.', fil: 'Nagawa na ang iyong account, pero hindi natapos ang pagsali. Subukan ulit.' },
} satisfies Record<string, Localized>;

/** A refusal's own text where it carries one (auth's are in both languages), else the fallback. */
const textOf = (error: unknown, fallback: Localized): Localized => {
  const text = typeof error === 'object' && error !== null ? (error as { text?: unknown }).text : undefined;
  return typeof text === 'object' && text !== null && typeof (text as Localized).en === 'string' ? (text as Localized) : fallback;
};

/** The open invite a typed code names, or a refusal saying why there is none. */
const openInvite = async (typed: string): Promise<{ code: string; invite: StudyInviteDoc }> => {
  const code = normalizeInviteCode(typed);
  if (!code) throw new StudyJoinError(INVITE_MESSAGES.malformed);
  let invite: StudyInviteDoc | null;
  try {
    invite = await studyDeps().registry.invite(code);
  } catch {
    throw new StudyJoinError(INVITE_MESSAGES.unread);
  }
  if (!invite) throw new StudyJoinError(INVITE_MESSAGES.unknown);
  if (!invite.open) throw new StudyJoinError(INVITE_MESSAGES.closed);
  return { code, invite };
};

const enrol = async (uid: string, code: string, invite: StudyInviteDoc, now: () => number): Promise<EnrolmentDoc> => {
  try {
    return await studyDeps().registry.enrol({ uid, invite: code, cohort: invite.cohort, at: now() });
  } catch {
    throw new StudyJoinError(INVITE_MESSAGES.enrolFailed);
  }
};

/** Checks the invite, creates the account, and enrols it. */
export const joinStudy = async (
  input: { invite: string; username: string; password: string },
  now: () => number = Date.now
): Promise<EnrolmentDoc> => {
  const { code, invite } = await openInvite(input.invite);
  let uid: string;
  try {
    ({ uid } = await studyDeps().accounts.create(input.username, input.password));
  } catch (error) {
    throw new StudyJoinError(textOf(error, INVITE_MESSAGES.enrolFailed));
  }
  return enrol(uid, code, invite, now);
};

/** Enrols an account that is signed in but has no code yet. */
export const enrolWithInvite = async (uid: string, typedInvite: string, now: () => number = Date.now): Promise<EnrolmentDoc> => {
  const { code, invite } = await openInvite(typedInvite);
  return enrol(uid, code, invite, now);
};

export const signInToStudy = async (username: string, password: string): Promise<void> => {
  try {
    await studyDeps().accounts.signIn(username, password);
  } catch (error) {
    throw new StudyJoinError(textOf(error, { en: 'Could not sign in. Try again.', fil: 'Hindi makapasok. Subukan ulit.' }));
  }
};
