/**
 * The routing FSM drawn as a game board (`routingBoardMap`): the course road
 * of levels, the final exam and certification, and the review lane under it.
 * Roads are lit as far as a path has gone, or carry the pool's counts; the
 * move shown rolls, and the stop it reached pulses. A retry is a count on its
 * stop, and practice added is an orange count beside the move that added it.
 */
import { useMemo } from 'react';
import { Award, Flag } from 'lucide-react';
import { levelName } from '@/features/admin/domain/playerReport';
import type { RoutingGraph } from '@/features/admin/domain/routingGraph';
import { ASPHALT, BOARD_BACKGROUND, BOARD_INK, BOARD_MOTION, LANE, TRAVELLED } from './boardPalette';
import { ROUTING_BOARD, STOP_COLOR, edgeShape, loopCounts, placeStops, type PlacedStop } from './routingBoardMap';

const { width: W, height: H, courseY, laneY } = ROUTING_BOARD;
const PRACTICE = '#F0784A';
const DETOUR = STOP_COLOR.REVIEW;

const Badge = ({ x, y, text, color = LANE, ink = '#1A1A1A', anchor = 'middle' }: { x: number; y: number; text: string; color?: string; ink?: string; anchor?: 'middle' | 'start' }) => {
  const width = 12 + text.length * 6.4;
  const left = anchor === 'middle' ? x - width / 2 : x;
  return (
    <g data-badge={text}>
      <rect x={left} y={y - 9} width={width} height={18} rx={9} fill={color} />
      <text x={left + width / 2} y={y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} fill={ink}>
        {text}
      </text>
    </g>
  );
};

const stopTitle = (stop: PlacedStop) => {
  switch (stop.kind) {
    case 'DRIVE':
      return `${stop.id} · ${levelName(stop.level!)}`;
    case 'REVIEW':
      return `${stop.id} · a replay of ${levelName(stop.level!)}, then back to the course`;
    case 'FINAL':
      return `FINAL · the Final Mission, ${levelName(stop.level!)}`;
    case 'CERTIFIED':
      return 'CERTIFIED · the Final Mission passed: nothing leaves it';
  }
};

export interface RoutingBoardProps {
  graph: RoutingGraph;
  /** Moves per edge, and those of them that added practice. */
  counts: { edges: Record<string, number>; practice: Record<string, number> };
  reached: ReadonlySet<string>;
  /** The move shown: its edge rolls and the stop it reached pulses. */
  current: { edge: string | null; to: string } | null;
  /** The stop that pulses before any move is shown. */
  start?: string | null;
  /** Every detour the table has, travelled or not. */
  showAll: boolean;
  /** A road shows its count from this many moves: 1 for the pool's counts, 2 where lighting it says it was driven. */
  countsFrom?: number;
  label: string;
}

