// Unit tests for computeFsmMetrics (domain/fsm/fsmMetrics.ts). No React, no
// canvas - pure function over a transitionLog, exercised both with a
// hand-built log (precise edge cases) and the real DrivingFSM (end-to-end,
// proving the answer_correct/answer_incorrect fix actually shows up here).
import { describe, it, expect } from 'vitest';
import { buildLevelFsmTelemetry, computeFsmMetrics, reactionClockMs, reactionLatenciesOf } from './fsmMetrics';
import type { ActionLog } from '@/domain/learner/attempt';
import { DrivingFSM } from './DrivingFSM';
import type { TransitionLogEntry, FSMSnapshot } from './fsmTypes';
import { DEFAULT_TRANSITION_PARAMS } from './fsmTypes';

const snapshot: FSMSnapshot = { competency: 'unassigned', gameplay: 'IDLE' };

const entry = (
  from: TransitionLogEntry['from'],
  trigger: string,
  to: TransitionLogEntry['to'],
  timestamp = 0
): TransitionLogEntry => ({
  from,
  to,
  trigger,
  timestamp,
  snapshot,
  params: DEFAULT_TRANSITION_PARAMS,
});

describe('computeFsmMetrics', () => {
  it('reports zeros and null accuracy for an empty log', () => {
    const metrics = computeFsmMetrics([]);
    expect(metrics.totalTransitions).toBe(0);
    expect(metrics.correctVerdicts).toBe(0);
    expect(metrics.incorrectVerdicts).toBe(0);
    expect(metrics.accuracy).toBeNull();
    expect(metrics.recoveryEntries).toBe(0);
    expect(metrics.crashes).toBe(0);
    expect(metrics.stateVisitCounts).toEqual({});
  });

  it('counts verdicts, accuracy, recoveries, crashes, and per-state visits', () => {
    const log: TransitionLogEntry[] = [
      entry('REACTION_WINDOW', 'answer_correct', 'REACTION_WINDOW'),
      entry('REACTION_WINDOW', 'road_clear', 'DRIVING'),
      entry('DRIVING', 'red_light', 'APPROACHING_EVENT'),
      entry('APPROACHING_EVENT', 'scenario_trigger', 'REACTION_WINDOW'),
      entry('REACTION_WINDOW', 'red_light', 'INTERSECTION'),
      entry('INTERSECTION', 'answer_incorrect', 'VIOLATION'),
      entry('VIOLATION', 'feedback_displayed', 'FEEDBACK_DISPLAYED'),
      entry('FEEDBACK_DISPLAYED', 'recovery_complete', 'RECOVERY'),
      entry('RECOVERY', 'road_clear', 'DRIVING'),
      entry('DRIVING', 'crash', 'GAME_OVER'),
    ];

    const metrics = computeFsmMetrics(log);
    expect(metrics.totalTransitions).toBe(10);
    expect(metrics.correctVerdicts).toBe(1);
    expect(metrics.incorrectVerdicts).toBe(1);
    expect(metrics.accuracy).toBe(0.5);
    expect(metrics.recoveryEntries).toBe(1);
    expect(metrics.crashes).toBe(1);
    expect(metrics.stateVisitCounts.DRIVING).toBe(2);
    expect(metrics.stateVisitCounts.VIOLATION).toBe(1);
  });

  it('reflects a real DrivingFSM run, including the DECISION path the trigger fix repaired', () => {
    const fsm = new DrivingFSM();
    fsm.transition('start');
    fsm.transition('speed_limit'); // -> APPROACHING_EVENT
    fsm.transition('scenario_trigger'); // -> REACTION_WINDOW
    fsm.transition('scenario_trigger'); // -> DECISION (cutscene)
    fsm.transition('answer_incorrect'); // -> VIOLATION
    fsm.transition('feedback_displayed');
    fsm.transition('recovery_complete');
    fsm.transition('road_clear');

    const metrics = computeFsmMetrics(fsm.getTransitionLog());
    expect(metrics.incorrectVerdicts).toBe(1);
    expect(metrics.correctVerdicts).toBe(0);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.recoveryEntries).toBe(1);
  });
});

/**
 * The reaction clock, and what the finished run keeps of it.
 *
 * The clock starts where the driving starts: at the release of the read phase,
 * or at the approach where there was none. The run keeps only the decisions
 * that were responses - a window that closed, a question answered, a tutorial
 * step have no reaction time.
 */
