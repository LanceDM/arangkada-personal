// Proves the S1 hook inversion preserved the driving loop's behaviour.
//
// `useDrivingSimulation` used to gate the FSM itself:
//
//     if (diff >= -actionZoneEnter && diff < actionZoneExit) {
//       if (activeZoneEventRef.current !== event) { ...; fsm.transition(event.type); }
//     }
//     ...
//     if (... && diff >= -10 && ...) { fsm.transition('scenario_trigger'); ... }
//
// Those two distance tests are now guards on the transitions themselves, and the
// loop reacts to `transition()`'s verdict instead of pre-deciding it. The risk in
// that swap is that the machine starts advancing at a different point than it
// used to. This replays the loop's exact per-frame call pattern over a swept
// distance and pins where each state change actually happens.
//
// It cannot run in the browser preview: the Browser pane suspends
// requestAnimationFrame while hidden, so the real loop never ticks there. This
// is the substitute, and it checks the thing that actually matters - the frame
// on which the FSM changes state - rather than what the canvas looked like.
import { describe, it, expect } from 'vitest';
import { DrivingFSM } from './DrivingFSM';
import { DEFAULT_TRANSITION_PARAMS, type TransitionParams } from './fsmTypes';
import type { EnvironmentTrigger, FSMState } from './fsmTypes';

const REACTION_COMMIT_LEAD = 10; // mirrors useDrivingSimulation.ts

interface SweepResult {
  approachEnteredAt: number | null;
  reactionEnteredAt: number | null;
  states: FSMState[];
}

/**
 * Replays the loop's per-frame calls for a single event, stepping the car in
 * one road unit at a time, and records the distance at which each state change
 * landed.
 */
const sweep = (options: {
  warningDistance: number;
  actionZoneExit: number;
  params?: TransitionParams;
  eventType?: EnvironmentTrigger;
}): SweepResult => {
  const { warningDistance, actionZoneExit, params = DEFAULT_TRANSITION_PARAMS, eventType = 'red_light' } = options;
  const fsm = new DrivingFSM();
  fsm.setTransitionParams(params);
  fsm.transition('start'); // the loop's first throttle tap -> DRIVING

  let active = false;
  let approachEnteredAt: number | null = null;
  let reactionEnteredAt: number | null = null;
  const states: FSMState[] = [];

  for (let diff = -400; diff < actionZoneExit; diff += 1) {
    // --- exactly what the loop does per frame, per event ---
    fsm.updateContext({
      distanceToEvent: diff,
      warningDistance,
      reactionDistance: REACTION_COMMIT_LEAD,
    });

    if (!active && diff < actionZoneExit && fsm.transition(eventType)) {
      active = true;
      if (approachEnteredAt === null) approachEnteredAt = diff;
    }

    if (active && fsm.getState() === 'APPROACHING_EVENT' && diff < actionZoneExit) {
      if (fsm.transition('scenario_trigger')) {
        fsm.transition(eventType);
        if (reactionEnteredAt === null) reactionEnteredAt = diff;
      }
    }
    // --- end loop body ---

  }

  // Taken from the transition log rather than by sampling `getState()` at frame
  // boundaries. REACTION_WINDOW is transient: `scenario_trigger` and the event
  // trigger both fire within a single frame, so a frame-boundary sample never
  // observes it - as was already true before the guards existed. The log is the
  // ground truth for the path actually walked.
  states.push(fsm.getTransitionLog()[0]?.from ?? fsm.getState());
  for (const entry of fsm.getTransitionLog()) states.push(entry.to);

  return { approachEnteredAt, reactionEnteredAt, states };
};

describe('driving loop still advances the machine where it always did', () => {
  it('enters APPROACHING_EVENT at exactly the old `diff >= -actionZoneEnter` threshold', () => {
    // The old code opened the approach on the first frame where
    // `diff >= -actionZoneEnter`. At the default theta the guard must agree.
    for (const warningDistance of [60, 100, 140, 220]) {
      const { approachEnteredAt } = sweep({ warningDistance, actionZoneExit: 60 });
      expect(approachEnteredAt).toBe(-warningDistance);
    }
  });

  it('opens REACTION_WINDOW at exactly the old `diff >= -10` threshold', () => {
    const { reactionEnteredAt } = sweep({ warningDistance: 140, actionZoneExit: 60 });
    expect(reactionEnteredAt).toBe(-REACTION_COMMIT_LEAD);
  });

  it('walks the same state sequence a real approach produced', () => {
    const { states } = sweep({ warningDistance: 140, actionZoneExit: 60 });
    expect(states).toEqual(['IDLE', 'DRIVING', 'APPROACHING_EVENT', 'REACTION_WINDOW', 'INTERSECTION']);
  });

  it('routes a hazard-type event to HAZARD rather than INTERSECTION', () => {
    const { states } = sweep({ warningDistance: 140, actionZoneExit: 60, eventType: 'pedestrian_crossing' });
    expect(states).toEqual(['IDLE', 'DRIVING', 'APPROACHING_EVENT', 'REACTION_WINDOW', 'HAZARD']);
  });

  it('fires each state change exactly once across the whole approach', () => {
    const { states } = sweep({ warningDistance: 140, actionZoneExit: 60 });
    // No state repeats: calling transition() every frame is idempotent, because
    // once the machine has left DRIVING the event trigger no longer matches.
    // This is what makes it safe for the loop to stop pre-gating the call.
    expect(new Set(states).size).toBe(states.length);
  });
});

describe('theta moves those points, which is the optimization', () => {
  it('opens the approach earlier or later in proportion to approachScale', () => {
    const at = (approachScale: number) =>
      sweep({ warningDistance: 140, actionZoneExit: 60, params: { approachScale, reactionScale: 1 } })
        .approachEnteredAt;

    expect(at(1)).toBe(-140);   // baseline
    expect(at(0.5)).toBe(-70);  // half the warning: less time to react
    expect(at(2)).toBe(-280);   // double: announced twice as early
  });

  it('moves the reaction window independently of the approach', () => {
    const result = sweep({
      warningDistance: 140,
      actionZoneExit: 60,
      params: { approachScale: 1, reactionScale: 2 },
    });
    expect(result.approachEnteredAt).toBe(-140); // unchanged
    expect(result.reactionEnteredAt).toBe(-20);  // doubled
  });

  it('reaches the same states under every theta - only the timing differs', () => {
    const baseline = sweep({ warningDistance: 140, actionZoneExit: 60 }).states;
    for (const approachScale of [0.5, 1, 1.5, 2]) {
      const { states } = sweep({
        warningDistance: 140,
        actionZoneExit: 60,
        params: { approachScale, reactionScale: 1 },
      });
      expect(states).toEqual(baseline);
    }
  });
});
