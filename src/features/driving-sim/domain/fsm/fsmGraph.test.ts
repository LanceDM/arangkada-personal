import { describe, expect, it } from 'vitest';
import { DrivingFSM } from './DrivingFSM';
import { ALL_STATES } from './characterize';
import { drivingFsmGraph, isInputTrigger } from './fsmGraph';

describe('drivingFsmGraph', () => {
  const graph = drivingFsmGraph();
  const table = new DrivingFSM().getTransitionTable();

  it('names every state of the machine', () => {
    expect(graph.states).toEqual(ALL_STATES);
  });

  it('has one edge per (from, to) pair, carrying every trigger of the table', () => {
    const pairs = new Set(graph.edges.map(edge => `${edge.from}>${edge.to}`));
    expect(pairs.size).toBe(graph.edges.length);
    for (const row of table) {
      const edge = graph.edges.find(candidate => candidate.from === row.from && candidate.to === row.to);
      expect(edge?.triggers).toContain(row.trigger);
    }
    const triples = new Set(table.map(row => `${row.from}>${row.to}>${row.trigger}`));
    expect(graph.edges.reduce((sum, edge) => sum + edge.triggers.length, 0)).toBe(triples.size);
  });

  it('keeps the verdict edges and the self-loops the log is full of', () => {
    const edge = (from: string, to: string) => graph.edges.find(candidate => candidate.from === from && candidate.to === to);
    expect(edge('REACTION_WINDOW', 'VIOLATION')?.triggers).toEqual(['answer_incorrect']);
    expect(edge('DECISION', 'DECISION')?.triggers).toEqual(['answer_correct']);
    expect(edge('DRIVING', 'DRIVING')?.triggers).toContain('brake');
    expect(edge('APPROACHING_EVENT', 'APPROACHING_EVENT')?.triggers).toContain('briefing_dismissed');
  });
});

describe('isInputTrigger', () => {
  it('is the player-input half of the alphabet', () => {
    expect(['brake', 'accelerate', 'turn_left', 'turn_right', 'stop', 'start'].every(isInputTrigger)).toBe(true);
    expect(['answer_correct', 'briefing_dismissed', 'scenario_trigger', 'vehicle_stopped', 'crash'].some(isInputTrigger)).toBe(false);
  });
});
