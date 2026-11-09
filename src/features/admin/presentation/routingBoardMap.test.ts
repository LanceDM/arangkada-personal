import { describe, expect, it } from 'vitest';
import { ROUTING_STATES, controlStateId } from '@/domain/routing/routingTypes';
import { flowPath } from '@/features/admin/domain/routingFlow';
import { routingGraph } from '@/features/admin/domain/routingGraph';
import { playCourse, routingLogOf } from '@/features/admin/domain/routingRecords.fixture';
import { ROUTING_BOARD, edgeShape, loopCounts, placeStops, routingProgress } from './routingBoardMap';

const graph = routingGraph();
const stops = placeStops(graph);

describe('the routing board', () => {
  it("places every one of the machine's control states, and nothing else", () => {
    expect(Object.keys(stops).sort()).toEqual([...new Set(ROUTING_STATES.map(controlStateId))].sort());
    for (const stop of Object.values(stops)) {
      expect(stop.x - stop.r).toBeGreaterThan(0);
      expect(stop.x + stop.r).toBeLessThan(ROUTING_BOARD.width);
      expect(stop.y + stop.r).toBeLessThan(ROUTING_BOARD.height);
    }
  });

  it('keeps every two stops apart', () => {
    const placed = Object.values(stops);
    for (const [index, a] of placed.entries()) {
      for (const b of placed.slice(index + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r + 8);
      }
    }
  });

  it('draws every edge of the graph one way, and roads only between neighbours on the course', () => {
    const kinds = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      const shape = edgeShape(edge, stops);
      kinds.set(edge.row, new Set([...(kinds.get(edge.row) ?? []), shape.kind]));
      if (shape.kind === 'loop') expect(edge.from).toBe(edge.to);
      if (shape.kind === 'road') {
        expect(stops[edge.from].y).toBe(ROUTING_BOARD.courseY);
        expect(stops[edge.to].y).toBe(ROUTING_BOARD.courseY);
      }
    }
    // The table's rows, as the board shows them: read from its edges, not written here.
    expect(Object.fromEntries([...kinds].map(([row, shapes]) => [row, [...shapes].sort()]))).toEqual({
      retry: ['loop'],
      advance: ['road'],
      'to final': ['road'],
      review: ['detour'],
      return: ['detour'],
      'retry the final': ['loop'],
      certify: ['road'],
    });
  });

  it('counts a path up to the move shown and not past it', () => {
    const attempts = playCourse({
      group: 'conventional',
      entries: [{ outcome: 'failed' }, { outcome: 'failed' }, { outcome: 'passed' }, { outcome: 'passed' }],
    });
    const path = flowPath({ code: 'P01', cohort: 'study', group: 'conventional', attempts, routingLog: routingLogOf(attempts) }, graph);
    expect(path.steps.map(step => step.move)).toEqual(['retry', 'retry', 'advance']);
    const first = routingProgress(path.steps, 0, path.start);
    expect([...first.reached]).toEqual(['DRIVE(0)']);
    expect(loopCounts(graph, 'DRIVE(0)', first)).toEqual({ moves: 1, practice: 0 });
    const all = routingProgress(path.steps, 2, path.start);
    expect(loopCounts(graph, 'DRIVE(0)', all).moves).toBe(2);
    expect([...all.reached].sort()).toEqual(['DRIVE(0)', 'DRIVE(1)']);
    expect(all.edges['advance|DRIVE(0)|DRIVE(1)']).toBe(1);
  });
});
