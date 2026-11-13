/**
 * What the admin's course views read from the study's records: where each
 * player is in the per-competency course, the Q-learning decisions and
 * rewards by state and action, and each player's BKT now. Every figure comes
 * from logged participant data; nothing here is simulated or pre-trained.
 */
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { buildBKTEvidence, buildBKTProfile, type BKTModel, type CompetencyEvidence } from '@/domain/learner/mastery/buildBKTProfile';
import { masteryLevel, MASTERY_DESCRIPTORS, type MasteryLevel } from '@/domain/competencyRouting/mastery';
import { COMPETENCY_ACTIONS, Q_STATES, stateKey, type CompetencyAction } from '@/domain/competencyRouting/qLearning';
import type { DecisionRecord, RewardRecord } from '@/domain/competencyRouting/course';
import type { AttemptRow, CourseLogRow, SittingRow, UserRow } from './adminReport';
import { participantEvidence } from './studyExport';

/** A player as the admin views name them: their study code, else their username, else a short id. */
export const playerLabel = (uid: string, codes: ReadonlyMap<string, string>, users: readonly UserRow[]): string =>
  codes.get(uid) ?? users.find(user => user.id === uid)?.username ?? `${uid.slice(0, 6)}…`;

// --- where each player is ----------------------------------------------------------------

export interface CompetencyStanding {
  competency: DrivingCompetency;
  /** Drives and repeat drives it was decided after in this stage. */
  attempts: number;
  lastAction: CompetencyAction | null;
  /** Done: the policy chose none, or the attempt cap ended it (flagged). */
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
  lastLevel: number | null;
  lastAt: number | null;
  endReason: 'certified' | 'cap_reached' | null;
  /** The newest stage's competencies, as its decisions left them. */
  standing: CompetencyStanding[];
  decisions: number;
  rewards: number;
}

export const playerCourseRows = (
  logs: readonly CourseLogRow[],
  codes: ReadonlyMap<string, string>,
  users: readonly UserRow[]
): PlayerCourseRow[] => {
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
        label: playerLabel(uid, codes, users),
        entries: sorted.length,
        lastPhase: last.phase,
        lastLevel: last.levelId,
        lastAt: last.timestamp,
        endReason: sorted.find(row => row.endReason)?.endReason ?? null,
        standing,
        decisions: sorted.reduce((sum, row) => sum + row.decisions.length, 0),
        rewards: sorted.reduce((sum, row) => sum + row.rewards.length, 0),
      };
    })
    .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
};

// --- the Q-learning decisions, by state and action ---------------------------------------

export interface StateActionStats {
  state: string;
  action: CompetencyAction;
  /** Decisions that chose this action in this state. */
  chosen: number;
  /** Of those, how many were explored (a random warm-up draw), exploited, or forced. */
  explore: number;
  exploit: number;
  forced: number;
  /** Rewards received so far (each decision is rewarded at its next measurement). */
  rewarded: number;
  meanReward: number | null;
  /** The parts of the reward: A_next, the pass share and H, averaged. */
  meanAccuracy: number | null;
  passShare: number | null;
  meanAdded: number | null;
}

const mean = (values: readonly number[]) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

export const stateActionStats = (logs: readonly CourseLogRow[]): StateActionStats[] => {
  const decisions = logs.flatMap(row => row.decisions);
  const rewards = logs.flatMap(row => row.rewards);
  return Q_STATES.flatMap(state =>
    COMPETENCY_ACTIONS.map((action): StateActionStats => {
      const key = stateKey(state);
      const mine = decisions.filter(d => stateKey(d.state) === key && d.action === action);
      const paid = rewards.filter(r => stateKey(r.state) === key && r.action === action);
      return {
        state: key,
        action,
        chosen: mine.length,
        explore: mine.filter(d => d.selection === 'explore').length,
        exploit: mine.filter(d => d.selection === 'exploit').length,
        forced: mine.filter(d => d.selection === 'forced').length,
        rewarded: paid.length,
        meanReward: mean(paid.map(r => r.reward)),
        meanAccuracy: mean(paid.map(r => r.accuracy)),
        passShare: mean(paid.map(r => (r.passed ? 1 : 0))),
        meanAdded: mean(paid.map(r => r.addedDecisions)),
      };
    })
  );
};

export interface DecisionRow extends DecisionRecord {
  uid: string;
  label: string;
  /** The reward this decision has received, once its competency was measured again. */
  reward: RewardRecord | null;
}

/** Every decision, newest first, with its reward when it has one. */
export const decisionRows = (
  logs: readonly CourseLogRow[],
  codes: ReadonlyMap<string, string>,
  users: readonly UserRow[]
): DecisionRow[] => {
  // A decision's id is `<level>:<competency>:<seq>` within its player's course.
  const rewards = new Map(logs.flatMap(row => row.rewards.map(reward => [`${row.userId}|${reward.decisionId}`, reward] as const)));
  return logs
    .flatMap(row =>
      row.decisions.map(decision => ({
        ...decision,
        uid: row.userId,
        label: playerLabel(row.userId, codes, users),
        reward: rewards.get(`${row.userId}|${decision.levelId}:${decision.competency}:${decision.seq}`) ?? null,
      }))
    )
    .sort((a, b) => b.timestamp - a.timestamp);
};

// --- each player's BKT now ---------------------------------------------------------------

export interface PlayerMastery {
  uid: string;
  label: string;
  mastery: Record<DrivingCompetency, number>;
  level: Record<DrivingCompetency, MasteryLevel>;
  evidence: Record<DrivingCompetency, CompetencyEvidence>;
  answers: number;
}

/**
 * Each player's BKT per competency, replayed from their own drive and sitting
 * answers with the course's model. This is the replay the export holds; the
 * game's own reading orders a player's records the same way (by when each
 * was answered), so the two agree.
 */
export const playerMastery = (
  attempts: readonly AttemptRow[],
  sittings: readonly SittingRow[],
  codes: ReadonlyMap<string, string>,
  users: readonly UserRow[],
  uids?: readonly string[],
  /** The values each player runs on (their value set); the default values when absent. */
  modelOf?: (uid: string) => BKTModel
): PlayerMastery[] => {
  const ids = uids ?? [...new Set([...sittings.map(row => row.userId), ...attempts.map(row => row.userId)])];
  return ids
    .map(uid => {
      const evidence = participantEvidence(
        attempts.filter(row => row.userId === uid),
        sittings.filter(row => row.userId === uid)
      );
      const mastery = buildBKTProfile(evidence, modelOf?.(uid));
      const counts = buildBKTEvidence(evidence);
      const level = Object.fromEntries(COMPETENCIES.map(c => [c, masteryLevel(mastery[c], counts[c].drive)])) as Record<DrivingCompetency, MasteryLevel>;
      return {
        uid,
        label: playerLabel(uid, codes, users),
        mastery,
        level,
        evidence: counts,
        answers: COMPETENCIES.reduce((sum, c) => sum + counts[c].total, 0),
      };
    })
    .filter(row => row.answers > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
};

export { MASTERY_DESCRIPTORS };
