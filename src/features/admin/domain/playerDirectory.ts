/**
 * Admin > Players: find any account by name, email, study code or id, and
 * read it in one place. Ported from the groupmate's repository
 * (arangkada-personal, playerDirectory) and adapted to the records this
 * repository keeps: his history is an event stream of sign-ins, sign-outs and
 * page views (`users/{uid}/events`) that nothing here writes, so the history
 * below is built from the saved attempts and the course log instead.
 */
import type { CourseLogRow } from './courseAdmin';

/** A profile as the directory reads it: `users/{uid}`. */
export interface DirectoryUser {
  id: string;
  username?: string;
  email?: string;
  createdAt?: number;
  language?: string;
}

/** A study registry entry: `participants/{code}`. */
export interface DirectoryEnrolment {
  uid: string;
  code: string;
  cohort: string;
}

export interface DirectoryPlayer {
  uid: string;
  /** The study code for an enrolled account, else the username, else the id's start. */
  label: string;
  username: string | null;
  email: string | null;
  code: string | null;
  cohort: string | null;
  createdAt: number | null;
  language: string | null;
}

/** Every account the admin can see: each profile, and any enrolment without one. Newest first. */
export const directoryPlayers = (users: readonly DirectoryUser[], enrolments: readonly DirectoryEnrolment[]): DirectoryPlayer[] => {
  const byUid = new Map(users.map(user => [user.id, user]));
  const enrolled = new Map(enrolments.map(entry => [entry.uid, entry]));
  const ids = [...new Set([...users.map(user => user.id), ...enrolments.map(entry => entry.uid)])];
  return ids
    .map((uid): DirectoryPlayer => {
      const user = byUid.get(uid);
      const entry = enrolled.get(uid);
      const username = user?.username || null;
      return {
        uid,
        label: entry?.code ?? username ?? `${uid.slice(0, 6)}…`,
        username,
        email: user?.email || null,
        code: entry?.code ?? null,
        cohort: entry?.cohort ?? null,
        createdAt: typeof user?.createdAt === 'number' ? user.createdAt : null,
        language: user?.language ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.label.localeCompare(b.label));
};

/** Accounts whose name, email, study code or id contains every word typed (any case). */
export const searchPlayers = (players: readonly DirectoryPlayer[], query: string): DirectoryPlayer[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...players];
  return players.filter(player => {
    const haystack = [player.uid, player.label, player.username, player.email, player.code].filter(Boolean).join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
};

/** A saved attempt, cut to where and when: the history names no score. */
export interface DirectoryAttempt {
  id: string;
  savedAt: number;
  levelId: number | null;
}

export const directoryAttemptOf = (id: string, savedAt: number, data: unknown): DirectoryAttempt => {
  const row = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { id, savedAt, levelId: typeof row.levelId === 'number' ? row.levelId : null };
};

export interface HistoryRow {
  at: number;
  kind: 'drive' | 'course';
  title: string;
  detail: string;
}

/**
 * One account's history, newest first: each saved drive (its level and when),
 * and each course step (a quiz, a drive or the final, with the decisions it
 * took). No score is shown.
 */
export const playerHistory = (attempts: readonly DirectoryAttempt[], courseLogs: readonly CourseLogRow[]): HistoryRow[] =>
  [
    ...attempts.map(
      (attempt): HistoryRow => ({
        at: attempt.savedAt,
        kind: 'drive',
        title: attempt.levelId === null ? 'Drive saved' : `Drive saved: Level ${attempt.levelId}`,
        detail: attempt.id,
      })
    ),
    ...courseLogs.map(
      (row): HistoryRow => ({
        at: row.timestamp,
        kind: 'course',
        title: `Course: ${row.kind} · ${row.phase || `Level ${row.levelId}`}`,
        detail:
          [
            row.decisions.map(d => `${d.competency} → ${d.action}`).join(', '),
            row.endReason ? `ended: ${row.endReason}` : '',
          ]
            .filter(Boolean)
            .join(' · ') || '–',
      })
    ),
  ].sort((a, b) => b.at - a.at);
