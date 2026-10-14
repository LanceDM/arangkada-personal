// Tests for the theta-parameterized transition guards - the S1 mechanism.
//
// These assert the properties the thesis claim rests on:
//   1. theta acts on real transitions in the table, not on content or on a
//      wrapper around the machine.
//   2. theta only moves *when* an edge fires. It cannot add, remove, or
//      redirect one, so the reachability graph of M(theta) is invariant.
//   3. theta is bounded, and safety-critical edges are never gated.
//   4. M(default) is the baseline machine, so the optimized/baseline
//      comparison differs in exactly one variable.
import { describe, it, expect } from 'vitest';
import { DrivingFSM } from './DrivingFSM';
import { DEFAULT_TRANSITION_PARAMS, TRANSITION_PARAM_BOUNDS, clampTransitionParams, type TransitionParams, } from './fsmTypes';
import { ALL_STATES, ALL_TRIGGERS } from './characterize';

/** Drives a fresh machine to DRIVING and reports where the approach guard opens. */
const approachOpensAt = (params: TransitionParams, warningDistance: number): number | null => {
  for (let distance = -500; distance <= 0; distance += 1) {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams(params);
    fsm.transition('start');
    fsm.updateContext({ distanceToEvent: distance, warningDistance, reactionDistance: 10 });
    if (fsm.transition('red_light')) return distance;
  }
  return null;
};

describe('theta acts on the transition relation', () => {
  it('gates a real edge in the table, not a wrapper around it', () => {
    const guarded = new DrivingFSM()
      .getTransitionTable()
      .filter(t => t.condition);
    expect(guarded.length).toBeGreaterThan(0);
    // Every guarded edge is one of the two the optimization targets.
    for (const t of guarded) {
      expect([
        'APPROACHING_EVENT->REACTION_WINDOW',
        'DRIVING->APPROACHING_EVENT',
        'IDLE->APPROACHING_EVENT',
      ]).toContain(`${t.from}->${t.to}`);
    }
  });

  it('moves the firing point in proportion to the scale', () => {
    expect(approachOpensAt({ approachScale: 0.5, reactionScale: 1 }, 100)).toBe(-50);
    expect(approachOpensAt({ approachScale: 1, reactionScale: 1 }, 100)).toBe(-100);
    expect(approachOpensAt({ approachScale: 2, reactionScale: 1 }, 100)).toBe(-200);
  });

  it('is monotonic: a larger scale never fires later', () => {
    const points = [0.5, 1, 1.5, 2].map(s => approachOpensAt({ approachScale: s, reactionScale: 1 }, 80)!);
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i]).toBeLessThan(points[i - 1]);
    }
  });

  it('reproduces the hand-tuned threshold at the default, so M(default) is the baseline', () => {
    expect(DEFAULT_TRANSITION_PARAMS).toEqual({ approachScale: 1, reactionScale: 1 });
    // At scale 1 the guard opens exactly at the authored warning distance.
    expect(approachOpensAt(DEFAULT_TRANSITION_PARAMS, 140)).toBe(-140);
    expect(approachOpensAt(DEFAULT_TRANSITION_PARAMS, 60)).toBe(-60);
  });
});

describe('theta is held between the floor and the room the world reports', () => {
  /** Where the approach guard opens under these limits, walking in a unit at a time. */
  const opensWithin = (
    approachScale: number,
    limits: { approachFloor: number; approachRoom: number },
    warningDistance = 100
  ): number | null => {
    for (let distance = -500; distance <= 0; distance += 1) {
      const fsm = new DrivingFSM();
      fsm.setTransitionParams({ approachScale, reactionScale: 1 });
      fsm.transition('start');
      fsm.updateContext({ distanceToEvent: distance, warningDistance, reactionDistance: 10, ...limits });
      if (fsm.transition('red_light')) return distance;
    }
    return null;
  };

  it('widens no further than the room back to the previous event', () => {
    expect(opensWithin(2, { approachFloor: 0, approachRoom: 150 })).toBe(-150);
    expect(opensWithin(1.5, { approachFloor: 0, approachRoom: 150 })).toBe(-150);
    expect(opensWithin(1.2, { approachFloor: 0, approachRoom: 150 })).toBe(-120);
  });

  it('narrows no further than the floor', () => {
    expect(opensWithin(0.5, { approachFloor: 80, approachRoom: Infinity })).toBe(-80);
    expect(opensWithin(0.75, { approachFloor: 80, approachRoom: Infinity })).toBe(-80);
    expect(opensWithin(0.9, { approachFloor: 80, approachRoom: Infinity })).toBe(-90);
  });

  it('does not narrow at all an approach whose floor is infinite, and still widens it', () => {
    expect(opensWithin(0.5, { approachFloor: Infinity, approachRoom: Infinity })).toBe(-100);
    expect(opensWithin(2, { approachFloor: Infinity, approachRoom: Infinity })).toBe(-200);
  });

  it('opens at the baseline at theta 1, whatever the limits say', () => {
    for (const approachFloor of [0, 80, 100, 120, Infinity]) {
      for (const approachRoom of [0, 60, 100, 150, Infinity]) {
        expect(opensWithin(1, { approachFloor, approachRoom })).toBe(-100);
      }
    }
  });

  it('leaves a baseline that is already outside both limits exactly where it is', () => {
    // No room to widen and no road to spare: theta has nothing to move.
    for (const scale of [0.5, 0.75, 1, 1.5, 2]) {
      expect(opensWithin(scale, { approachFloor: 120, approachRoom: 60 })).toBe(-100);
    }
  });

  it('never opens later for a larger theta, under any limits', () => {
    const scales = [0.5, 0.6, 0.75, 0.9, 1, 1.2, 1.5, 1.8, 2];
    for (const approachFloor of [0, 40, 80, 120, Infinity]) {
      for (const approachRoom of [0, 60, 150, 250, Infinity]) {
        const points = scales.map(scale => opensWithin(scale, { approachFloor, approachRoom })!);
        for (let i = 1; i < points.length; i += 1) expect(points[i]).toBeLessThanOrEqual(points[i - 1]);
      }
    }
  });
});

