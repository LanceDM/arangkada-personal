import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { LEVELS } from '@/features/driving-sim';
import type { AdminData, AttemptRow, UserRow } from './adminReport';
import {
  filterAttempts,
  levelName,
  matchesPlayer,
  playerLevels,
  recentDecisions,
  reportPlayers,
  reportTotals,
} from './playerReport';

const DAY = 24 * 60 * 60_000;
const T0 = Date.UTC(2026, 9, 20, 2, 0, 0);

const user = (id: string, over: Partial<UserRow> = {}): UserRow => ({
  id, email: `${id}@example.test`, username: id.toUpperCase(), createdAt: T0 - 10 * DAY, totalScore: 0, longestStreak: 0, bestExamScore: 0, ...over,
});

const log = (timestamp: number, result: ActionLog['result'], over: Partial<ActionLog> = {}): ActionLog => ({
  timestamp, action: 'brake', result, points: result === 'correct' ? 10 : result === 'violation' ? -10 : 0, ...over,
});

const attempt = (userId: string, levelId: number, timestamp: number, finalScore: number, logs: ActionLog[] = []): AttemptRow => ({
  userId, levelId, timestamp, finalScore,
  correctDecisions: logs.filter(entry => entry.result === 'correct').length,
  violations: logs.filter(entry => entry.result === 'violation').length,
  logs,
});

const data = (): AdminData => ({
  users: [
    user('a'),
    user('b', { email: '', username: 'P01', createdAt: T0 - DAY }),
    user('c', { createdAt: T0 - 2 * DAY }),
  ],
  attempts: [
    attempt('a', 0, T0, 80, [log(T0 - 5, 'correct'), log(T0 - 4, 'violation')]),
    attempt('a', 1, T0 + DAY, 40),
    attempt('a', 1, T0 + 2 * DAY, 90),
    attempt('b', 0, T0 + 3 * DAY, 70),
  ],
  examResults: [
    { id: 'e1', userId: 'a', score: 30, passed: true, wrongIds: [], timestamp: T0 + 5 * DAY },
    { id: 'e2', userId: 'a', score: 24, passed: false, wrongIds: [], timestamp: T0 + 4 * DAY },
  ],
  dailyResults: [
    { id: 'd1', userId: 'c', scenarioId: 's', correct: true, date: '2026-10-27' },
    { id: 'd2', userId: 'c', scenarioId: 's', correct: false, date: '2026-10-28' },
  ],
});

describe('the player report', () => {
  it("summarises each player's activity from the records each mode saves", () => {
    const players = reportPlayers(data());
    const a = players.find(player => player.id === 'a')!;
    expect(a).toMatchObject({
      name: 'A', detail: 'a@example.test', storyAttempts: 3, levelsPlayed: 2, highestLevel: 1, averageScore: 70,
      correct: 1, mistakes: 1, examSittings: 2, examBest: 30, dailyAnswers: 0, dailyCorrect: 0, lastActiveAt: T0 + 5 * DAY,
    });
    expect(players.find(player => player.id === 'b')).toMatchObject({ name: 'P01', detail: 'Pilot pool account', storyAttempts: 1 });
    expect(players.find(player => player.id === 'c')).toMatchObject({
      storyAttempts: 0, levelsPlayed: 0, highestLevel: null, averageScore: null, examBest: null, dailyAnswers: 2, dailyCorrect: 1,
    });
  });

  it('lists the most recently active first, then the newest', () => {
    const players = reportPlayers({ ...data(), users: [...data().users, user('d', { createdAt: T0 }), user('e', { createdAt: T0 - 50 * DAY })] });
    expect(players.map(player => player.id)).toEqual(['c', 'a', 'b', 'd', 'e']);
  });

  it('totals every mode', () => {
    expect(reportTotals(data())).toEqual({
      players: 3, playersInStory: 2, storyAttempts: 4, averageScore: 70, correct: 1, mistakes: 1,
      examSittings: 2, examPassed: 1, dailyAnswers: 2, dailyCorrect: 1,
    });
    expect(reportTotals({ users: [], attempts: [], examResults: [], dailyResults: [] }).averageScore).toBeNull();
  });

  it("gives a player's best score per level beside its pass mark", () => {
    const levels = playerLevels(data().attempts.filter(row => row.userId === 'a'));
    expect(levels.map(({ levelId, attempts, bestScore, lastAt }) => ({ levelId, attempts, bestScore, lastAt }))).toEqual([
      { levelId: 0, attempts: 1, bestScore: 80, lastAt: T0 },
      { levelId: 1, attempts: 2, bestScore: 90, lastAt: T0 + 2 * DAY },
    ]);
    expect(levels[1].passMark).toBe(LEVELS.find(level => level.id === 1)!.requiredScore);
    expect(levels[1].name).toBe(levelName(1));
  });

  it("lists a player's graded decisions newest first, leaving out what was not graded", () => {
    const decisions = recentDecisions([
      attempt('a', 2, T0, 0, [log(T0 + 1, 'correct', { competency: 'pedestrians', ruleId: 'R-1' }), log(T0 + 2, 'neutral'), log(T0 + 3, 'violation')]),
    ]);
    expect(decisions.map(decision => [decision.timestamp, decision.result])).toEqual([
      [T0 + 3, 'violation'],
      [T0 + 1, 'correct'],
    ]);
    expect(decisions[1]).toMatchObject({ levelId: 2, competency: 'pedestrians', ruleId: 'R-1', expectedAction: null });
    expect(recentDecisions([attempt('a', 2, T0, 0, Array.from({ length: 20 }, (_, i) => log(T0 + i, 'correct')))], 5)).toHaveLength(5);
  });

  it('finds a player by name, email or id, and narrows attempts by level and player', () => {
    expect(matchesPlayer({ id: 'u1', name: 'P01', detail: 'Pilot pool account' }, ' p01 ')).toBe(true);
    expect(matchesPlayer({ id: 'u1', name: 'Joy', detail: 'joy@example.test' }, 'EXAMPLE')).toBe(true);
    expect(matchesPlayer({ id: 'u1', name: 'Joy', detail: 'joy@example.test' }, 'p02')).toBe(false);

    const players = new Map(reportPlayers(data()).map(player => [player.id, player]));
    const all = filterAttempts(data().attempts, players, { levelId: null, query: '' });
    expect(all.map(row => row.timestamp)).toEqual([T0 + 3 * DAY, T0 + 2 * DAY, T0 + DAY, T0]);
    expect(filterAttempts(data().attempts, players, { levelId: 1, query: '' })).toHaveLength(2);
    expect(filterAttempts(data().attempts, players, { levelId: null, query: 'p01' }).map(row => row.userId)).toEqual(['b']);
  });
});
