/**
 * The player report: every account's activity across Story Mode, the Mock
 * Exam and the Daily Challenge, counted from the records each mode saves.
 *
 * Every number here is a count or a score as it was recorded; none is a pilot
 * outcome. The pilot's own measures are the export's definitions, which this
 * report does not repeat. A profile's embedded `progress` is a legacy shape
 * nothing has written since progress moved to its own document, so nothing
 * here counts from it; a player's detail shows it, labelled, where it exists.
 */
import { LEVELS } from '@/features/driving-sim';
import type { AdminData, AttemptRow, ExamRow, UserRow } from './adminReport';

export interface ReportPlayer {
  id: string;
  name: string;
  /** The email, or what stands for one: a pilot pool account has none. */
  detail: string;
  joinedAt: number | null;
  storyAttempts: number;
  /** Distinct levels driven at least once. */
  levelsPlayed: number;
  highestLevel: number | null;
  averageScore: number | null;
  correct: number;
  mistakes: number;
  examSittings: number;
  examBest: number | null;
  dailyAnswers: number;
  dailyCorrect: number;
  /** The latest Story attempt, exam sitting or daily answer. */
  lastActiveAt: number | null;
}

export interface ReportTotals {
  players: number;
  playersInStory: number;
  storyAttempts: number;
  averageScore: number | null;
  correct: number;
  mistakes: number;
  examSittings: number;
  examPassed: number;
  dailyAnswers: number;
  dailyCorrect: number;
}

export interface PlayerLevel {
  levelId: number;
  name: string;
  attempts: number;
  bestScore: number;
  /** The level's pass mark, for reading the best score against. */
  passMark: number | null;
  lastAt: number;
}

export interface RecentDecision {
  levelId: number;
  timestamp: number;
  action: string;
  result: 'correct' | 'violation';
  points: number;
  competency: string | null;
  ruleId: string | null;
  expectedAction: string | null;
}

const levelById = new Map(LEVELS.map(level => [level.id, level]));

export const levelName = (levelId: number): string => {
  const level = levelById.get(levelId);
  return level ? `Level ${levelId} · ${level.name}` : `Level ${levelId}`;
};

export const passMarkOf = (levelId: number): number | null => levelById.get(levelId)?.requiredScore ?? null;

const mean = (values: readonly number[]) =>
  values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/** A daily answer's day, as the moment it began. */
const dayStart = (date: string) => {
  const at = Date.parse(`${date}T00:00:00`);
  return Number.isNaN(at) ? null : at;
};

const groupBy = <T>(rows: readonly T[], key: (row: T) => string) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

const playerOf = (user: UserRow, attempts: readonly AttemptRow[], exams: readonly ExamRow[], daily: AdminData['dailyResults']): ReportPlayer => {
  const levels = new Set(attempts.map(attempt => attempt.levelId));
  const active = [
    ...attempts.map(attempt => attempt.timestamp),
    ...exams.map(exam => exam.timestamp),
    ...daily.flatMap(answer => (answer.date ? [dayStart(answer.date)] : [])).filter((at): at is number => at !== null),
  ];
  return {
    id: user.id,
    name: user.username || 'Unnamed player',
    detail: user.email || 'Pilot pool account',
    joinedAt: user.createdAt || null,
    storyAttempts: attempts.length,
    levelsPlayed: levels.size,
    highestLevel: levels.size > 0 ? Math.max(...levels) : null,
    averageScore: mean(attempts.map(attempt => attempt.finalScore)),
    correct: attempts.reduce((sum, attempt) => sum + attempt.correctDecisions, 0),
    mistakes: attempts.reduce((sum, attempt) => sum + attempt.violations, 0),
    examSittings: exams.length,
    examBest: exams.length > 0 ? Math.max(...exams.map(exam => exam.score)) : null,
    dailyAnswers: daily.length,
    dailyCorrect: daily.filter(answer => answer.correct).length,
    lastActiveAt: active.length > 0 ? Math.max(...active) : null,
  };
};

/** Every player, the most recently active first, then the newest. */
export const reportPlayers = ({ users, attempts, examResults, dailyResults }: AdminData): ReportPlayer[] => {
  const attemptsBy = groupBy(attempts, row => row.userId);
  const examsBy = groupBy(examResults, row => row.userId);
  const dailyBy = groupBy(dailyResults, row => row.userId);
  return users
    .map(user => playerOf(user, attemptsBy.get(user.id) ?? [], examsBy.get(user.id) ?? [], dailyBy.get(user.id) ?? []))
    .sort((a, b) => (b.lastActiveAt ?? -1) - (a.lastActiveAt ?? -1) || (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
};

export const reportTotals = ({ users, attempts, examResults, dailyResults }: AdminData): ReportTotals => ({
  players: users.length,
  playersInStory: new Set(attempts.map(attempt => attempt.userId)).size,
  storyAttempts: attempts.length,
  averageScore: mean(attempts.map(attempt => attempt.finalScore)),
  correct: attempts.reduce((sum, attempt) => sum + attempt.correctDecisions, 0),
  mistakes: attempts.reduce((sum, attempt) => sum + attempt.violations, 0),
  examSittings: examResults.length,
  examPassed: examResults.filter(exam => exam.passed).length,
  dailyAnswers: dailyResults.length,
  dailyCorrect: dailyResults.filter(answer => answer.correct).length,
});

/** A player's Story attempts by level, in level order. */
export const playerLevels = (attempts: readonly AttemptRow[]): PlayerLevel[] =>
  [...groupBy(attempts, row => String(row.levelId)).values()]
    .map(rows => ({
      levelId: rows[0].levelId,
      name: levelName(rows[0].levelId),
      attempts: rows.length,
      bestScore: Math.max(...rows.map(row => row.finalScore)),
      passMark: passMarkOf(rows[0].levelId),
      lastAt: Math.max(...rows.map(row => row.timestamp)),
    }))
    .sort((a, b) => a.levelId - b.levelId);

/** A player's latest graded decisions, newest first. */
export const recentDecisions = (attempts: readonly AttemptRow[], limit = 12): RecentDecision[] =>
  attempts
    .flatMap(attempt =>
      (attempt.logs ?? []).flatMap(log =>
        log.result === 'neutral'
          ? []
          : [
              {
                levelId: attempt.levelId,
                timestamp: log.timestamp,
                action: log.action,
                result: log.result,
                points: log.points,
                competency: log.competency ?? null,
                ruleId: log.ruleId ?? null,
                expectedAction: log.expectedAction ?? null,
              },
            ]
      )
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

/** A player matches a search on their name, their email, or their id. */
export const matchesPlayer = (player: Pick<ReportPlayer, 'id' | 'name' | 'detail'>, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  return needle === '' || [player.name, player.detail, player.id].some(field => field.toLowerCase().includes(needle));
};

export interface AttemptFilter {
  /** A level id, or null for every level. */
  levelId: number | null;
  /** Matched against the player's name, email or id. */
  query: string;
}

/** Story attempts, newest first, narrowed by level and player. */
export const filterAttempts = (
  attempts: readonly AttemptRow[],
  players: ReadonlyMap<string, Pick<ReportPlayer, 'id' | 'name' | 'detail'>>,
  { levelId, query }: AttemptFilter
): AttemptRow[] =>
  attempts
    .filter(attempt => levelId === null || attempt.levelId === levelId)
    .filter(attempt => matchesPlayer(players.get(attempt.userId) ?? { id: attempt.userId, name: '', detail: '' }, query))
    .sort((a, b) => b.timestamp - a.timestamp);
