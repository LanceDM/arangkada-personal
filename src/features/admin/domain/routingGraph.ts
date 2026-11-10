/**
 * The routing FSM as a graph, read from its own table: every move any row
 * offers, from every state, under the four synthetic contexts the machine's
 * characterization probes it with. Together those contexts make every label
 * legal somewhere, so the graph holds every move the table can ever list.
 *
 * Nothing here is typed by hand. The states, the rows and their guards, the
 * labels and where each leads are the machine's; this only groups the 80
 * states into the control states a diagram draws (a review without its return
 * point), and keeps a lookup of each label's target, which depends on the
 * state and the label alone.
 */
import { OUTCOMES, PROBE_NAMES, probeContext } from '@/domain/routing/characterizeRouting';
import { ROUTING_TABLE } from '@/domain/routing/routingTable';
import {
  FINAL_EXAM_LEVEL,
  ROUTING_ALPHABET,
  ROUTING_STATES,
  controlStateId,
  stateId,
  transitionId,
  type RoutingMove,
  type RoutingState,
  type RoutingTransition,
} from '@/domain/routing/routingTypes';

export type StopKind = RoutingState['kind'];

/** A control state: one stop on the diagram. */
export interface RoutingStop {
  /** `DRIVE(3)`, `REVIEW(2)`, `FINAL`, `CERTIFIED`. */
  id: string;
  kind: StopKind;
  /** The level played there; null for CERTIFIED. FINAL is the final exam's level. */
  level: number | null;
  /** How many of the machine's states it stands for: a review's, one per return point. */
  states: number;
}

/** One row of the table, in the table's own words. */
export interface RoutingRowSummary {
  row: string;
  from: StopKind;
  on: string;
  move: string;
  where: string;
  guard: string;
}

/** The moves of one row from one stop to another, grouped. */
export interface RoutingEdge {
  /** `row|from|to`: see `routingEdgeKey`. */
  key: string;
  row: string;
  from: string;
  to: string;
  /** The labels this row can take between the two, in alphabet order. */
  labels: string[];
}

export interface RoutingGraph {
  stops: RoutingStop[];
  rows: RoutingRowSummary[];
  edges: RoutingEdge[];
  /** The machine's state count and its alphabet's size. */
  stateCount: number;
  labelCount: number;
  /** Where `label` leads from the state named `from`, or null where no row ever offers it there. */
  target(from: string, label: string): RoutingState | null;
  /** The row that offers `label` from the state named `from`, or null. */
  rowOf(from: string, label: string): string | null;
  /** A label's transition, or null for an id the alphabet does not have. */
  transition(label: string): RoutingTransition | null;
}

export const routingEdgeKey = (row: string, from: string, to: string) => `${row}|${from}|${to}`;

const stopOf = (state: RoutingState): Omit<RoutingStop, 'states'> => {
  switch (state.kind) {
    case 'DRIVE':
    case 'REVIEW':
      return { id: controlStateId(state), kind: state.kind, level: state.level };
    case 'FINAL':
      return { id: controlStateId(state), kind: state.kind, level: FINAL_EXAM_LEVEL };
    case 'CERTIFIED':
      return { id: controlStateId(state), kind: state.kind, level: null };
  }
};

const KIND_ORDER: readonly StopKind[] = ['DRIVE', 'REVIEW', 'FINAL', 'CERTIFIED'];

export const routingGraph = (): RoutingGraph => {
  const stops = new Map<string, RoutingStop>();
  for (const state of ROUTING_STATES) {
    const stop = stopOf(state);
    const known = stops.get(stop.id);
    stops.set(stop.id, { ...stop, states: (known?.states ?? 0) + 1 });
  }
  const ordered = [...stops.values()].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.level ?? 0) - (b.level ?? 0)
  );
  const stopIndex = new Map(ordered.map((stop, index) => [stop.id, index]));

  const targets = new Map<string, RoutingState>();
  const rowsOf = new Map<string, string>();
  const edges = new Map<string, { row: string; from: string; to: string; labels: Set<string> }>();
  for (const state of ROUTING_STATES) {
    for (const outcome of OUTCOMES) {
      for (const probe of PROBE_NAMES) {
        const context = probeContext(probe, outcome);
        for (const rule of ROUTING_TABLE) {
          for (const move of rule.offers(state, context)) {
            const label = transitionId(move.transition);
            const at = `${stateId(state)}|${label}`;
            const known = targets.get(at);
            if (known && stateId(known) !== stateId(move.to)) {
              throw new Error(`${label} from ${stateId(state)} leads to two states`);
            }
            targets.set(at, move.to);
            rowsOf.set(at, rule.row);
            const from = controlStateId(state);
            const to = controlStateId(move.to);
            const key = routingEdgeKey(rule.row, from, to);
            const edge = edges.get(key) ?? { row: rule.row, from, to, labels: new Set<string>() };
            edge.labels.add(label);
            edges.set(key, edge);
          }
        }
      }
    }
  }

  const alphabet = ROUTING_ALPHABET.map(transitionId);
  const byLabel = new Map(ROUTING_ALPHABET.map(transition => [transitionId(transition), transition]));
  const rowOrder = ROUTING_TABLE.map(rule => rule.row);

  return {
    stops: ordered,
    rows: ROUTING_TABLE.map(({ row, from, on, move, where, guard }) => ({ row, from, on, move, where, guard })),
    edges: [...edges.values()]
      .sort(
        (a, b) =>
          rowOrder.indexOf(a.row) - rowOrder.indexOf(b.row) ||
          stopIndex.get(a.from)! - stopIndex.get(b.from)! ||
          stopIndex.get(a.to)! - stopIndex.get(b.to)!
      )
      .map(edge => ({
        key: routingEdgeKey(edge.row, edge.from, edge.to),
        row: edge.row,
        from: edge.from,
        to: edge.to,
        labels: alphabet.filter(label => edge.labels.has(label)),
      })),
    stateCount: ROUTING_STATES.length,
    labelCount: ROUTING_ALPHABET.length,
    target: (from, label) => targets.get(`${from}|${label}`) ?? null,
    rowOf: (from, label) => rowsOf.get(`${from}|${label}`) ?? null,
    transition: label => byLabel.get(label) ?? null,
  };
};

/**
 * The legal moves a record names by id, rebuilt as the machine listed them:
 * each label's transition, and the state it leads to from `from`. Null if any
 * id is one the machine never offers there.
 */
export const movesFromIds = (graph: RoutingGraph, from: string, ids: readonly string[]): RoutingMove[] | null => {
  const moves: RoutingMove[] = [];
  for (const id of ids) {
    const transition = graph.transition(id);
    const to = graph.target(from, id);
    if (!transition || !to) return null;
    moves.push({ transition, to });
  }
  return moves;
};
