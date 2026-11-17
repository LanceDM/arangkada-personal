/**
 * What the admin's course views read from the per-competency course's own
 * records: where each participant is, the Q-learning decisions and rewards by
 * state and action, and each participant's BKT from their BKT update log.
 * Every figure comes from logged participant data; nothing is simulated,
 * pre-trained or recomputed with another model.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { masteryLevel, type MasteryLevel } from '@/domain/competencyRouting/mastery';
import { COMPETENCY_ACTIONS, Q_STATES, stateKey, type CompetencyAction } from '@/domain/competencyRouting/qLearning';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;

// --- the course log, as read ---------------------------------------------------------------

export interface CourseVerdict {
  competency: string;
  total: number;
  correct: number;
  passed: boolean;
  masteryP: number;
  driveEvidence: number;
}

/** One `users/{uid}/courseLog` entry. */
export interface CourseLogRow {
  userId: string;
  kind: string;
  levelId: number;
  phase: string;
  verdicts: CourseVerdict[];
  decisions: DecisionRecord[];
  rewards: RewardRecord[];
  endReason: 'certified' | 'cap_reached' | null;
  timestamp: number;
}

/** A course-log document as read, or null when it is not one. Its records are the course's own. */
export const courseLogRowOf = (userId: string, data: unknown): CourseLogRow | null => {
  const row = record(data);
  if (!row || typeof row.levelId !== 'number' || typeof row.timestamp !== 'number') return null;
  if (!Array.isArray(row.decisions) || !Array.isArray(row.rewards)) return null;
  return {
    userId,
    kind: typeof row.kind === 'string' ? row.kind : 'drive',
    levelId: row.levelId,
    phase: typeof row.phase === 'string' ? row.phase : '',
    verdicts: Array.isArray(row.verdicts) ? (row.verdicts as CourseVerdict[]) : [],
    decisions: row.decisions as DecisionRecord[],
    rewards: row.rewards as RewardRecord[],
    endReason: row.endReason === 'certified' || row.endReason === 'cap_reached' ? row.endReason : null,
    timestamp: row.timestamp,
  };
};

// --- where each participant is ------------------------------------------------------------

export interface CompetencyStanding {
  competency: DrivingCompetency;
  /** Decisions made for it in this stage. */
  attempts: number;
  lastAction: CompetencyAction | null;
  /** Done: the policy chose none. Flagged: the attempt cap ended it. */
  status: 'open' | 'done' | 'flagged';
  lastCorrect: number | null;
  lastTotal: number | null;
}

export interface PlayerCourseRow {
  uid: string;
  label: string;
  entries: number;
  /** The phase of the newest course-log entry, e.g. `REPEAT(3)`. */
  lastPhase: string | null;
  lastAt: number | null;
  endReason: 'certified' | 'cap_reached' | null;
  /** The newest stage's competencies, as its decisions left them. */
  standing: CompetencyStanding[];
  decisions: number;
  rewards: number;
}

export const playerCourseRows = (logs: readonly CourseLogRow[], label: (uid: string) => string): PlayerCourseRow[] => {
  const byUser = new Map<string, CourseLogRow[]>();
  for (const row of logs) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  return [...byUser.entries()]
    .map(([uid, rows]) => {
      const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
      const last = sorted[sorted.length - 1];
      const stage = sorted.filter(row => row.levelId === last.levelId && (row.kind === 'drive' || row.kind === 'quiz'));
      const competencies = [...new Set(stage.flatMap(row => row.verdicts.map(v => v.competency as DrivingCompetency)))];
      const standing = competencies.map((competency): CompetencyStanding => {
        const decided = stage.flatMap(row => row.decisions).filter(d => d.competency === competency);
        const lastDecision = decided[decided.length - 1] ?? null;
        const lastVerdict = [...stage].reverse().flatMap(row => row.verdicts).find(v => v.competency === competency) ?? null;
        return {
          competency,
          attempts: decided.length,
          lastAction: lastDecision?.action ?? null,
          status: lastDecision?.source === 'cap' ? 'flagged' : lastDecision?.action === 'none' ? 'done' : 'open',
          lastCorrect: lastVerdict?.correct ?? null,
          lastTotal: lastVerdict?.total ?? null,
        };
      });
      return {
        uid,
        label: label(uid),
        entries: sorted.length,
        lastPhase: last.phase || null,
        lastAt: last.timestamp,
        endReason: sorted.find(row => row.endReason)?.endReason ?? null,
        standing,
        decisions: sorted.reduce((sum, row) => sum + row.decisions.length, 0),
        rewards: sorted.reduce((sum, row) => sum + row.rewards.length, 0),
      };
    })
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
};

// --- the Q-learning decisions, by state and action ----------------------------------------

export interface StateActionStats {
  state: string;
  action: CompetencyAction;
  chosen: number;
  explore: number;
  exploit: number;
  forced: number;
  /** Rewards received so far, steps and terminal ones together. */
  rewarded: number;
  /** Option 2's steps: a practice or review followed by another decision in the level, r = -psi * H. */
  steps: number;
  /** Terminal rewards: the episode's last decision, r = A_next - psi * H, at the next measurement after the level. */
  terminal: number;
  meanReward: number | null;
  /** Mean reward of the terminal ones alone. */
  meanTerminalReward: number | null;
  /** Mean A_next over terminal rewards: a step measures no outcome. */
  meanAccuracy: number | null;
  meanAdded: number | null;
}

