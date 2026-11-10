import { describe, expect, it } from 'vitest';
import { drivingFsmGraph, type FSMState, type TransitionLogEntry } from '@/features/driving-sim';
import { edgeKey, fsmReplay } from '@/features/admin/domain/replayTimeline';
import { BOARD, ROADS, ROUTES, STOPS, boardMove, boardProgress } from './fsmBoardMap';

const graph = drivingFsmGraph();
const tableEdges = new Set(graph.edges.map(edge => edgeKey(edge.from, edge.to)));

describe('the board', () => {
  it('places every state of the machine, and no two stops touch', () => {
    expect(Object.keys(STOPS).sort()).toEqual([...graph.states].sort());
    const stops = Object.values(STOPS);
    for (const [i, a] of stops.entries()) {
      for (const b of stops.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.label} and ${b.label}`).toBeGreaterThanOrEqual(2 * BOARD.stopRadius + 20);
      }
      expect(a.x - BOARD.stopRadius).toBeGreaterThan(0);
      expect(a.x + BOARD.stopRadius).toBeLessThan(BOARD.width);
      expect(a.y + BOARD.stopRadius + 20).toBeLessThan(BOARD.height);
    }
  });

  it('puts on a road only moves the machine has, and every road carries one', () => {
    for (const key of Object.keys(ROUTES)) expect(tableEdges.has(key), key).toBe(true);
    const used = new Set(Object.values(ROUTES).flat());
    expect([...used].sort()).toEqual(Object.keys(ROADS).sort());
  });

  it('shows every move in the table one way or another', () => {
    for (const edge of graph.edges) {
      const move = boardMove(edge.from, edge.to, edge.triggers[0]);
      if (edge.from === edge.to) expect(move.kind).toBe('loop');
      else if (edge.to === 'IDLE') expect(move.kind).toBe('rest');
      else if (edge.to === 'GAME_OVER') {
        // Two triggers reach it, and each has its own count.
        expect(edge.triggers).toEqual(['crash', 'time_up']);
        expect(boardMove(edge.from, edge.to, 'crash').kind).toBe('crash');
        expect(boardMove(edge.from, edge.to, 'time_up').kind).toBe('time-up');
      }
      else expect(move.kind).toBe(ROUTES[edgeKey(edge.from, edge.to)] ? 'road' : 'direct');
    }
  });

  it('drives the correct answer and the mistake through Feedback, as the machine does', () => {
    expect(boardMove('INTERSECTION', 'FEEDBACK_DISPLAYED')).toEqual({ kind: 'road', roads: ['intersection-out', 'to-feedback'] });
    expect(boardMove('HAZARD', 'VIOLATION')).toEqual({ kind: 'road', roads: ['hazard-out', 'to-violation'] });
    expect(boardMove('FEEDBACK_DISPLAYED', 'RECOVERY')).toEqual({ kind: 'road', roads: ['feedback-recovery'] });
    expect(boardMove('HAZARD', 'DRIVING')).toEqual({ kind: 'direct' });
  });
});

describe('boardProgress', () => {
  const entry = (from: FSMState, to: FSMState, trigger: string, at: number): TransitionLogEntry => ({
    from,
    to,
    trigger,
    timestamp: at,
    snapshot: { gameplay: to, competency: 'unassigned' },
    params: { approachScale: 1, reactionScale: 1 },
  });
  const { steps, initial } = fsmReplay({
    transitions: [
      entry('IDLE', 'DRIVING', 'start', 0),
      entry('DRIVING', 'DRIVING', 'brake', 10),
      entry('DRIVING', 'DRIVING', 'brake', 20),
      entry('DRIVING', 'IDLE', 'vehicle_stopped', 30),
      entry('IDLE', 'DRIVING', 'accelerate', 40),
      entry('DRIVING', 'APPROACHING_EVENT', 'scenario_trigger', 50),
      entry('APPROACHING_EVENT', 'DRIVING', 'road_clear', 60),
      entry('DRIVING', 'GAME_OVER', 'crash', 70),
    ],
    truncated: false,
    totalCount: 8,
  });

  it('counts what has been driven up to the step, and nothing after it', () => {
    const at = (index: number) => boardProgress(steps, steps[index], initial);
    expect(at(1)).toMatchObject({ rests: 0, crashes: 0, direct: 0, loops: { DRIVING: 2 } });
    expect([...at(1).reached].sort()).toEqual(['DRIVING', 'IDLE']);
    expect([...at(1).lit]).toEqual(['idle-driving']);

    const end = at(steps.length - 1);
    expect(end).toMatchObject({ rests: 1, crashes: 1, timeouts: 0, direct: 1 });
    expect([...end.lit].sort()).toEqual(['driving-approaching', 'idle-driving']);
    expect(end.reached.has('GAME_OVER')).toBe(true);
    expect(end.reached.has('REACTION_WINDOW')).toBe(false);
  });

  it('counts a run whose time ran out apart from a crash', () => {
    const timedOut = fsmReplay({
      transitions: [entry('IDLE', 'DRIVING', 'start', 0), entry('DRIVING', 'IDLE', 'vehicle_stopped', 10), entry('IDLE', 'GAME_OVER', 'time_up', 20)],
      truncated: false,
      totalCount: 3,
    });
    const end = boardProgress(timedOut.steps, timedOut.steps.at(-1)!, timedOut.initial);
    expect(end).toMatchObject({ crashes: 0, timeouts: 1 });
    expect(end.reached.has('GAME_OVER')).toBe(true);
  });

  it('starts at the state the log starts in', () => {
    expect([...boardProgress(steps, null, initial).reached]).toEqual(['IDLE']);
  });
});
