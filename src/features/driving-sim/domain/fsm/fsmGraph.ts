// The driving FSM's structure as a graph: its states, and one edge per
// (from, to) pair with every trigger that takes it. Read from the machine's own
// table, so a drawing of the machine cannot drift from its definition. A reader
// only: it builds a scratch machine and never drives it.
import { DrivingFSM } from './DrivingFSM';
import { ALL_STATES, ALL_USER_ACTIONS } from './characterize';
import type { FSMState } from './fsmTypes';

export interface FsmGraphEdge {
  from: FSMState;
  to: FSMState;
  /** Every trigger that takes this edge, in table order. */
  triggers: string[];
}

export interface FsmGraph {
  states: readonly FSMState[];
  edges: FsmGraphEdge[];
}

export const drivingFsmGraph = (): FsmGraph => {
  const edges = new Map<string, FsmGraphEdge>();
  for (const { from, to, trigger } of new DrivingFSM().getTransitionTable()) {
    const key = `${from}>${to}`;
    const edge = edges.get(key) ?? { from, to, triggers: [] };
    if (!edge.triggers.includes(trigger)) edge.triggers.push(trigger);
    edges.set(key, edge);
  }
  return { states: ALL_STATES, edges: [...edges.values()] };
};

/**
 * A player input (`brake`, `accelerate`, a turn, `stop`): the half of the
 * alphabet the host fires from the controls, `brake` on every frame it is held.
 */
export const isInputTrigger = (trigger: string): boolean => (ALL_USER_ACTIONS as readonly string[]).includes(trigger);
