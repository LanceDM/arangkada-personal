/**
 * Admin > Players (2026-11-13): find any account by name, email, study code or
 * id, and read its history as the event stream logged it, sign-ins and
 * sign-outs included.
 */
import type { UserRow } from './adminReport';

export interface DirectoryPlayer {
  uid: string;
  label: string;
  username: string | null;
  email: string | null;
  code: string | null;
  createdAt: number | null;
  user: UserRow | null;
}

/** Every account the admin can see: the users, and anyone with study records but no user document. */
export const directoryPlayers = (
  users: readonly UserRow[],
  codes: ReadonlyMap<string, string>,
  otherUids: readonly string[],
  label: (uid: string) => string
): DirectoryPlayer[] => {
  const byId = new Map(users.map(user => [user.id, user]));
  const ids = [...new Set([...users.map(user => user.id), ...otherUids])];
  return ids
    .map(uid => {
      const user = byId.get(uid) ?? null;
      return {
        uid,
        label: label(uid),
        username: user?.username || null,
        email: user?.email || null,
        code: codes.get(uid) ?? null,
        createdAt: user?.createdAt ?? null,
        user,
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.label.localeCompare(b.label));
};

/** Players whose name, email, study code or id contains every word typed (any case). */
export const searchPlayers = (players: readonly DirectoryPlayer[], query: string): DirectoryPlayer[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...players];
  return players.filter(player => {
    const haystack = [player.uid, player.label, player.username, player.email, player.code].filter(Boolean).join(' ').toLowerCase();
    return words.every(word => haystack.includes(word));
  });
};

export type EventKind = 'account' | 'course' | 'navigation' | 'error' | 'other';

export interface HistoryRow {
  seq: number | null;
  at: number | null;
  type: string;
  kind: EventKind;
  /** One line a person reads. */
  title: string;
  detail: string;
}

const ACTION_TITLE: Record<string, string> = {
  signed_in: 'Signed in',
  signed_up: 'Signed up',
  signed_out: 'Signed out',
};

const COURSE_TYPES = new Set([
  'course_transition', 'sitting_submitted', 'item_answered', 'background_submitted', 'drive_planned', 'activity_opened', 'answer_given',
  'drive_started', 'drive_exited', 'decision_made', 'drive_ended', 'verdict_computed', 'policy_decision', 'reward_computed',
]);

const humanize = (value: string) => value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const str = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null);

/** One logged event as a line of history. */
export const historyRow = (event: Record<string, unknown>): HistoryRow => {
  const type = String(event.type ?? 'unknown');
  const payload = (event.payload && typeof event.payload === 'object' ? event.payload : {}) as Record<string, unknown>;
  const where = [str(event.phase), event.levelId !== null && event.levelId !== undefined ? `Level ${event.levelId}` : null].filter(Boolean).join(' · ');
  const base = { seq: typeof event.seq === 'number' ? event.seq : null, at: typeof event.at === 'number' ? event.at : null, type };
  if (type === 'ui_action') {
    const action = str(payload.action) ?? 'action';
    const account = action in ACTION_TITLE;
    return {
      ...base,
      kind: account ? 'account' : 'other',
      title: ACTION_TITLE[action] ?? humanize(action),
      detail: [str(payload.from) ? `from ${str(payload.from)}` : null, where].filter(Boolean).join(' · '),
    };
  }
  if (type === 'session_started') {
    return {
      ...base,
      kind: 'account',
      title: payload.restored ? 'Session restored (already signed in)' : 'Session started',
      detail: [str(payload.language), str(payload.userAgent)?.slice(0, 80)].filter(Boolean).join(' · '),
    };
  }
  if (type === 'page_viewed') return { ...base, kind: 'navigation', title: 'Page viewed', detail: str(payload.path) ?? '' };
  if (type === 'app_error') return { ...base, kind: 'error', title: 'App error', detail: (str(payload.message) ?? '').slice(0, 160) };
  return { ...base, kind: COURSE_TYPES.has(type) ? 'course' : 'other', title: humanize(type), detail: where };
};

/** The history, newest first, with page views left out unless asked for. */
export const playerHistory = (events: readonly Record<string, unknown>[], includePages: boolean): HistoryRow[] =>
  events
    .map(historyRow)
    .filter(row => includePages || row.kind !== 'navigation')
    .sort((a, b) => (b.seq ?? -1) - (a.seq ?? -1) || (b.at ?? 0) - (a.at ?? 0));

/** The account's sign-ins, sign-ups and sign-outs, newest first. */
export const accountActivity = (events: readonly Record<string, unknown>[]): HistoryRow[] =>
  playerHistory(events, false).filter(row => row.kind === 'account');
