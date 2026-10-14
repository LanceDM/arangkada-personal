/**
 * Per-decision telemetry: what each decision in an attempt was, what the
 * adaptive layer had chosen for the level it was made in, and what the learner
 * model believed before and after it.
 *
 * The raw transition log says what the machine did; this says why the machine
 * was configured that way and what each decision did to the belief it acts on.
 * Together with the attempt's own `logs`, it is enough to reconstruct every
 * decision of an attempt from storage alone - the Q-state read at the level
 * entry, the action taken and the table it was read from, the support level and
 * the theta asked for, the theta each scenario actually got, and the BKT
 * estimate either side of every graded decision.
 *
 * Stored at `users/{uid}/attempts/{id}/telemetry/decisions`, beside the raw
 * log and never inline on the attempt, for signed-in players only. Everything
 * here is JSON-safe: no `undefined` (Firestore refuses it) and no `Infinity`
 * (JSON cannot carry it), so a limit that does not bind is written as `null`.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency, SupportLevel } from '@/domain/learner/competency';
import { COMPETENCIES, getLowestScoringCompetency, type WeakestTieBreak } from '@/domain/learner/profile';
import {
  DEFAULT_BKT_PARAMS,
  buildBKTLearnerProfile,
  buildBKTProfile,
  updateMastery,
  type BKTParams,
} from '@/domain/learner/mastery/buildBKTProfile';
import { POLICY_TABLE_ID, WINDOW_SCALE, type QAction, type QState } from '@/domain/learner/adaptive/qLearningPolicy';
import { DEFAULT_TRANSITION_PARAMS } from '@/features/driving-sim/domain/fsm/fsmTypes';
import type { ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import {
  MASTERY_THRESHOLD,
  type PracticeChoice,
  type PracticeDecision,
} from '@/features/driving-sim/domain/adaptive/practiceSelection';

export const DECISION_TELEMETRY_SCHEMA_VERSION = 1;

/**
 * Where a decision was made. Garage calls are Go / No-Go, not driving inputs;
 * 'penalty' covers standing infractions such as crawling along a clear road,
 * which cost points but are not one of the level's scored road events.
 */
export type DecisionKind = 'road' | 'garage' | 'penalty';

/**
 * What the drive knows about one logged decision that its `ActionLog` does not
 * carry. Kept beside the log, one per entry and in the same order, by the one
 * function that writes both (`useScenarioEvaluation`).
 */
export interface DecisionTrace {
  scenarioId: string;
  kind: DecisionKind;
  /** How the world settled it; absent for a garage answer or a standing penalty. */
  settlement: DecisionSettlement | null;
  /** What theta did to the scenario's approach; only a road decision has one. */
  approach: ApproachTrace | null;
}

/** The world re-rolled the route ahead toward a weak competency, straight after a decision. */
export interface RerollTrace {
  /** Index into the attempt's `logs` of the decision whose settling re-rolled the route. */
  afterDecision: number;
  competency: DrivingCompetency;
}

/**
 * Why the level was or was not adapted.
 *
 * - `policy`: the policy chose, and portable practice content was found.
 * - `no-portable-content`: the policy chose, but nothing portable exists for
 *   it here, so the level was played on the baseline machine anyway.
 * - `mastered`: nothing is below the mastery threshold; no state was read.
 * - `no-history`: nothing to read a state from.
 * - `final-exam`: the one level the adaptive layer may not act on.
 * - `routing`: the practice policy was not consulted. The entry was built by
 *   the routing FSM in a New group, or played as a free replay, on the plain
 *   FSM's settings; what the machine decided is in `telemetry/routing`.
 */
export type PolicySource = 'policy' | 'no-portable-content' | 'mastered' | 'no-history' | 'final-exam' | 'routing';

/** The adaptive layer's decision at the level entry, and what the level was actually played at. */
export interface PolicyDecisionRecord {
  source: PolicySource;
  qState: QState | null;
  action: QAction | null;
  /** The table's entry exactly as stored, so the lookup can be repeated. */
  tableKey: string | null;
  /**
   * Which table the decision was read from (`POLICY_TABLE_ID`). `e7fa4813` is
   * the table that predated h, read through an interim decode until it was
   * retrained: a decision carrying that id was never a trained choice of
   * support level.
   */
  policyTableId: string;
  masteryThreshold: number;
  weakest: DrivingCompetency | null;
  /** The weakest competency's BKT score (0-100), as the state was read from it. */
  weakestScore: number | null;
  /** The competency the injected scenario practises - a stand-in where the weakest had no content. */
  practised: DrivingCompetency | null;
  practiceScenarioId: string | null;
  practiceSourceLevelId: number | null;
  /** What the policy's action asked for; null where there was no action. */
  requested: { support: SupportLevel | null; approachScale: number | null };
  /** What the level was played at, after the fixed levels and the baseline fallback. */
  applied: { support: SupportLevel; approachScale: number };
  /** BKT's P(mastered) per competency at the level entry, from the whole history. */
  entryMastery: Record<DrivingCompetency, number>;
}

