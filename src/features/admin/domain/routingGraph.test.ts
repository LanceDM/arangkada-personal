import { describe, expect, it } from 'vitest';
import { OUTCOMES, PROBE_NAMES, probeContext } from '@/domain/routing/characterizeRouting';
import { ROUTING_TABLE, legalTransitions, step } from '@/domain/routing/routingTable';
import { ROUTING_ALPHABET, ROUTING_STATES, controlStateId, stateId, transitionId } from '@/domain/routing/routingTypes';
import { movesFromIds, routingEdgeKey, routingGraph } from './routingGraph';

const graph = routingGraph();

const cells = ROUTING_STATES.flatMap(state =>
  OUTCOMES.flatMap(outcome => PROBE_NAMES.map(probe => ({ state, context: probeContext(probe, outcome) })))
);

describe('the routing graph, read from the machine', () => {
  it('has one stop per control state, in the machine\'s order', () => {
    const control = [...new Set(ROUTING_STATES.map(controlStateId))];
    expect(graph.stops.map(stop => stop.id).sort()).toEqual([...control].sort());
    expect(graph.stops).toHaveLength(25);
    expect(graph.stops.map(stop => stop.id).slice(0, 13)).toEqual([...Array.from({ length: 12 }, (_, level) => `DRIVE(${level})`), 'REVIEW(1)']);
    expect(graph.stops.slice(-2).map(stop => stop.id)).toEqual(['FINAL', 'CERTIFIED']);
    expect(graph.stops.reduce((sum, stop) => sum + stop.states, 0)).toBe(ROUTING_STATES.length);
    expect(graph.stateCount).toBe(80);
    expect(graph.labelCount).toBe(148);
  });

  it('keeps every row of the table, in its own words', () => {
    expect(graph.rows.map(row => row.row)).toEqual(ROUTING_TABLE.map(rule => rule.row));
    expect(graph.rows.map(row => row.guard)).toEqual(ROUTING_TABLE.map(rule => rule.guard));
    expect(graph.rows).toHaveLength(7);
  });

  it('gives every row an edge, and every edge a row', () => {
    const rows = new Set(ROUTING_TABLE.map(rule => rule.row));
    for (const row of rows) expect(graph.edges.some(edge => edge.row === row)).toBe(true);
    for (const edge of graph.edges) {
      expect(rows.has(edge.row)).toBe(true);
      expect(edge.key).toBe(routingEdgeKey(edge.row, edge.from, edge.to));
    }
  });

  it('puts every label of the alphabet on an edge', () => {
    const drawn = new Set(graph.edges.flatMap(edge => edge.labels));
    expect([...drawn].sort()).toEqual(ROUTING_ALPHABET.map(transitionId).sort());
  });

  it('leads each label where the machine does, in every cell', () => {
    for (const { state, context } of cells) {
      for (const move of legalTransitions(state, context)) {
        const label = transitionId(move.transition);
        expect(stateId(graph.target(stateId(state), label)!)).toBe(stateId(move.to));
        expect(stateId(step(state, context, move.transition)!)).toBe(stateId(move.to));
        const edge = graph.edges.find(
          candidate => candidate.row === graph.rowOf(stateId(state), label) && candidate.from === controlStateId(state) && candidate.to === controlStateId(move.to)
        );
        expect(edge?.labels).toContain(label);
      }
    }
  });

  it('rebuilds a cell\'s legal moves from their ids exactly as the machine listed them', () => {
    for (const { state, context } of cells) {
      const legal = legalTransitions(state, context);
      expect(movesFromIds(graph, stateId(state), legal.map(move => transitionId(move.transition)))).toEqual(legal);
    }
  });

  it('knows nothing the machine does not offer', () => {
    expect(movesFromIds(graph, 'DRIVE(0)', ['advance+practice(parking)'])).not.toBeNull();
    expect(movesFromIds(graph, 'DRIVE(0)', ['review(1,parking)'])).toBeNull();
    expect(movesFromIds(graph, 'CERTIFIED', ['certify'])).toBeNull();
    expect(movesFromIds(graph, 'DRIVE(3)', ['jump'])).toBeNull();
    expect(graph.edges.some(edge => edge.from === 'CERTIFIED')).toBe(false);
  });
});
