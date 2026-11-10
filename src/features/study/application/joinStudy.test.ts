import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newInvite, type EnrolmentDoc, type StudyInviteDoc } from '@/domain/study/studyRecords';
import { provideStudyDependencies, type StudyDependencies } from './dependencies';
import { enrolWithInvite, INVITE_MESSAGES, joinStudy, signInToStudy } from './joinStudy';

const INVITE = '7K3Q9X2MT4';
const enrolment: EnrolmentDoc = { schemaVersion: 1, code: 'P-0001', cohort: 'study', enrolledAt: 5 };

let invites: Record<string, StudyInviteDoc>;
const create = vi.fn(async () => ({ uid: 'u1' }));
const signIn = vi.fn(async () => ({ uid: 'u1' }));
const enrol = vi.fn(async () => enrolment);

beforeEach(() => {
  invites = { [INVITE]: newInvite('study', 1), CXSED00001: { ...newInvite('study', 1), open: false, closedAt: 2 } };
  create.mockReset().mockResolvedValue({ uid: 'u1' });
  signIn.mockReset().mockResolvedValue({ uid: 'u1' });
  enrol.mockReset().mockResolvedValue(enrolment);
  provideStudyDependencies({
    registry: { invite: async code => invites[code] ?? null, enrolmentOf: async () => null, enrol },
    accounts: { create, signIn },
    records: {} as StudyDependencies['records'],
    sources: {} as StudyDependencies['sources'],
  });
});

const input = (invite: string) => ({ invite, username: 'juan_2026', password: 'tatlong maliit na baboy' });

describe('joining the study', () => {
  it('reads the invite as typed, creates the account, and enrols it in the invite’s cohort', async () => {
    expect(await joinStudy(input('7k3q9-x2mt4'), () => 99)).toBe(enrolment);
    expect(create).toHaveBeenCalledWith('juan_2026', 'tatlong maliit na baboy');
    expect(enrol).toHaveBeenCalledWith({ uid: 'u1', invite: INVITE, cohort: 'study', at: 99 });
  });

  it('creates no account for a malformed, unknown or closed invite', async () => {
    await expect(joinStudy(input('7K3Q9'))).rejects.toThrow(INVITE_MESSAGES.malformed.en);
    await expect(joinStudy(input('ABCDE12345'))).rejects.toThrow(INVITE_MESSAGES.unknown.en);
    await expect(joinStudy(input('CXSED00001'))).rejects.toThrow(INVITE_MESSAGES.closed.en);
    provideStudyDependencies({
      registry: { invite: async () => Promise.reject(new Error('offline')), enrolmentOf: async () => null, enrol },
      accounts: { create, signIn },
      records: {} as StudyDependencies['records'],
      sources: {} as StudyDependencies['sources'],
    });
    await expect(joinStudy(input(INVITE))).rejects.toThrow(INVITE_MESSAGES.unread.en);
    expect(create).not.toHaveBeenCalled();
    expect(enrol).not.toHaveBeenCalled();
  });

  it("shows Auth's refusal as it is, and enrols nothing", async () => {
    const taken = { en: 'That username is taken. Choose another.', fil: 'May gumagamit na ng username na iyan. Pumili ng iba.' };
    create.mockRejectedValue(Object.assign(new Error(taken.en), { text: taken }));
    await expect(joinStudy(input(INVITE))).rejects.toMatchObject({ text: taken });
    expect(enrol).not.toHaveBeenCalled();
  });

  it('says the account is made when only the enrolment fails, and enrols it on the invite again', async () => {
    enrol.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(joinStudy(input(INVITE))).rejects.toThrow(INVITE_MESSAGES.enrolFailed.en);
    expect(await enrolWithInvite('u1', INVITE, () => 7)).toBe(enrolment);
    expect(enrol).toHaveBeenLastCalledWith({ uid: 'u1', invite: INVITE, cohort: 'study', at: 7 });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("signs in through Auth, passing its refusal on as it is", async () => {
    await signInToStudy('juan_2026', 'x');
    expect(signIn).toHaveBeenCalledWith('juan_2026', 'x');
    const wrong = { en: 'Wrong username or password.', fil: 'Mali ang username o password.' };
    signIn.mockRejectedValue(Object.assign(new Error(wrong.en), { text: wrong }));
    await expect(signInToStudy('juan_2026', 'y')).rejects.toMatchObject({ text: wrong });
  });
});