/** A reward saved before Option 2 (2026-11-15) names no kind: every one then was terminal in form. */
export const isTerminal = (reward: { kind?: RewardRecord['kind'] }): boolean => (reward.kind ?? 'terminal') === 'terminal';

const mean = (values: readonly number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

export const stateActionStats = (logs: readonly CourseLogRow[]): StateActionStats[] => {
  const decisions = logs.flatMap(row => row.decisions);
  const rewards = logs.flatMap(row => row.rewards);
  return Q_STATES.flatMap(state =>
    COMPETENCY_ACTIONS.map((action): StateActionStats => {
      const key = stateKey(state);
      const mine = decisions.filter(d => stateKey(d.state) === key && d.action === action);
      const paid = rewards.filter(r => stateKey(r.state) === key && r.action === action);
      const ended = paid.filter(isTerminal);
      return {
        state: key,
        action,
        chosen: mine.length,
        explore: mine.filter(d => d.selection === 'explore').length,
        exploit: mine.filter(d => d.selection === 'exploit').length,
        forced: mine.filter(d => d.selection === 'forced').length,
        rewarded: paid.length,
        steps: paid.length - ended.length,
        terminal: ended.length,
        meanReward: mean(paid.map(r => r.reward)),
        meanTerminalReward: mean(ended.map(r => r.reward)),
        meanAccuracy: mean(ended.map(r => r.accuracy)),
        meanAdded: mean(paid.map(r => r.addedDecisions)),
      };
    })
  );
};

export interface DecisionRow extends DecisionRecord {
  uid: string;
  label: string;
  /** Its reward, once its competency was measured again. */
  reward: RewardRecord | null;
}

/** Every decision, newest first, with its reward when it has one. */
export const decisionRows = (logs: readonly CourseLogRow[], label: (uid: string) => string): DecisionRow[] => {
  // A decision's id is `<level>:<competency>:<seq>` within its participant's course.
  const rewards = new Map(logs.flatMap(row => row.rewards.map(reward => [`${row.userId}|${reward.decisionId}`, reward] as const)));
  return logs
    .flatMap(row =>
      row.decisions.map(decision => ({
        ...decision,
        uid: row.userId,
        label: label(row.userId),
        reward: rewards.get(`${row.userId}|${decision.levelId}:${decision.competency}:${decision.seq}`) ?? null,
      }))
    )
    .sort((a, b) => b.timestamp - a.timestamp || b.seq - a.seq);
};

// --- each participant's BKT, from their BKT update log ------------------------------------

export type BktSource = 'pre_test' | 'quiz' | 'drive';
const SOURCES: readonly BktSource[] = ['pre_test', 'quiz', 'drive'];

export interface CompetencyBkt {
  p: number;
  level: MasteryLevel;
  /** P(L) after the pre-test seeded it; null with no pre-test answer. */
  startP: number | null;
  answers: Record<BktSource, number>;
  correct: number;
  /** P(L) after each of its answers, oldest first. */
  trajectory: number[];
}

export interface PlayerBkt {
  uid: string;
  label: string;
  answers: number;
  lastAt: number | null;
  competencies: Record<DrivingCompetency, CompetencyBkt>;
}

/**
 * Each participant's BKT as the course's own log wrote it: P(L) after every
 * graded answer, replayed by the game with the course's model. A competency
 * with no answer reads the log's starting prior.
 */
export const playerBkt = (rows: readonly Record<string, unknown>[], label: (uid: string) => string, pInit: number): PlayerBkt[] => {
  const byUser = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    if (typeof row.uid !== 'string' || typeof row.userSeq !== 'number' || typeof row.pAfter !== 'number') continue;
    if (!(COMPETENCIES as string[]).includes(row.competency as string)) continue;
    byUser.set(row.uid, [...(byUser.get(row.uid) ?? []), row]);
  }
  return [...byUser.entries()]
    .map(([uid, entries]) => {
      const sorted = [...entries].sort((a, b) => (a.userSeq as number) - (b.userSeq as number));
      const competencies = Object.fromEntries(
        COMPETENCIES.map((c): [DrivingCompetency, CompetencyBkt] => [
          c,
          { p: pInit, level: masteryLevel(pInit, 0), startP: null, answers: { pre_test: 0, quiz: 0, drive: 0 }, correct: 0, trajectory: [] },
        ])
      ) as Record<DrivingCompetency, CompetencyBkt>;
      for (const entry of sorted) {
        const c = competencies[entry.competency as DrivingCompetency];
        const source = SOURCES.includes(entry.source as BktSource) ? (entry.source as BktSource) : 'drive';
        c.answers[source] += 1;
        if (entry.correct === true) c.correct += 1;
        c.p = entry.pAfter as number;
        c.level = typeof entry.levelAfter === 'number' ? (entry.levelAfter as MasteryLevel) : masteryLevel(c.p, c.answers.drive);
        if (source === 'pre_test') c.startP = c.p;
        c.trajectory.push(c.p);
      }
      const last = sorted[sorted.length - 1];
      return {
        uid,
        label: label(uid),
        answers: sorted.length,
        lastAt: typeof last?.answeredAt === 'number' ? last.answeredAt : null,
        competencies,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};
