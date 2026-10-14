import { describe, it, expect } from 'vitest';
import { createRng } from '@/shared/lib/rng';
import { RoutingFSM } from './RoutingFSM';
import { ROUTING_ALPHABET, driveState, stateId, transitionId } from './routingTypes';
import type { RoutingTransition } from './routingTypes';
import { OUTCOMES, PROBE_NAMES, probeContext } from './characterizeRouting';

const ADVANCE: RoutingTransition = { kind: 'advance', practice: null };

describe('RoutingFSM', () => {
  it('starts at the tutorial with an empty log, or at the frontier it is given', () => {
    const fresh = new RoutingFSM();
    expect(stateId(fresh.getState())).toBe('DRIVE(0)');
    expect(fresh.getTransitionLog()).toEqual([]);
    expect(stateId(new RoutingFSM(driveState(7)).getState())).toBe('DRIVE(7)');
    expect(stateId(new RoutingFSM({ kind: 'FINAL' }).getState())).toBe('FINAL');
  });

  it('takes a legal transition and logs it beside everything that was legal', () => {
    const machine = new RoutingFSM(driveState(4));
    const context = probeContext('mixed', 'passed');
    const legal = machine.legalTransitions(context).map(move => transitionId(move.transition));

    expect(machine.take({ kind: 'advance', practice: 'road_signs' }, context)).toBe(true);
    expect(stateId(machine.getState())).toBe('DRIVE(5)');
    expect(machine.getTransitionLog()).toEqual([
      {
        seq: 0,
        from: driveState(4),
        to: driveState(5),
        transition: { kind: 'advance', practice: 'road_signs' },
        outcome: 'passed',
        legal,
      },
    ]);
  });

  it('refuses an illegal transition and changes neither the state nor the log', () => {
    const machine = new RoutingFSM(driveState(4));
    machine.take(ADVANCE, probeContext('none', 'passed'));
    const before = machine.getTransitionLog();

    expect(machine.take(ADVANCE, probeContext('none', 'failed'))).toBe(false);
    expect(machine.take({ kind: 'advance', practice: 'right_of_way' }, probeContext('mixed', 'passed'))).toBe(false);
    expect(machine.take({ kind: 'certify' }, probeContext('open', 'passed'))).toBe(false);
    expect(stateId(machine.getState())).toBe('DRIVE(5)');
    expect(machine.getTransitionLog()).toEqual(before);
  });

  it('hands out a copy of its log, which only ever grows', () => {
    const machine = new RoutingFSM();
    machine.take(ADVANCE, probeContext('none', 'passed'));
    const copy = machine.getTransitionLog();
    copy.pop();
    expect(machine.getTransitionLog()).toHaveLength(1);

    machine.take(ADVANCE, probeContext('none', 'passed'));
    expect(machine.getTransitionLog().map(entry => entry.seq)).toEqual([0, 1]);
  });

  it('walks the conventional route to CERTIFIED in 13 transitions, and no further', () => {
    const machine = new RoutingFSM();
    const passed = probeContext('none', 'passed');
    for (let level = 0; level < 11; level += 1) expect(machine.take(ADVANCE, passed)).toBe(true);
    expect(machine.take({ kind: 'to_final' }, passed)).toBe(true);
    expect(machine.take({ kind: 'certify' }, passed)).toBe(true);

    expect(stateId(machine.getState())).toBe('CERTIFIED');
    expect(machine.getTransitionLog()).toHaveLength(13);
    for (const outcome of OUTCOMES) {
      for (const probe of PROBE_NAMES) expect(machine.legalTransitions(probeContext(probe, outcome))).toEqual([]);
    }
  });

  it('logs a chain of listed transitions only, however it is driven', () => {
    const rng = createRng(20260929);
    for (let course = 0; course < 50; course += 1) {
      const machine = new RoutingFSM();
      for (let request = 0; request < 200 && machine.getState().kind !== 'CERTIFIED'; request += 1) {
        const context = probeContext(
          PROBE_NAMES[Math.floor(rng() * PROBE_NAMES.length)],
          OUTCOMES[Math.floor(rng() * OUTCOMES.length)]
        );
        const legal = machine.legalTransitions(context);
        // Mostly a legal move, sometimes any label at all, as a careless policy would ask.
        const transition =
          rng() < 0.8
            ? legal[Math.floor(rng() * legal.length)].transition
            : ROUTING_ALPHABET[Math.floor(rng() * ROUTING_ALPHABET.length)];
        machine.take(transition, context);
      }
      const log = machine.getTransitionLog();
      log.forEach((entry, index) => {
        expect(entry.seq).toBe(index);
        expect(entry.legal).toContain(transitionId(entry.transition));
        if (index > 0) expect(entry.from).toEqual(log[index - 1].to);
      });
      if (log.length > 0) expect(log.at(-1)!.to).toEqual(machine.getState());
    }
  });
});
