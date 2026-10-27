// Equivalence verification for DrivingFSM structural changes.
//
// Re-derives the full behavioural characterization (characterize.ts) and diffs
// it against the committed golden file. The sections are asserted separately on
// purpose, because they carry different intent:
//
//   core / operations / scenarios  - the machine's semantics. A diff here means
//                                    a structural change altered behaviour:
//                                    a regression, and the test fails.
//   annotations / structure        - what the cleanup intends to change. These
//                                    are still asserted (so a change is never
//                                    silent) but a failure here is a prompt to
//                                    review the diff and re-run
//                                    `npm run fsm:characterize`, not a bug.
//
// Regenerate with: npm run fsm:characterize
import { describe, it, expect } from 'vitest';
import { characterizeFsm, ALL_STATES, ALL_TRIGGERS } from './characterize';
import { DrivingFSM } from './DrivingFSM';
import type { Characterization } from './characterize';
// Imported rather than read from disk: this file is compiled by
// tsconfig.app.json, which has no node types, so `fs` is unavailable here.
// Regenerate the file with `npm run fsm:characterize`.
import goldenJson from './characterization.golden.json';

const golden = goldenJson as unknown as Characterization;
const current = characterizeFsm();

describe('DrivingFSM semantics are unchanged', () => {
  it('preserves the transition function for every reachable state and trigger', () => {
    expect(current.core).toEqual(golden.core);
  });

  it('preserves the behaviour of state changes made outside transition()', () => {
    expect(current.operations).toEqual(golden.operations);
  });

  it('preserves end-to-end drive sequences', () => {
    expect(current.scenarios).toEqual(golden.scenarios);
  });
});

describe('DrivingFSM structure', () => {
  // Not a semantics check - this fails when the machine is deliberately
  // minimized, and the diff is the minimization result.
  it('matches the recorded structure (regenerate the golden after an intended change)', () => {
    expect(current.structure).toEqual(golden.structure);
  });

  // Minimization targets, written up front so each cleanup has a definition of
  // done. All structural defects found in the baseline machine are now cleared:
  // PAUSE (unreachable state), `honk` (alphabet symbol with no transition), and
  // the two shadowed `stop` edges. These stay as permanent regression guards.
  it('has no state that is declared but unreachable', () => {
    expect(current.structure.unreachableStates).toEqual([]);
  });

  it('has no trigger in the alphabet without any transition', () => {
    expect(current.structure.triggersWithNoTransitions).toEqual([]);
  });

  it('has no transition shadowed by an earlier entry for the same (from, trigger)', () => {
    expect(current.structure.shadowedTransitions).toEqual([]);
  });

  it('has no transition from an unreachable state', () => {
    expect(current.structure.unreachableTransitions).toEqual([]);
  });

  /**
   * With shadowing gone, every declared transition is reachable as exactly one
   * accepted (state, trigger) cell - i.e. the transition relation is a proper
   * partial function, with no `(from, trigger)` pair mapping to two targets.
   * This is the invariant that makes `.find()` resolution order irrelevant, so
   * a future edit can't silently reintroduce a shadowed edge.
   */
  it('declares no duplicate (from, trigger) pair: delta is a partial function', () => {
    const accepted = current.core.filter(row => row.accepted).length;
    expect(accepted).toBe(current.structure.transitionCount);
  });
});

describe('every state change goes through the transition table', () => {
  /**
   * The invariant the `markVehicleStopped` cleanup established: no method may
   * mutate `currentState` without a declared transition backing it. Any log
   * entry produced by a non-`transition()` operation must correspond to a real
   * (from, trigger) -> to edge in the table. This is what makes the table the
   * single definition of the machine - and therefore what makes "the optimized
   * transition relation governs every state change" a true statement rather
   * than an approximate one.
   */
  it('backs every operation-produced log entry with a declared transition', () => {
    const table = new DrivingFSM().getTransitionTable();
    const orphans = current.operations.flatMap(row =>
      row.logAppended
        .filter(entry => !table.some(t => t.from === entry.from && t.trigger === entry.trigger && t.to === entry.to))
        .map(entry => `${row.operation}: ${entry.from} --${entry.trigger}--> ${entry.to}`)
    );
    expect(orphans).toEqual([]);
  });
});

describe('characterization coverage', () => {
  it('probes every reachable state against the entire alphabet', () => {
    const reachable = current.structure.reachableStates.length;
    expect(current.core).toHaveLength(reachable * ALL_TRIGGERS.length);
  });

  it('accounts for every declared state as either reachable or unreachable', () => {
    const accounted = [
      ...current.structure.reachableStates,
      ...current.structure.unreachableStates,
    ].sort();
    expect(accounted).toEqual([...ALL_STATES].sort());
  });

  it('is deterministic across runs', () => {
    expect(characterizeFsm()).toEqual(current);
  });
});