export const RoutingBoard = ({ graph, counts, reached, current, start = null, showAll, countsFrom = 1, label }: RoutingBoardProps) => {
  const stops = useMemo(() => placeStops(graph), [graph]);
  const shapes = useMemo(() => graph.edges.map(edge => ({ edge, shape: edgeShape(edge, stops) })), [graph, stops]);
  const pulsing = current?.to ?? start;
  const pulseColor = pulsing ? STOP_COLOR[stops[pulsing].kind] : LANE;

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1B2240]" style={{ background: BOARD_BACKGROUND }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full min-w-[720px] select-none">
        <style>{BOARD_MOTION}</style>
        <defs>
          {[
            ['detour', DETOUR],
            ['quiet', '#3E4766'],
            ['current', pulseColor],
          ].map(([id, color]) => (
            <marker key={id} id={`routing-board-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 1L9 5L1 9z" fill={color} />
            </marker>
          ))}
        </defs>

        <g className="font-display" fontSize={9.5} letterSpacing={1.4} fill="#5A6488">
          <text x={16} y={courseY - 50}>COURSE ▸</text>
          <text x={16} y={laneY - 34}>REVIEW LANE</text>
        </g>

        {/* The course road: asphalt, the lane dashes where it was driven, and the stretch driven now. */}
        <g fill="none" strokeLinecap="round">
          {shapes.map(({ edge, shape }) => {
            if (shape.kind !== 'road') return null;
            const driven = (counts.edges[edge.key] ?? 0) > 0;
            const active = current?.edge === edge.key;
            return (
              <g key={edge.key} data-road={edge.key} data-lit={driven || undefined} data-active={active || undefined}>
                <path d={shape.d} stroke={driven ? TRAVELLED : ASPHALT} strokeWidth={driven ? 14 : 10} />
                {driven && !active && <path d={shape.d} stroke={LANE} strokeWidth={2} strokeDasharray="6 6" />}
                {active && (
                  <>
                    <path d={shape.d} stroke={pulseColor} strokeWidth={14} />
                    <path d={shape.d} stroke={BOARD_INK} strokeWidth={2.5} strokeDasharray="6 6" className="fsm-roll" />
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Detours to the review lane and back: where they were taken, or every one of them with Full table. */}
        <g fill="none" strokeLinecap="round">
          {shapes.map(({ edge, shape }) => {
            if (shape.kind !== 'detour') return null;
            const count = counts.edges[edge.key] ?? 0;
            const active = current?.edge === edge.key;
            if (!count && !active && !showAll) return null;
            const tone = active ? 'current' : count ? 'detour' : 'quiet';
            return (
              <g key={edge.key} data-detour={edge.key} data-taken={count} data-active={active || undefined}>
                <title>{`${edge.row}: ${edge.from} → ${edge.to}`}</title>
                <path
                  d={shape.d}
                  stroke={active ? pulseColor : count ? DETOUR : '#2A3352'}
                  strokeWidth={active ? 3 : count ? 2.5 : 1.2}
                  strokeDasharray={count || active ? '7 5' : '3 5'}
                  markerEnd={`url(#routing-board-${tone})`}
                  className={active ? 'fsm-roll' : undefined}
                />
              </g>
            );
          })}
        </g>

        {/* Counts on the roads and detours, and the practice they added. */}
        {shapes.map(({ edge, shape }) => {
          if (shape.kind === 'loop') return null;
          const count = counts.edges[edge.key] ?? 0;
          const practice = counts.practice[edge.key] ?? 0;
          return (
            <g key={edge.key}>
              {count >= countsFrom && <Badge x={shape.labelX} y={shape.labelY} text={`×${count}`} />}
              {practice > 0 && <Badge x={shape.labelX} y={shape.labelY - 20} text={`+${practice}`} color={PRACTICE} />}
            </g>
          );
        })}

        {/* The stops. */}
        {graph.stops.map(({ id }) => {
          const stop = stops[id];
          const color = STOP_COLOR[stop.kind];
          const isCurrent = id === pulsing;
          const isReached = reached.has(id);
          const r = isCurrent ? stop.r + 3 : stop.r;
          const loops = loopCounts(graph, id, counts);
          const Icon = stop.kind === 'FINAL' ? Flag : stop.kind === 'CERTIFIED' ? Award : null;
          const ink = isCurrent ? BOARD_INK : isReached ? color : '#3E4766';
          return (
            <g key={id} data-stop={id} data-reached={isReached || undefined} data-current={isCurrent || undefined}>
              <title>{stopTitle(stop)}</title>
              {isCurrent && <circle cx={stop.x} cy={stop.y} r={r} fill="none" stroke={color} strokeWidth={2} className="fsm-pulse" />}
              <circle
                cx={stop.x}
                cy={stop.y}
                r={r}
                fill={isCurrent ? color : isReached ? '#1A2140' : '#141A30'}
                stroke={isCurrent || isReached ? color : '#2A3352'}
                strokeWidth={isCurrent || isReached ? 3 : 2}
                strokeDasharray={isCurrent || isReached ? undefined : '4 4'}
              />
              {Icon ? (
                <Icon x={stop.x - 10} y={stop.y - 10} width={20} height={20} strokeWidth={2.2} color={ink} aria-hidden />
              ) : (
                <text
                  className="font-display"
                  x={stop.x}
                  y={stop.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={stop.kind === 'REVIEW' ? 11 : 13}
                  fontWeight={600}
                  fill={ink}
                >
                  {stop.text}
                </text>
              )}
              {(stop.kind === 'FINAL' || stop.kind === 'CERTIFIED') && (
                <text
                  className="font-display"
                  x={stop.x}
                  y={stop.y + stop.r + 15}
                  textAnchor="middle"
                  fontSize={9.5}
                  letterSpacing={1.2}
                  fill={isCurrent ? '#FFFFFF' : isReached ? '#D6DAE8' : '#4E577A'}
                >
                  {stop.kind}
                </text>
              )}
              {loops.moves >= countsFrom && <Badge x={stop.x + stop.r - 8} y={stop.y - stop.r - 2} text={`↺${loops.moves}`} anchor="start" />}
              {loops.moves > 0 && loops.moves < countsFrom && <Badge x={stop.x + stop.r - 8} y={stop.y - stop.r - 2} text="↺" anchor="start" />}
              {loops.practice > 0 && (
                <Badge x={stop.x + stop.r - 8} y={stop.y + stop.r + 2} text={`+${loops.practice}`} color={PRACTICE} anchor="start" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
