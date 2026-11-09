/**
 * The routing FSM as a game board: the course is one road of stops, a level
 * each, then the final exam and certification; under it runs the review lane,
 * a stop for each level a review can replay.
 *
 * Where a stop stands is a formula of the stop itself (its level's column, on
 * the course or in the lane), and every road is drawn from an edge of the
 * machine's graph, never from a list typed here:
 * - a move between neighbouring stops on the course is a stretch of road;
 * - a move that stays (a retry) is a count on its stop;
 * - anything else, a review and its return, is a detour between the course
 *   and the lane, drawn where it was taken, or all of them with Full table.
 */
import { FINAL_EXAM_LEVEL } from '@/domain/routing/routingTypes';
import type { FlowStep } from '@/features/admin/domain/routingFlow';
import type { RoutingEdge, RoutingGraph, RoutingStop, StopKind } from '@/features/admin/domain/routingGraph';

const X0 = 52;
const DX = 66;
const COURSE_Y = 96;
const LANE_Y = 236;

export const ROUTING_BOARD = { width: X0 * 2 + DX * 13, height: 296, courseY: COURSE_Y, laneY: LANE_Y } as const;

/** Each kind of stop's colour on the board, which is a dark game screen in either theme. */
export const STOP_COLOR: Record<StopKind, string> = {
  DRIVE: '#F4C524',
  REVIEW: '#38BDF8',
  FINAL: '#8B7CF6',
  CERTIFIED: '#34D399',
};

export interface PlacedStop extends RoutingStop {
  x: number;
  y: number;
  r: number;
  /** What the stop shows inside it: its level, or nothing where an icon stands. */
  text: string | null;
}

/** The column a stop stands in: its level, certification after the final exam. */
const columnOf = (stop: RoutingStop) => (stop.kind === 'CERTIFIED' ? FINAL_EXAM_LEVEL + 1 : stop.level!);

export const placeStops = (graph: RoutingGraph): Record<string, PlacedStop> =>
  Object.fromEntries(
    graph.stops.map(stop => {
      const x = X0 + DX * columnOf(stop);
      const inLane = stop.kind === 'REVIEW';
      const r = inLane ? 15 : stop.kind === 'DRIVE' ? 19 : 21;
      const text = stop.kind === 'DRIVE' || stop.kind === 'REVIEW' ? String(stop.level) : null;
      return [stop.id, { ...stop, x, y: inLane ? LANE_Y : COURSE_Y, r, text }];
    })
  );

export type EdgeShape =
  | { kind: 'loop' }
  | { kind: 'road'; d: string; labelX: number; labelY: number }
  | { kind: 'detour'; d: string; labelX: number; labelY: number };

/** How an edge is drawn, from where its two stops stand. */
export const edgeShape = (edge: Pick<RoutingEdge, 'from' | 'to'>, stops: Record<string, PlacedStop>): EdgeShape => {
  const a = stops[edge.from];
  const b = stops[edge.to];
  if (a.id === b.id) return { kind: 'loop' };
  if (a.y === COURSE_Y && b.y === COURSE_Y && Math.abs(b.x - a.x) === DX) {
    const direction = Math.sign(b.x - a.x);
    const startX = a.x + direction * (a.r + 3);
    const endX = b.x - direction * (b.r + 3);
    return { kind: 'road', d: `M${startX} ${COURSE_Y}H${endX}`, labelX: (startX + endX) / 2, labelY: COURSE_Y - 17 };
  }
  // Down into the lane on the left of a stop, back up on its right, so a review and its return never share a line.
  const down = b.y > a.y;
  const side = down ? -6 : 6;
  const start = { x: a.x + side, y: a.y + (down ? a.r + 2 : -a.r - 2) };
  const end = { x: b.x + side, y: b.y + (down ? -b.r : b.r) - (down ? 6 : -6) };
  const middle = (COURSE_Y + LANE_Y) / 2;
  const d = `M${start.x} ${start.y}C${start.x} ${middle} ${end.x} ${middle} ${end.x} ${end.y}`;
  // The cubic's own midpoint, where its count stands.
  const labelX = (start.x + 3 * start.x + 3 * end.x + end.x) / 8;
  const labelY = (start.y + 3 * middle + 3 * middle + end.y) / 8;
  return { kind: 'detour', d, labelX, labelY };
};

/** What a path shows up to and including one move: everything after it is still ahead. */
export interface RoutingProgress {
  /** Stops reached so far, the one the path starts at included. */
  reached: Set<string>;
  /** Moves so far per edge, and those of them that added practice. */
  edges: Record<string, number>;
  practice: Record<string, number>;
}

export const routingProgress = (steps: readonly FlowStep[], position: number, start: string | null): RoutingProgress => {
  const progress: RoutingProgress = { reached: new Set(start ? [start] : []), edges: {}, practice: {} };
  for (const step of steps) {
    if (step.index > position) break;
    progress.reached.add(step.fromStop);
    progress.reached.add(step.toStop);
    if (!step.edge) continue;
    progress.edges[step.edge] = (progress.edges[step.edge] ?? 0) + 1;
    if (step.addOn?.kind === 'practice') progress.practice[step.edge] = (progress.practice[step.edge] ?? 0) + 1;
  }
  return progress;
};

/** Every count on one stop's loops: its retries, and those that added practice. */
export const loopCounts = (graph: RoutingGraph, stop: string, counts: Pick<RoutingProgress, 'edges' | 'practice'>) =>
  graph.edges
    .filter(edge => edge.from === stop && edge.to === stop)
    .reduce(
      (sum, edge) => ({ moves: sum.moves + (counts.edges[edge.key] ?? 0), practice: sum.practice + (counts.practice[edge.key] ?? 0) }),
      { moves: 0, practice: 0 }
    );
