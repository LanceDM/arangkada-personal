import { describe, it, expect } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { advanceToDecision } from './fsmBridge';

/** A machine put into DRIVING, ready to receive an event trigger. */
const drivingFsm = () => {
  const fsm = new DrivingFSM();
  fsm.transition('start'); // IDLE -> DRIVING
  return fsm;
};

describe('advanceToDecision', () => {
  it('walks APPROACHING_EVENT -> REACTION_WINDOW -> DECISION in two edges', () => {
    const fsm = drivingFsm();
    fsm.transition('red_light'); // DRIVING -> APPROACHING_EVENT (default ctx satisfies the guard)
    expect(fsm.getState()).toBe('APPROACHING_EVENT');
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');
  });

  it('reaches DECISION in a single edge from REACTION_WINDOW', () => {
    const fsm = drivingFsm();
    fsm.transition('red_light');
    fsm.transition('scenario_trigger'); // -> REACTION_WINDOW
    expect(fsm.getState()).toBe('REACTION_WINDOW');
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');
  });

  it('reaches DECISION from INTERSECTION', () => {
    const fsm = drivingFsm();
    fsm.transition('red_light');
    fsm.transition('scenario_trigger'); // REACTION_WINDOW
    fsm.transition('red_light'); // -> INTERSECTION
    expect(fsm.getState()).toBe('INTERSECTION');
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');
  });

  it('reaches DECISION from HAZARD', () => {
    const fsm = drivingFsm();
    fsm.transition('red_light');
    fsm.transition('scenario_trigger'); // REACTION_WINDOW
    fsm.transition('pedestrian_crossing'); // -> HAZARD
    expect(fsm.getState()).toBe('HAZARD');
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');
  });

  it('is idempotent once in DECISION (records no further transitions)', () => {
    const fsm = drivingFsm();
    fsm.transition('red_light');
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');

    const logLenBefore = fsm.getTransitionLog().length;
    advanceToDecision(fsm);
    expect(fsm.getState()).toBe('DECISION');
    expect(fsm.getTransitionLog().length).toBe(logLenBefore);
  });
});
