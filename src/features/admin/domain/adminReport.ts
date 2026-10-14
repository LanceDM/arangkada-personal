/**
 * Admin's read models.
 *
 * Admin is a reporting feature: it reads other features' collections across
 * every user and owns none of them. These shapes therefore describe what it
 * reads, not what anyone writes — which is why they live here rather than being
 * borrowed from the writing feature's persistence types.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { ScenarioEvent } from '@/features/driving-sim';

/**
 * A per-level result as it appears inside the **legacy embedded**
 * `users/{uid}.progress` object.
 *
 * KNOWN GAP, deliberately preserved: nothing has written this field since
 * progress moved to `users/{uid}/progress/summary` and per-attempt records
 * moved to `users/{uid}/attempts`. Accounts created after that migration carry
 * no `progress`, so the panels below that read it (completed-level counts, weak
 * competencies, the per-user result table) are populated only for legacy
 * accounts. Changing the source would change what the report means, so it is
 * recorded here rather than quietly rewired.
 */
export interface LegacyLevelResult {
  levelId: number;
  score: number;
  stars: number;
  completed: boolean;
  violations: number;
  correctActions: number;
  logs: ActionLog[];
  competencyScores?: Record<string, number>;
  weakestCompetency?: string | null;
}

export interface LegacyEmbeddedProgress {
  unlockedLevels: number[];
  levelResults: Record<number, LegacyLevelResult>;
  totalScore: number;
  /** The equally-legacy embedded daily record, superseded by `dailyAttempts`. */
  daily?: {
    streak: {
      currentStreak: number;
      longestStreak: number;
      lastCompletedDate: string | null;
      completedDates: string[];
    };
    answersByDate: Record<string, { selectedIndex: number }>;
  };
  updatedAt: number;
}

/** One row of the `users` collection, as the report reads it. */
export interface UserRow {
  id: string;
  email: string;
  username: string;
  createdAt: number;
  totalScore: number;
  longestStreak: number;
  bestExamScore: number;
  progress?: LegacyEmbeddedProgress;
}

/** One drive, flattened out of `users/{uid}/attempts` across every user. */
export interface AttemptRow {
  userId: string;
  levelId: number;
  timestamp: number;
  finalScore: number;
  violations: number;
  correctDecisions: number;
  logs: ActionLog[];
}

/** One sitting, flattened out of `users/{uid}/examAttempts` across every user. */
export interface ExamRow {
  id: string;
  userId: string;
  score: number;
  passed: boolean;
  wrongIds: number[];
  questionIds?: number[];
  timestamp: number;
}

/** One answered daily challenge, across every user. */
export interface DailyRow {
  id: string;
  userId: string;
  scenarioId: string;
  correct: boolean;
  date: string;
}

/** A scoring rule as the curriculum defines it, summarised over every level. */
export interface RuleSummary {
  id: string;
  type: ScenarioEvent['type'];
  expectedAction: ScenarioEvent['correctAction'];
  levelIds: number[];
  fires: number;
  totalPoints: number;
  lawCitation?: string;
}

export type UserActionLog = ActionLog & { levelId: number };

export interface AdminData {
  users: UserRow[];
  attempts: AttemptRow[];
  examResults: ExamRow[];
  dailyResults: DailyRow[];
}

export type AdminCollectionErrors = Record<string, string>;
