// Pure summary statistics over a DrivingFSM's transitionLog - the thesis
// analytics record. This is deliberately a stateless function over whatever
// log is already in memory, not a new persistence/telemetry pipeline: it
// answers "what did this FSM instance actually do", nothing more.
//
// Only meaningful since the answer_correct/answer_incorrect trigger fix -
// before that, an incorrect DECISION-state answer (a right-of-way/parking/
// emergency cutscene) left no trace here at all, so `incorrectVerdicts` would
// have undercounted every wrong cutscene answer.
import type { ActionLog } from '@/domain/learner/attempt';
import { DEFAULT_TRANSITION_PARAMS, type FSMState, type TransitionLogEntry, type TransitionParams } from './fsmTypes';
import type { DecisionTrace, RerollTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { ControlInput } from '@/features/driving-sim/domain/telemetry/controlInputs';

export interface FsmMetrics {
  totalTransitions: number;
  /** `answer_correct` triggers fired - see EvaluationOutcome in types.ts. */
  correctVerdicts: number;
  /** `answer_incorrect` triggers fired; each one also enters VIOLATION exactly once. */
  incorrectVerdicts: number;
  /** correctVerdicts / (correct + incorrect), or null if nothing has been graded yet. */
  accuracy: number | null;
  /** Times FEEDBACK_DISPLAYED resolved into RECOVERY after a violation. */
  recoveryEntries: number;
  /** `crash` triggers fired - a run ending in a collision. */
  crashes: number;
  /** How many times each gameplay state was entered (by `to`), across the whole log. */
  stateVisitCounts: Partial<Record<FSMState, number>>;
}

/**
 * One timed response: how long the driver took to answer a scenario that asked
 * for a response, from the start of the reaction clock (`reactionClockMs`) to
 * the moment their own act settled it.
 *
 * This is the observable the theta optimization is supposed to move - a wider
 * approach should buy the learner more time - so it is the primary outcome
 * measure for comparing M(theta) against the baseline machine. Decisions the
 * window closed on, questions and tutorial steps have no reaction time and do
 * not appear (see `observeReaction`).
 */
export interface ReactionLatency {
  /** Milliseconds from the start of the reaction clock to the response. */
  ms: number;
  correct: boolean;
  /** The approachScale in force, so latency can be attributed to the theta that produced it. */
  approachScale: number;
}

/**
 * The run's timed responses, read from the decisions it logged.
 *
 * Read from the `ActionLog`s rather than by pairing verdicts with approaches in
 * the transition log: the log cannot say which verdicts were responses and
 * which were windows closing, and pairing every one timed them all. The time
 * itself was still read off the transition log, at grading, by
 * `reactionClockMs`.
 */
export const reactionLatenciesOf = (
  logs: readonly ActionLog[],
  params: TransitionParams
): ReactionLatency[] =>
  logs
    .filter(log => typeof log.reactionTime === 'number')
    .map(log => ({
      ms: log.reactionTime as number,
      correct: log.result === 'correct',
      approachScale: params.approachScale,
    }));

/**
 * The reaction clock for the event being graded: milliseconds since it started,
 * or null when nothing started it. Called at grading time, before the verdict
 * is fired, so everything since the previous verdict belongs to this event.
 *
 * It starts at the most recent release of the read phase (`briefing_dismissed`),
 * so the time spent reading is never in it. Where there was no read
 * phase it starts at the first entry into APPROACHING_EVENT since the previous
 * verdict - the first, not the latest. A car that comes to rest mid-approach
 * returns the machine to IDLE, and closing the decision re-enters
 * APPROACHING_EVENT on the way to the verdict (`advanceToVerdict`); measured
 * from that entry, the correct response to a stop sign was timed at nothing.
 */
export const reactionClockMs = (
  log: readonly TransitionLogEntry[],
  now = Date.now()
): number | null => {
  let start: number | null = null;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    if (entry.trigger === 'answer_correct' || entry.trigger === 'answer_incorrect') break;
    if (entry.to !== 'APPROACHING_EVENT') continue;
    if (entry.trigger === 'briefing_dismissed') return now - entry.timestamp;
    start = entry.timestamp;
  }
  return start === null ? null : now - start;
};

/** Counts over the whole log: verdicts, accuracy, recoveries, crashes and state visits. */
export const computeFsmMetrics = (log: readonly TransitionLogEntry[]): FsmMetrics => {
  const stateVisitCounts: Partial<Record<FSMState, number>> = {};
  let correctVerdicts = 0;
  let incorrectVerdicts = 0;
  let recoveryEntries = 0;
  let crashes = 0;

  for (const entry of log) {
    stateVisitCounts[entry.to] = (stateVisitCounts[entry.to] ?? 0) + 1;
    if (entry.trigger === 'answer_correct') correctVerdicts += 1;
    if (entry.trigger === 'answer_incorrect') incorrectVerdicts += 1;
    if (entry.trigger === 'recovery_complete') recoveryEntries += 1;
    if (entry.trigger === 'crash') crashes += 1;
  }

  const graded = correctVerdicts + incorrectVerdicts;

  return {
    totalTransitions: log.length,
    correctVerdicts,
    incorrectVerdicts,
    accuracy: graded > 0 ? correctVerdicts / graded : null,
    recoveryEntries,
    crashes,
    stateVisitCounts,
  };
};

/**
 * Everything worth carrying out of a finished drive's FSM: the compact summary,
 * the timed responses, the raw transition log, and what each decision was.
 *
 * Bundled so a run can hand its telemetry to the persistence layer in one
 * object. The summary and latencies are small and are stored inline on the
 * attempt; the raw `transitions` are large (dominated by per-frame brake
 * self-loops) and go to the attempt's telemetry subdocument instead - see
 * FirebaseStoryAttemptRepository. `decisions` and `rerolls` become the
 * per-decision record, in a subdocument of its own.
 */
export interface LevelFsmTelemetry {
  metrics: FsmMetrics;
  reactionLatencies: ReactionLatency[];
  transitions: TransitionLogEntry[];
  /** One per entry of the run's logs, in the same order: what the log entry does not carry. */
  decisions: DecisionTrace[];
  rerolls: RerollTrace[];
  /** Every key pressed and released on the road (domain/telemetry/controlInputs). */
  inputs?: ControlInput[];
}

/**
 * `logs` are the run's graded decisions, whose timed responses become
 * `reactionLatencies`; theta is read off the log, which stamps it on every entry
 * and is set once per level entry. `decisions` are the traces kept beside those
 * logs, one per entry.
 */
export const buildLevelFsmTelemetry = (
  log: readonly TransitionLogEntry[],
  logs: readonly ActionLog[],
  decisions: readonly DecisionTrace[],
  rerolls: readonly RerollTrace[]
): LevelFsmTelemetry => ({
  metrics: computeFsmMetrics(log),
  reactionLatencies: reactionLatenciesOf(logs, log[0]?.params ?? DEFAULT_TRANSITION_PARAMS),
  transitions: [...log],
  decisions: [...decisions],
  rerolls: [...rerolls],
});
