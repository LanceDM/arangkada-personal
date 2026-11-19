import { describe, expect, it } from 'vitest';
import { courseProgressOfCursor, formatAgo, NO_PROFILE, NO_STEPS, pilotRow, pilotRows, type PilotAccountProgress } from './pilotProgress';

const MIN = 60_000;
const T0 = 1_760_000_000_000;

const account = (over: Partial<PilotAccountProgress> = {}): PilotAccountProgress => ({
  code: 'P-0001',
  name: null,
  profile: NO_PROFILE,
  cohort: 'study',
  uid: 'u1',
  enrolledAt: T0,
  withdrawnAt: null,
  steps: NO_STEPS,
  group: null,
  cursor: null,
  attempts: [],
  ...over,
});

describe('an enrolled participant on the Participants page', () => {
  it('has not started until it enters the course, and was last active when it enrolled', () => {
    const row = pilotRow(account());
    expect(row).toMatchObject({ stage: 'consent', place: 'Not in the course yet', storyAttempts: 0, lastActivityAt: T0, cohort: 'study' });
  });

  it('is at the stage of the study its recorded steps give, as its own home says', () => {
    const steps = { ...NO_STEPS, consentedAt: T0 + MIN, backgroundAt: T0 + 2 * MIN, deviceCheckedAt: T0 + 3 * MIN };
    expect(pilotRow(account({ steps: { ...steps, deviceCheckedAt: null } })).stage).toBe('device');
    expect(pilotRow(account({ steps })).stage).toBe('pre-test');
    expect(pilotRow(account({ steps: { ...steps, preTest: 'finished' } }))).toMatchObject({ stage: 'tutorial', lastActivityAt: T0 + 3 * MIN });
    expect(pilotRow(account({ steps: { ...steps, preTest: 'finished' }, withdrawnAt: T0 + 9 * MIN })).stage).toBe('withdrawn');
  });

  it('counts its saved drives, and is where its course cursor is', () => {
    const entered = account({ cursor: { state: { kind: 'DRIVE', level: 0 }, outcome: null, seq: 1, updatedAt: T0 + MIN } });
    expect(pilotRow(entered)).toMatchObject({ place: 'Level 0 (tutorial), drive', lastActivityAt: T0 + MIN });

    const saved = account({
      cursor: { state: { kind: 'QUIZ', level: 1 }, outcome: null, seq: 3, updatedAt: T0 + 6 * MIN },
      attempts: [{ id: 'a1', levelId: 0, savedAt: T0 + 6 * MIN }, { id: 'a2', levelId: 1, savedAt: T0 + 9 * MIN }],
    });
    expect(pilotRow(saved)).toMatchObject({ place: 'Level 1, short quiz', storyAttempts: 2, lastActivityAt: T0 + 9 * MIN });
  });

  it("reads the course from the stored cursor as Driving Sim's own seam does (loadCompetencyCourseProgress)", () => {
    const at = (kind: string, level: number | undefined, seq: number) => courseProgressOfCursor({ state: { kind, level }, outcome: null, seq, updatedAt: T0 });
    expect(at('MODULE', 0, 0)).toEqual({ started: false, frontierLevel: 0, endReason: null });
    expect(at('DRIVE', 0, 1)).toEqual({ started: true, frontierLevel: 0, endReason: null });
    expect(at('REPEAT', 5, 30)).toEqual({ started: true, frontierLevel: 5, endReason: null });
    expect(at('FINAL', undefined, 60)).toEqual({ started: true, frontierLevel: 12, endReason: null });
    expect(at('CERTIFIED', undefined, 61)).toEqual({ started: true, frontierLevel: null, endReason: 'certified' });
    expect(courseProgressOfCursor(null)).toEqual({ started: false, frontierLevel: 0, endReason: null });
  });

  it('names the phase within the level', () => {
    const at = (kind: string, level: number) => pilotRow(account({ cursor: { state: { kind, level }, outcome: null, seq: 5, updatedAt: T0 } })).place;
    expect(at('MODULE', 2)).toBe('Level 2, module');
    expect(at('REPEAT', 2)).toBe('Level 2, repeat drive');
    expect(at('QUIZ_REVIEW', 7)).toBe('Level 7, quiz review');
  });

  it('names the final exam and certification', () => {
    expect(pilotRow(account({ cursor: { state: { kind: 'FINAL' }, outcome: null, updatedAt: T0 } })).place).toBe('Final Mission');
    expect(pilotRow(account({ cursor: { state: { kind: 'CERTIFIED' }, outcome: 'passed', updatedAt: T0 } })).place).toBe('Certified');
  });

  it('carries the name given at consent, for the team, and no score, accuracy or result of any kind', () => {
    const row = pilotRow(account({ name: 'Juan dela Cruz', attempts: [{ id: 'a1', levelId: 1, savedAt: T0 }] }));
    expect(row.name).toBe('Juan dela Cruz');
    const keys = Object.keys(row).join(' ').toLowerCase();
    for (const word of ['score', 'accuracy', 'correct', 'pass', 'violation', 'result', 'mastery', 'email', 'username']) {
      expect(keys).not.toContain(word);
    }
    expect(Object.keys(row)).not.toContain('age');
  });

  it('lists participants in code order', () => {
    const rows = pilotRows([account({ code: 'P-0010' }), account({ code: 'P-0002' }), account({ code: 'D-0001', cohort: 'dryrun' })]);
    expect(rows.map(row => row.code)).toEqual(['D-0001', 'P-0002', 'P-0010']);
  });

  it('says how long ago', () => {
    expect(formatAgo(T0, T0 + 20_000)).toBe('just now');
    expect(formatAgo(T0, T0 + 4 * MIN)).toBe('4 min ago');
    expect(formatAgo(T0, T0 + 130 * MIN)).toBe('2 h ago');
    expect(formatAgo(T0, T0 + 3 * 24 * 60 * MIN)).toBe('3 d ago');
  });
});
