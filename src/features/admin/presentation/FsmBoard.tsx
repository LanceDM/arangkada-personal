/**
 * The driving FSM drawn as a game board (`fsmBoardMap`): stops on roads, lit as
 * far as the replay has driven, the current stop pulsing and the road into it
 * rolling. With `showTable`, the machine's exact transitions are drawn over it.
 */
import type { FsmGraph, FSMState } from '@/features/driving-sim';
import { edgeKey, type TimelineStep } from '@/features/admin/domain/replayTimeline';
import { ASPHALT, BOARD_INK, BOARD_MOTION, LANE, TRAVELLED } from './boardPalette';
import { BOARD, ROADS, ROLE_COLOR, STOPS, boardMove, type BoardProgress, type RoadId } from './fsmBoardMap';

const { width: W, height: H, stopRadius: R } = BOARD;
/** A curve from stop to stop, starting and ending at their rims, bent by `bend` to its left. */
const hop = (from: FSMState, to: FSMState, bend: number) => {
  const a = STOPS[from];
  const b = STOPS[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const cx = (a.x + b.x) / 2 + (dy / length) * bend;
  const cy = (a.y + b.y) / 2 - (dx / length) * bend;
  const rim = (x: number, y: number, tx: number, ty: number, r: number) => {
    const d = Math.hypot(tx - x, ty - y) || 1;
    return { x: x + ((tx - x) / d) * r, y: y + ((ty - y) / d) * r };
  };
  const start = rim(a.x, a.y, cx, cy, R + 4);
  const end = rim(b.x, b.y, cx, cy, R + 6);
  return {
    d: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`,
    labelX: 0.25 * start.x + 0.5 * cx + 0.25 * end.x,
    labelY: 0.25 * start.y + 0.5 * cy + 0.25 * end.y,
  };
};

const Badge = ({ x, y, text, tone = 'lit' }: { x: number; y: number; text: string; tone?: 'lit' | 'dim' }) => {
  const width = 12 + text.length * 6.4;
  return (
    <g data-badge={text}>
      <rect x={x} y={y - 9} width={width} height={18} rx={9} fill={tone === 'lit' ? LANE : '#2A3352'} />
      <text
        x={x + width / 2}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill={tone === 'lit' ? '#1A1A1A' : '#C7CCE0'}
      >
        {text}
      </text>
    </g>
  );
};

interface FsmBoardProps {
  graph: FsmGraph;
  /** The step shown; null before the log has one. */
  step: TimelineStep | null;
  /** The state the log starts in. */
  initial: FSMState | null;
  /** What the replay has driven up to and including the step. */
  progress: BoardProgress;
  /** With the machine's exact transitions drawn over the board: each one's count up to the step. */
  table: Record<string, number> | null;
}

export const FsmBoard = ({ graph, step, initial, progress, table }: FsmBoardProps) => {
  const move = step ? boardMove(step.from, step.to, step.trigger) : null;
  const active = new Set<RoadId>(move?.kind === 'road' ? move.roads : []);
  const current: FSMState | null = step?.to ?? initial;
  const currentColor = current ? ROLE_COLOR[STOPS[current].role] : LANE;
  const roads = Object.entries(ROADS) as Array<[RoadId, string]>;
  const pairs = new Set(graph.edges.map(edge => edgeKey(edge.from, edge.to)));

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1B2240] bg-[#0C1122]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="The driving FSM as a road board: the stops this attempt has reached so far, and the road it is on now"
        className="block h-auto w-full min-w-[560px] select-none"
      >
        <style>{BOARD_MOTION}</style>
        <defs>
          {(['quiet', 'taken'] as const).map(tone => (
            <marker key={tone} id={`fsm-board-${tone}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M1 1L9 5L1 9z" fill={tone === 'taken' ? '#C7CCE0' : '#3E4766'} />
            </marker>
          ))}
          <marker id="fsm-board-hop" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1L9 5L1 9z" fill={currentColor} />
          </marker>
        </defs>

        {/* The roads: asphalt, then the lane dashes on what has been driven, then the road being driven now. */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {roads.map(([id, d]) => (
            <path
              key={id}
              d={d}
              data-road={id}
              data-lit={progress.lit.has(id) || undefined}
              data-active={active.has(id) || undefined}
              stroke={progress.lit.has(id) ? TRAVELLED : ASPHALT}
              strokeWidth={progress.lit.has(id) ? 14 : 10}
            />
          ))}
          {roads
            .filter(([id]) => progress.lit.has(id) && !active.has(id))
            .map(([id, d]) => (
              <path key={id} d={d} stroke={LANE} strokeWidth={2} strokeDasharray="6 6" />
            ))}
          {roads
            .filter(([id]) => active.has(id))
            .map(([id, d]) => (
              <g key={id}>
                <path d={d} stroke={currentColor} strokeWidth={14} />
                <path d={d} stroke={BOARD_INK} strokeWidth={2.5} strokeDasharray="6 6" className="fsm-roll" />
              </g>
            ))}
        </g>

        <g className="font-display" fontSize={9.5} letterSpacing={1.2} fill="#5A6488">
          <text x={608} y={196}>◂ MISTAKE</text>
          <text x={608} y={292}>▾ CORRECT</text>
          <text x={268} y={360} textAnchor="middle">BACK TO DRIVING</text>
        </g>

        {/* A move off the roads, drawn only while it is the step shown. */}
        {step && move?.kind === 'direct' && (
          <path
            data-hop={edgeKey(step.from, step.to)}
            d={hop(step.from, step.to, 46).d}
            fill="none"
            stroke={currentColor}
            strokeWidth={2.5}
            strokeDasharray="5 6"
            markerEnd="url(#fsm-board-hop)"
            className="fsm-roll"
          />
        )}

        {/* The machine's exact transitions, on request. Self-loops are the counts on their stops. */}
        {table && (
          <g fill="none">
            {graph.edges
              .filter(edge => edge.from !== edge.to)
              .map(edge => {
                const key = edgeKey(edge.from, edge.to);
                const count = table[key] ?? 0;
                const shape = hop(edge.from, edge.to, pairs.has(edgeKey(edge.to, edge.from)) ? 16 : 6);
                return (
                  <g key={key} data-edge={key} data-taken={count}>
                    <title>{`${edge.from} → ${edge.to}: ${edge.triggers.join(', ')}`}</title>
                    <path
                      d={shape.d}
                      stroke={count > 0 ? '#C7CCE0' : '#3E4766'}
                      strokeWidth={count > 0 ? 1.4 : 1}
                      strokeOpacity={count > 0 ? 0.9 : 0.8}
                      markerEnd={`url(#fsm-board-${count > 0 ? 'taken' : 'quiet'})`}
                    />
                    {count > 0 && (
                      <text x={shape.labelX} y={shape.labelY} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="#E5E7EB" stroke="#0C1122" strokeWidth={3} paintOrder="stroke">
                        {count}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        )}

        {/* The stops. */}
        {graph.states.map(state => {
          const stop = STOPS[state];
          const color = ROLE_COLOR[stop.role];
          const isCurrent = state === current;
          const reached = progress.reached.has(state);
          const r = isCurrent ? R + 4 : R;
          const Icon = stop.icon;
          const loops = progress.loops[state] ?? 0;
          return (
            <g key={state} data-state={state} data-reached={reached || undefined} data-current={isCurrent || undefined}>
              <title>{state}</title>
              {isCurrent && <circle cx={stop.x} cy={stop.y} r={r} fill="none" stroke={color} strokeWidth={2} className="fsm-pulse" />}
              <circle
                cx={stop.x}
                cy={stop.y}
                r={r}
                fill={isCurrent ? color : reached ? '#1A2140' : '#141A30'}
                stroke={isCurrent || reached ? color : '#2A3352'}
                strokeWidth={isCurrent || reached ? 3 : 2}
                strokeDasharray={isCurrent || reached ? undefined : '4 4'}
              />
              <Icon
                x={stop.x - 11}
                y={stop.y - 11}
                width={22}
                height={22}
                strokeWidth={2.2}
                color={isCurrent ? BOARD_INK : reached ? color : '#3E4766'}
                aria-hidden
              />
              <text
                className="font-display"
                x={stop.labelSide === 'right' ? stop.x + R + 10 : stop.x}
                y={stop.labelSide === 'right' ? stop.y : stop.y + R + 15}
                textAnchor={stop.labelSide === 'right' ? 'start' : 'middle'}
                dominantBaseline="central"
                fontSize={10.5}
                letterSpacing={1.4}
                fill={isCurrent ? '#FFFFFF' : reached ? '#D6DAE8' : '#4E577A'}
              >
                {stop.label.toUpperCase()}
              </text>
              {loops > 0 && <Badge x={stop.x + R - 6} y={stop.y - R + 2} text={`↺${loops}`} />}
              {state === 'IDLE' && progress.rests > 0 && <Badge x={stop.x + R - 6} y={stop.y - R + 2} text={`rest ${progress.rests}`} tone="dim" />}
              {state === 'GAME_OVER' && progress.crashes > 0 && <Badge x={stop.x + R - 6} y={stop.y - R + 2} text={`×${progress.crashes}`} />}
              {state === 'GAME_OVER' && progress.timeouts > 0 && <Badge x={stop.x + R - 6} y={stop.y + R - 2} text={`time ×${progress.timeouts}`} tone="dim" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
