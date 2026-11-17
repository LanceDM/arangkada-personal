import { describe, expect, it } from 'vitest';
import type { CourseLogRow } from './courseAdmin';
import { directoryAttemptOf, directoryPlayers, playerHistory, searchPlayers } from './playerDirectory';

describe('the player directory', () => {
  const users = [
    { id: 'u1', username: 'P-0001', createdAt: 2000 },
    { id: 'u2', username: 'kyle', email: 'team@example.test', createdAt: 3000, language: 'fil' },
  ];
  const enrolments = [
    { uid: 'u1', code: 'P-0001', cohort: 'study' },
    { uid: 'u9', code: 'T-0001', cohort: 'test' },
  ];

  it('lists every profile and every enrolment without one, newest first, named by code where enrolled', () => {
    const players = directoryPlayers(users, enrolments);
    expect(players.map(p => p.uid)).toEqual(['u2', 'u1', 'u9']);
    expect(players.find(p => p.uid === 'u9')).toMatchObject({ label: 'T-0001', code: 'T-0001', cohort: 'test', username: null, createdAt: null });
    expect(players.find(p => p.uid === 'u2')).toMatchObject({ label: 'kyle', code: null, email: 'team@example.test', language: 'fil' });
  });

  it('finds an account when every word typed matches its name, email, code or id', () => {
    const players = directoryPlayers(users, enrolments);
    expect(searchPlayers(players, 'example kyle').map(p => p.uid)).toEqual(['u2']);
    expect(searchPlayers(players, 't-0001').map(p => p.uid)).toEqual(['u9']);
    expect(searchPlayers(players, '  ')).toHaveLength(3);
  });

  it('builds the history from saved drives and course steps, newest first, with no score', () => {
    const attempt = directoryAttemptOf('a1', 1000, { levelId: 3, finalScore: 180, timestamp: 1000 });
    expect(attempt).toEqual({ id: 'a1', savedAt: 1000, levelId: 3 });
    const step: CourseLogRow = {
      userId: 'u1', kind: 'drive', levelId: 3, phase: 'DRIVE(3)', verdicts: [], endReason: null, timestamp: 1500, rewards: [],
      decisions: [{ competency: 'road_signs', action: 'practice' } as CourseLogRow['decisions'][number]],
    };
    const history = playerHistory([attempt], [step]);
    expect(history.map(row => row.title)).toEqual(['Course: drive · DRIVE(3)', 'Drive saved: Level 3']);
    expect(history[0].detail).toBe('road_signs → practice');
    expect(JSON.stringify(history)).not.toContain('180');
  });
});
