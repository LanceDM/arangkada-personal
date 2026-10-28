/**
 * Admin's read models.
 *
 * Admin is a reporting feature: it reads other features' collections across
 * every user and owns none of them. These shapes therefore describe what it
 * reads, not what anyone writes — which is why they live here rather than being
 * borrowed from the writing feature's persistence types.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import type { QTable } from '@/domain/competencyRouting/qLearning';
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
  /** Timing of a course drive (start, end, pauses, route length); absent on older attempts. */
  session?: {
    startedAt: number;
    endedAt: number;
    durationMs: number;
    pausedMs: number;
    routeLength: number;
    crashed: boolean;
    phase: string;
  };
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

/** One entry of `users/{uid}/courseLog`: a drive's, quiz's, final's or post-exam's decisions and rewards. */
export interface CourseLogRow {
  userId: string;
  kind: 'drive' | 'quiz' | 'post_exam' | 'final';
  levelId: number;
  phase: string;
  attemptId: string | null;
  verdicts: { competency: string; total: number; correct: number; passed: boolean; masteryP: number; driveEvidence: number }[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  /** The shared Q-table right after this entry. */
  tableAfter: QTable;
  endReason?: 'certified' | 'cap_reached';
  timestamp: number;
}

/**
 * One sitting of `users/{uid}/assessmentSittings`: quiz, diagnostic or
 * post-exam answers. The stored Rasch ability is deliberately not read: IRT is
 * excluded from the study export until the group decides what it uses.
 */
export interface SittingRow {
  userId: string;
  kind: 'quiz' | 'diagnostic' | 'post_exam';
  levelId: number | null;
  attempt: number | null;
  answers: ActionLog[];
  timestamp: number;
}

/** `users/{uid}/study/background`. */
export interface BackgroundRow {
  userId: string;
  formVersion: number;
  answers: Record<string, string>;
  timestamp: number;
}

/** `policy/competencyQ`: the one Q-table every participant's decisions update. */
export interface SharedQTableRow {
  table: QTable;
  updates: number;
  updatedAt: number;
}

/** What the study export reads, beyond the report's four collections. */
export interface StudyData {
  courseLogs: CourseLogRow[];
  sittings: SittingRow[];
  backgrounds: BackgroundRow[];
  sharedQTable: SharedQTableRow | null;
}

/** `participants/{code}` (A) or the `Participant` table (B): who is enrolled under which code. */
export interface ParticipantRow {
  code: string;
  uid: string;
  email: string | null;
  consentVersion: string;
  consentedAt: number;
  enrolledAt: number;
  finishedAt: number | null;
  note: string | null;
}

/** `roleGrants/{id}` (A) or the `RoleGrant` table (B): who was given admin, by whom, and when. */
export interface RoleGrantRow {
  id: string;
  uid: string;
  email: string | null;
  role: 'admin';
  action: 'grant' | 'revoke';
  by: string;
  at: number;
  reason: string | null;
}

/** `configVersions/{tag}` (A) or the `ConfigVersion` table (B): every settings version the study ran. */
export interface ConfigVersionRow {
  tag: string;
  fingerprint: string;
  config: Record<string, unknown>;
  activeFrom: number;
  activeTo: number | null;
  note: string | null;
}

/** The people, roles and settings records, from whichever implementation is bound. */
export interface StudyRecords {
  participants: ParticipantRow[];
  roleGrants: RoleGrantRow[];
  configVersions: ConfigVersionRow[];
}

/** The live Q-table document, `policy/competencyQ`. */
export interface LiveQTable {
  table: Record<string, Partial<Record<'none' | 'practice' | 'review', { q: number; n: number; visits: number }>>>;
  updates: number;
  updatedAt: number;
  states: Record<string, { phase: string; tag: 'exploring' | 'exploiting' | 'no_choice'; leader: string | null }>;
  lastUpdate: { updateId: string; globalSeq: number; kind: 'visit' | 'learn'; uid: string; participantCode: string | null; at: number } | null;
}

/** One entry of `policy/competencyQ/updates`, as the dashboard reads it. */
export interface QUpdateRow {
  updateId: string;
  globalSeq: number;
  kind: 'visit' | 'learn';
  uid: string;
  participantCode: string | null;
  at: number;
  levelId: number | null;
  phase: string | null;
  competency: string;
  decisionId: string;
  stateKey: string;
  action: string;
  decision: Record<string, unknown> | null;
  learning: Record<string, unknown> | null;
  configVersion: string;
}
