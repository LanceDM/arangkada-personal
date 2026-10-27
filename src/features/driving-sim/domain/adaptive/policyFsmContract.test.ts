/**
 * Where the shared policy meets this feature's state machine.
 *
 * `domain/learner` owns the Q-learning policy and may not know Driving Sim, so
 * the assertions that the policy's `window` action is a legal `TransitionParams`
 * — and that reaction latency is read off the FSM's own log rather than a
 * second clock — belong on this side of the boundary. This is the thesis claim
 * the adaptive layer rests on, pinned end to end:
 *
 *   trained table -> QAction.window -> WINDOW_SCALE -> approachScale -> the guard
 */
import { describe, it, expect } from 'vitest';
import { WINDOWS, WINDOW_SCALE } from '@/domain/learner/adaptive/qLearningPolicy';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { reactionClockMs } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import {
  DEFAULT_TRANSITION_PARAMS,
  TRANSITION_PARAM_BOUNDS,
  type TransitionLogEntry,
} from '@/features/driving-sim/domain/fsm/fsmTypes';

describe('every window the policy can emit is a legal FSM parameter', () => {
  it('maps every window delta inside the FSM clamp bounds', () => {
    for (const window of WINDOWS) {
      const scale = WINDOW_SCALE[window];
      expect(scale).toBeGreaterThanOrEqual(TRANSITION_PARAM_BOUNDS.min);
      expect(scale).toBeLessThanOrEqual(TRANSITION_PARAM_BOUNDS.max);
    }
  });

  it('leaves the machine at baseline for the neutral window', () => {
    expect(WINDOW_SCALE[0]).toBe(1);
  });

  it('orders the windows: -1 narrows, +1 widens', () => {
    expect(WINDOW_SCALE[-1]).toBeLessThan(WINDOW_SCALE[0]);
    expect(WINDOW_SCALE[1]).toBeGreaterThan(WINDOW_SCALE[0]);
  });
});

describe('reaction time is read from the FSM log, not a second clock', () => {
  const entry = (to: TransitionLogEntry['to'], timestamp: number): TransitionLogEntry => ({
    from: 'DRIVING', to, trigger: 'red_light', timestamp,
    snapshot: { competency: 'unassigned', gameplay: to },
    params: DEFAULT_TRANSITION_PARAMS,
  });

  it('measures from the approach entry', () => {
    const log = [entry('APPROACHING_EVENT', 1000), entry('REACTION_WINDOW', 1200)];
    expect(reactionClockMs(log, 2500)).toBe(1500);
  });

  it('returns null when no approach preceded the decision', () => {
    expect(reactionClockMs([], 1000)).toBeNull();
    expect(reactionClockMs([entry('DECISION', 10)], 1000)).toBeNull();
  });

  it('reads a real approach off a real machine', () => {
    const fsm = new DrivingFSM();
    fsm.transition('start');
    fsm.updateContext({ distanceToEvent: 0, warningDistance: 140, reactionDistance: 10 });
    fsm.transition('red_light');
    const ms = reactionClockMs(fsm.getTransitionLog());
    expect(ms).not.toBeNull();
    expect(ms as number).toBeGreaterThanOrEqual(0);
  });
});