describe('theta is bounded and cannot corrupt the machine', () => {
  it('clamps out-of-range and non-finite values', () => {
    const { min, max } = TRANSITION_PARAM_BOUNDS;
    expect(clampTransitionParams({ approachScale: 0, reactionScale: -3 }))
      .toEqual({ approachScale: min, reactionScale: min });
    expect(clampTransitionParams({ approachScale: 99, reactionScale: 1e9 }))
      .toEqual({ approachScale: max, reactionScale: max });
    // Non-finite input falls back to the neutral default rather than to a
    // bound: NaN/Infinity means something upstream is broken, and quietly
    // applying the most extreme setting would be the worse failure mode.
    expect(clampTransitionParams({ approachScale: Number.NaN, reactionScale: Number.POSITIVE_INFINITY }))
      .toEqual({ approachScale: 1, reactionScale: 1 });
  });

  it('clamps at the setter, so the bound belongs to the machine not the caller', () => {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams({ approachScale: 1000, reactionScale: -1000 });
    expect(fsm.getTransitionParams()).toEqual({
      approachScale: TRANSITION_PARAM_BOUNDS.max,
      reactionScale: TRANSITION_PARAM_BOUNDS.min,
    });
  });

  /**
   * The core safety argument: guards only delay or advance an existing edge.
   * Whatever theta is, the same states are reachable by the same triggers - so a
   * learned policy cannot drive the machine somewhere the hand-designed graph
   * does not already allow.
   */
  it('leaves the reachability graph invariant under theta', () => {
    const reachableUnder = (params: TransitionParams) => {
      const start = new DrivingFSM().getState();
      const paths = new Map<string, string[]>([[start, []]]);
      const queue = [start];
      while (queue.length > 0) {
        const state = queue.shift()!;
        const path = paths.get(state)!;
        for (const trigger of ALL_TRIGGERS) {
          const fsm = new DrivingFSM();
          fsm.setTransitionParams(params);
          // Permissive context: at the event, so every guard is satisfiable.
          fsm.updateContext({ distanceToEvent: 0, warningDistance: 100, reactionDistance: 10 });
          for (const step of path) fsm.transition(step as never);
          if (!fsm.transition(trigger)) continue;
          const next = fsm.getState();
          if (paths.has(next)) continue;
          paths.set(next, [...path, trigger]);
          queue.push(next);
        }
      }
      return [...paths.keys()].sort();
    };

    const baseline = reachableUnder(DEFAULT_TRANSITION_PARAMS);
    expect(reachableUnder({ approachScale: 0.5, reactionScale: 0.5 })).toEqual(baseline);
    expect(reachableUnder({ approachScale: 2, reactionScale: 2 })).toEqual(baseline);
    // And it is the whole declared state set - nothing became unreachable.
    expect(baseline).toEqual([...ALL_STATES].sort());
  });
});

describe('safety-critical transitions are never gated', () => {
  it.each([
    ['DRIVING', 'crash'],
    ['DRIVING', 'level_end'],
    ['DRIVING', 'vehicle_stopped'],
    ['REACTION_WINDOW', 'answer_incorrect'],
    ['INTERSECTION', 'answer_incorrect'],
    ['HAZARD', 'answer_incorrect'],
    ['DECISION', 'answer_incorrect'],
  ])('%s --%s--> is unconditional', (from, trigger) => {
    const edge = new DrivingFSM()
      .getTransitionTable()
      .find(t => t.from === from && t.trigger === trigger);
    expect(edge).toBeDefined();
    expect(edge!.condition).toBeUndefined();
  });

  it('ends a run regardless of how hostile theta and the context are', () => {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams({ approachScale: 0.5, reactionScale: 0.5 });
    fsm.transition('start');
    // Context that fails every guard: the event is far away.
    fsm.updateContext({ distanceToEvent: -9999, warningDistance: 1, reactionDistance: 1 });
    expect(fsm.transition('red_light')).toBe(false); // guard correctly declines
    expect(fsm.transition('crash')).toBe(true);      // safety edge still fires
    expect(fsm.getState()).toBe('GAME_OVER');
  });
});

describe('theta is recorded for evaluation', () => {
  it('stamps the active params on every logged transition', () => {
    const fsm = new DrivingFSM();
    fsm.setTransitionParams({ approachScale: 1.5, reactionScale: 0.5 });
    fsm.transition('start');
    const [entry] = fsm.getTransitionLog();
    expect(entry.params).toEqual({ approachScale: 1.5, reactionScale: 0.5 });
  });
});
