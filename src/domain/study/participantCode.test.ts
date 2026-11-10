import { describe, expect, it } from 'vitest';
import {
  cohortOfCode,
  compareParticipantCodes,
  formatInviteCode,
  INVITE_CODE_LENGTH,
  isParticipantCode,
  newInviteCode,
  normalizeInviteCode,
  participantCode,
} from './participantCode';

describe('participant codes', () => {
  it("are the cohort's letter and the number padded to four digits", () => {
    expect(participantCode('study', 1)).toBe('P-0001');
    expect(participantCode('dryrun', 42)).toBe('D-0042');
    expect(participantCode('test', 9999)).toBe('T-9999');
  });

  it('refuse a number four digits cannot hold, or none', () => {
    for (const n of [0, -1, 10_000, 1.5, Number.NaN]) expect(() => participantCode('study', n)).toThrow(RangeError);
  });

  it('are recognised in their one written form only', () => {
    for (const code of ['P-0001', 'D-0420', 'T-9999']) expect(isParticipantCode(code)).toBe(true);
    for (const code of ['P-0000', 'P01', 'p-0001', 'P-001', 'X-0001', 'P-00001', '', null, undefined]) {
      expect(isParticipantCode(code)).toBe(false);
    }
  });

  it('name their cohort', () => {
    expect(cohortOfCode('P-0003')).toBe('study');
    expect(cohortOfCode('D-0003')).toBe('dryrun');
    expect(cohortOfCode('T-0003')).toBe('test');
    expect(cohortOfCode('P03')).toBeNull();
  });

  it('sort in enrolment order', () => {
    expect(['P-0010', 'P-0002', 'D-0001'].sort(compareParticipantCodes)).toEqual(['D-0001', 'P-0002', 'P-0010']);
  });
});

describe('invite codes', () => {
  it('are ten Crockford characters, from the bytes given', () => {
    let byte = 0;
    const code = newInviteCode(() => byte++);
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(code).toBe('0123456789');
    expect(normalizeInviteCode(code)).toBe(code);
    expect(newInviteCode(() => 255)).toBe('ZZZZZZZZZZ');
  });

  it('read as typed: any case, spaces or dashes, and I, L, O as the digits they look like', () => {
    expect(normalizeInviteCode('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(normalizeInviteCode(' 7k3q9 x2mt4 ')).toBe('7K3Q9X2MT4');
    expect(normalizeInviteCode('O1IL0-ABCDE')).toBe('01110ABCDE');
    expect(normalizeInviteCode(formatInviteCode('7K3Q9X2MT4'))).toBe('7K3Q9X2MT4');
  });

  it('refuse anything of another length or with a letter Crockford leaves out', () => {
    for (const typed of ['', 'ABCDE', 'ABCDEFGHJKM', 'ABCDEFGHJU', 'ABCD#FGHJK']) expect(normalizeInviteCode(typed)).toBeNull();
  });

  it('are shown in two halves', () => {
    expect(formatInviteCode('7K3Q9X2MT4')).toBe('7K3Q9-X2MT4');
  });
});
