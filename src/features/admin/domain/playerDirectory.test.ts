import { describe, expect, it } from 'vitest';
import type { UserRow } from './adminReport';
import { accountActivity, directoryPlayers, historyRow, playerHistory, searchPlayers } from './playerDirectory';

const user = (id: string, over: Partial<UserRow> = {}): UserRow => ({ id, email: `${id}@example.com`, username: id.toUpperCase(), createdAt: 1, totalScore: 0, longestStreak: 0, bestExamScore: 0, ...over });

describe('the player directory', () => {
  const players = directoryPlayers([user('ana', { createdAt: 2 }), user('ben', { username: 'Ben Cruz', createdAt: 3 })], new Map([['ana', 'P-0001']]), ['ghost'], uid => uid);

  it('lists every account, newest first, and accounts with records but no user document', () => {
    expect(players.map(p => p.uid)).toEqual(['ben', 'ana', 'ghost']);
    expect(players[2]).toMatchObject({ email: null, code: null, user: null });
  });

  it('finds an account by any word of its name, email, code or id', () => {
    expect(searchPlayers(players, 'p-0001').map(p => p.uid)).toEqual(['ana']);
    expect(searchPlayers(players, 'ben cruz').map(p => p.uid)).toEqual(['ben']);
    expect(searchPlayers(players, 'example.com').map(p => p.uid)).toEqual(['ben', 'ana']);
    expect(searchPlayers(players, '  ')).toHaveLength(3);
    expect(searchPlayers(players, 'nobody')).toEqual([]);
  });
});

describe('a player\'s history', () => {
  const events: Record<string, unknown>[] = [
    { seq: 1, at: 10, type: 'session_started', payload: { restored: false, language: 'en' } },
    { seq: 2, at: 11, type: 'ui_action', payload: { action: 'signed_in' } },
    { seq: 3, at: 12, type: 'page_viewed', payload: { path: '/play' } },
    { seq: 4, at: 13, type: 'drive_ended', phase: 'DRIVE(1)', levelId: 1, payload: {} },
    { seq: 5, at: 14, type: 'ui_action', payload: { action: 'signed_out', from: 'header' } },
    { seq: 6, at: 15, type: 'app_error', payload: { message: 'boom' } },
  ];

  it('reads sign-ins and sign-outs as account events', () => {
    expect(historyRow(events[1])).toMatchObject({ kind: 'account', title: 'Signed in' });
    expect(historyRow(events[4])).toMatchObject({ kind: 'account', title: 'Signed out', detail: 'from header' });
    expect(accountActivity(events).map(r => r.title)).toEqual(['Signed out', 'Signed in', 'Session started']);
  });

  it('lists newest first, hides page views unless asked, and names course steps and errors', () => {
    const rows = playerHistory(events, false);
    expect(rows.map(r => r.seq)).toEqual([6, 5, 4, 2, 1]);
    expect(rows.find(r => r.seq === 4)).toMatchObject({ kind: 'course', title: 'Drive ended', detail: 'DRIVE(1) · Level 1' });
    expect(rows[0]).toMatchObject({ kind: 'error', detail: 'boom' });
    expect(playerHistory(events, true)).toHaveLength(6);
  });
});