/** One decision, reconstructible from this record and the log entry it joins. */
export interface DecisionRecord {
  /** Index into the attempt's `logs`: the entry this record describes. */
  logIndex: number;
  timestamp: number;
  scenarioId: string | null;
  kind: DecisionKind | null;
  settlement: DecisionSettlement | null;
  competency: DrivingCompetency | null;
  result: ActionLog['result'];
  points: number;
  /** The scenario the adaptive layer injected. */
  remediation: boolean;
  /** The support level it was presented at; absent for a question, a tutorial step or a penalty. */
  support: SupportLevel | null;
  /** Theta, asked for and as the scenario got it; null where there was no approach. */
  theta: {
    requested: number;
    effective: number;
    baselineLead: number;
    lead: number;
    /** Null where nothing limited a widened approach. */
    room: number | null;
    /** Null where the approach is never narrowed. */
    floor: number | null;
  } | null;
  /** A timed response, a window that closed on one, or nothing about response speed. */
  reaction: { ms: number } | { censored: true } | null;
  /** BKT's P(mastered) of `competency` either side of this decision, from the whole history. */
  bktBefore: number | null;
  bktAfter: number | null;
}

/** `users/{uid}/attempts/{id}/telemetry/decisions`. */
export interface DecisionTelemetryDoc {
  schemaVersion: typeof DECISION_TELEMETRY_SCHEMA_VERSION;
  levelId: number;
  /**
   * The attempt's seed. It reproduces what was decided before the drive - the
   * level's roll, the practice pick, the order of every question's answers -
   * given the same history and sign coverage. It does not reproduce the live
   * re-roll or the drive itself.
   */
  attemptSeed: number;
  /** The route as rolled for this attempt, in road order, including an injected scenario. */
  route: string[];
  bkt: BKTParams;
  policy: PolicyDecisionRecord;
  rerolls: RerollTrace[];
  decisions: DecisionRecord[];
  /** The decisions were cut to fit one Firestore document; `totalCount` is how many there were. */
  truncated: boolean;
  totalCount: number;
}

/** What an attempt was entered with, known before the drive starts. */
export interface AttemptEntry {
  levelId: number;
  attemptSeed: number;
  route: string[];
  policy: PolicyDecisionRecord;
}

/**
 * The level entry's decision, recorded from the history it was made over.
 *
 * `decision` is the policy's own (`decidePractice`) and `practice` what it
 * resolved to, so the recorded state and action are the ones the game used
 * rather than a second reading of them. `tieBreak` must be the one the
 * decision was made under, so the weakest competency recorded is the one it
 * read; omitted, it is `list-order`, as `decidePractice`'s is.
 */
export const recordPolicyDecision = ({
  history,
  decision,
  practice,
  adapts,
  support,
  tieBreak = 'list-order',
}: {
  history: ActionLog[];
  decision: PracticeDecision | null;
  practice: PracticeChoice | null;
  /** False for the final exam, which takes nothing from the policy. */
  adapts: boolean;
  /** The support level the level is played at. */
  support: SupportLevel;
  tieBreak?: WeakestTieBreak;
}): PolicyDecisionRecord => {
  const profile = history.length > 0 ? buildBKTLearnerProfile(history) : null;
  const weakest = profile ? getLowestScoringCompetency(profile, tieBreak) : null;
  const action = decision?.lookup.action ?? null;
  const source: PolicySource = !adapts
    ? 'final-exam'
    : history.length === 0
      ? 'no-history'
      : !decision
        ? 'mastered'
        : !practice
          ? 'no-portable-content'
          : 'policy';

  return {
    source,
    qState: decision?.state ?? null,
    action,
    tableKey: decision?.lookup.tableKey ?? null,
    policyTableId: POLICY_TABLE_ID,
    masteryThreshold: MASTERY_THRESHOLD,
    weakest,
    weakestScore: profile && weakest ? profile[weakest].score : null,
    practised: practice?.competency ?? null,
    practiceScenarioId: practice?.variant.id ?? null,
    practiceSourceLevelId: practice?.sourceLevelId ?? null,
    requested: {
      support: action?.support ?? null,
      approachScale: action ? WINDOW_SCALE[action.window] : null,
    },
    applied: {
      support,
      approachScale: practice?.transitionParams.approachScale ?? DEFAULT_TRANSITION_PARAMS.approachScale,
    },
    entryMastery: buildBKTProfile(history),
  };
};