describe('the reaction clock', () => {
  it('runs from the approach when nothing was held to be read', () => {
    const log: TransitionLogEntry[] = [
      entry('DRIVING', 'red_light', 'APPROACHING_EVENT', 1_000),
      entry('APPROACHING_EVENT', 'scenario_trigger', 'REACTION_WINDOW', 1_200),
    ];
    expect(reactionClockMs(log, 2_500)).toBe(1_500);
  });

  it('runs from the release of the read phase, so reading is never in it', () => {
    const log: TransitionLogEntry[] = [
      entry('DRIVING', 'red_light', 'APPROACHING_EVENT', 1_000),
      entry('APPROACHING_EVENT', 'briefing_dismissed', 'APPROACHING_EVENT', 9_000),
    ];
    expect(reactionClockMs(log, 9_600)).toBe(600);
  });

  it('is not restarted by the machine re-entering the approach after the car came to rest', () => {
    // Coming to rest mid-approach returns the machine to IDLE; closing the
    // decision walks it back through APPROACHING_EVENT on the way to the
    // verdict. Measured from that entry, a correct stop was timed at nothing.
    const withoutRead: TransitionLogEntry[] = [
      entry('DRIVING', 'stop_sign', 'APPROACHING_EVENT', 1_000),
      entry('APPROACHING_EVENT', 'vehicle_stopped', 'IDLE', 2_000),
      entry('IDLE', 'accelerate', 'DRIVING', 3_000),
      entry('DRIVING', 'stop_sign', 'APPROACHING_EVENT', 4_000),
    ];
    expect(reactionClockMs(withoutRead, 4_000)).toBe(3_000);

    const afterRead: TransitionLogEntry[] = [
      entry('DRIVING', 'stop_sign', 'APPROACHING_EVENT', 1_000),
      entry('APPROACHING_EVENT', 'briefing_dismissed', 'APPROACHING_EVENT', 1_500),
      entry('APPROACHING_EVENT', 'vehicle_stopped', 'IDLE', 2_000),
      entry('IDLE', 'accelerate', 'DRIVING', 3_000),
      entry('DRIVING', 'stop_sign', 'APPROACHING_EVENT', 4_000),
    ];
    expect(reactionClockMs(afterRead, 4_000)).toBe(2_500);
  });

  it("belongs to the event being graded, not the one before it", () => {
    const log: TransitionLogEntry[] = [
      entry('DRIVING', 'red_light', 'APPROACHING_EVENT', 100),
      entry('APPROACHING_EVENT', 'briefing_dismissed', 'APPROACHING_EVENT', 200),
      entry('REACTION_WINDOW', 'answer_correct', 'REACTION_WINDOW', 500),
      entry('DRIVING', 'stop_sign', 'APPROACHING_EVENT', 2_000),
    ];
    expect(reactionClockMs(log, 2_600)).toBe(600);
  });

  it('has not started when no approach preceded the decision', () => {
    expect(reactionClockMs([], 1_000)).toBeNull();
    expect(reactionClockMs([entry('DECISION', 'answer_correct', 'DECISION', 10)], 1_000)).toBeNull();
    // Everything before the previous verdict belongs to an earlier event.
    expect(
      reactionClockMs(
        [entry('DRIVING', 'red_light', 'APPROACHING_EVENT', 10), entry('REACTION_WINDOW', 'answer_correct', 'REACTION_WINDOW', 20)],
        1_000
      )
    ).toBeNull();
  });
});

describe('what a finished run keeps of it', () => {
  const log = (result: ActionLog['result'], extra: Partial<ActionLog> = {}): ActionLog => ({
    timestamp: 0,
    action: 'brake',
    result,
    points: 0,
    ...extra,
  });

  it('keeps the timed responses, and nothing a window closed on or a question answered', () => {
    const logs = [
      log('correct', { reactionTime: 900 }),
      log('violation', { reactionCensored: true }),
      log('correct'),
      log('violation', { reactionTime: 1_400 }),
    ];
    const params = { approachScale: 1.5, reactionScale: 1 };
    expect(reactionLatenciesOf(logs, params)).toEqual([
      { ms: 900, correct: true, approachScale: 1.5 },
      { ms: 1_400, correct: false, approachScale: 1.5 },
    ]);
  });

  it('attributes them to the theta the machine was run at', () => {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams({ approachScale: 0.75, reactionScale: 1 });
    fsm.transition('start');
    const telemetry = buildLevelFsmTelemetry(fsm.getTransitionLog(), [log('correct', { reactionTime: 700 })], [], []);
    expect(telemetry.reactionLatencies).toEqual([{ ms: 700, correct: true, approachScale: 0.75 }]);
    expect(telemetry.transitions).toEqual(fsm.getTransitionLog());
  });
});