/**
 * The level entry's record where the routing FSM built it, or a free replay:
 * no Q-state and no action, the item the routing move placed if any, and the
 * plain FSM's support at theta 1. The weakest competency is read as the
 * learned policy reads it, ties to the least observed.
 */
export const recordRoutedDecision = ({
  history,
  item,
  support,
}: {
  history: ActionLog[];
  item: { competency: DrivingCompetency; scenarioId: string; sourceLevelId: number } | null;
  support: SupportLevel;
}): PolicyDecisionRecord => {
  const profile = history.length > 0 ? buildBKTLearnerProfile(history) : null;
  const weakest = profile ? getLowestScoringCompetency(profile, 'least-observed') : null;
  return {
    source: 'routing',
    qState: null,
    action: null,
    tableKey: null,
    policyTableId: POLICY_TABLE_ID,
    masteryThreshold: MASTERY_THRESHOLD,
    weakest,
    weakestScore: profile && weakest ? profile[weakest].score : null,
    practised: item?.competency ?? null,
    practiceScenarioId: item?.scenarioId ?? null,
    practiceSourceLevelId: item?.sourceLevelId ?? null,
    requested: { support: null, approachScale: null },
    applied: { support, approachScale: DEFAULT_TRANSITION_PARAMS.approachScale },
    entryMastery: buildBKTProfile(history),
  };
};

const finiteOrNull = (value: number): number | null => (Number.isFinite(value) ? value : null);

const isCompetency = (value: string | undefined): value is DrivingCompetency =>
  value !== undefined && (COMPETENCIES as string[]).includes(value);

/**
 * The attempt's decisions, one record per log entry.
 *
 * BKT is replayed from the level entry's estimate over the run's logs in order,
 * with the update `buildBKTProfile` applies, so `bktAfter` of a competency's
 * last decision is what the next level entry will read for it.
 */
export const buildDecisionTelemetry = ({
  entry,
  logs,
  traces,
  rerolls,
  bkt = DEFAULT_BKT_PARAMS,
}: {
  entry: AttemptEntry;
  logs: readonly ActionLog[];
  traces: readonly DecisionTrace[];
  rerolls: readonly RerollTrace[];
  bkt?: BKTParams;
}): DecisionTelemetryDoc => {
  const mastery = { ...entry.policy.entryMastery };

  const decisions = logs.map((log, logIndex): DecisionRecord => {
    // One trace per log, written together; a missing one is recorded as
    // unknown rather than borrowed from a neighbour.
    const trace = traces[logIndex];
    const competency = isCompetency(log.competency) ? log.competency : null;
    let bktBefore: number | null = null;
    let bktAfter: number | null = null;
    if (competency) {
      bktBefore = mastery[competency];
      bktAfter = updateMastery(bktBefore, log.result === 'correct', bkt);
      mastery[competency] = bktAfter;
    }
    const approach = trace?.approach ?? null;

    return {
      logIndex,
      timestamp: log.timestamp,
      scenarioId: trace?.scenarioId ?? null,
      kind: trace?.kind ?? null,
      settlement: trace?.settlement ?? null,
      competency,
      result: log.result,
      points: log.points,
      remediation: log.remediation === true,
      support: log.support ?? null,
      theta: approach
        ? {
            requested: approach.requested,
            effective: approach.effective,
            baselineLead: approach.baselineLead,
            lead: approach.lead,
            room: finiteOrNull(approach.room),
            floor: finiteOrNull(approach.floor),
          }
        : null,
      reaction: log.reactionCensored
        ? { censored: true }
        : typeof log.reactionTime === 'number'
          ? { ms: log.reactionTime }
          : null,
      bktBefore,
      bktAfter,
    };
  });

  return {
    schemaVersion: DECISION_TELEMETRY_SCHEMA_VERSION,
    levelId: entry.levelId,
    attemptSeed: entry.attemptSeed,
    route: [...entry.route],
    bkt: { ...bkt },
    policy: entry.policy,
    rerolls: rerolls.map(reroll => ({ ...reroll })),
    decisions,
    truncated: false,
    totalCount: decisions.length,
  };
};

/**
 * A stored document, read back: the document when its schema is one this code
 * knows, and null otherwise - including for every attempt saved before this
 * existed, which has no such document at all. Those attempts still load; what
 * they recorded is in their inline `logs`.
 */
export const readDecisionTelemetry = (raw: unknown): DecisionTelemetryDoc | null =>
  typeof raw === 'object' &&
  raw !== null &&
  (raw as { schemaVersion?: unknown }).schemaVersion === DECISION_TELEMETRY_SCHEMA_VERSION
    ? (raw as DecisionTelemetryDoc)
    : null;
