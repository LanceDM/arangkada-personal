/**
 * The Optimized group's table as a game board, on the boards' dark screen: a
 * zone per course stage, a row per mastery bucket, a column per verdict and
 * budget left (`qBoard`), and a round tile per state, coloured by the action
 * its row tries first. A dashed tile is a state training never reached: the
 * plain move.
 *
 * Its card (`QStateCard`) reads one state out: the situation in words, then
 * the row's whole order, with the action a choice took outlined, the actions
 * the routing FSM masked struck through, or the pool's counts beside each.
 */
import type { ReactNode } from 'react';
import { Link2, Minus, RotateCcw, Target, type LucideIcon } from 'lucide-react';

import type { MasteryBucket } from '@/domain/learner/adaptive/qLearningPolicy';
import type { RoutingAction, RoutingQState } from '@/domain/learner/adaptive/routingQPolicy';
import { cn } from '@/shared/ui/cn';
import {
  ACTION_LABEL,
  Q_BOARD_COLUMNS,
  qBoard,
  qStateWords,
  type QDimensionLabels,
  type QGridRow,
} from '@/features/admin/domain/qMapping';
import { BOARD_BACKGROUND, BOARD_INK } from './boardPalette';

/** Each action's colour and icon on the board. */
const ACTION_STYLE: Record<RoutingAction, { color: string; ink: string; icon: LucideIcon }> = {
  weakest: { color: '#F0784A', ink: BOARD_INK, icon: Target },
  related: { color: '#8B7CF6', ink: BOARD_INK, icon: Link2 },
  review: { color: '#38BDF8', ink: BOARD_INK, icon: RotateCcw },
  none: { color: '#3A4466', ink: '#C7CCE0', icon: Minus },
};

const MASTERY_COLOR: Record<MasteryBucket, string> = { critical: '#F0784A', weak: '#E0AA12', ok: '#34D399' };

export const ActionIcon = ({ action, size = 'md' }: { action: RoutingAction; size?: 'sm' | 'md' }) => {
  const { color, ink, icon: Icon } = ACTION_STYLE[action];
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full', size === 'sm' ? 'h-5 w-5' : 'h-8 w-8')}
      style={{ background: color, color: ink }}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} strokeWidth={2.4} />
    </span>
  );
};

const Tile = ({
  row,
  labels,
  selected,
  current,
  count,
  onSelect,
}: {
  row: QGridRow;
  labels: QDimensionLabels;
  selected: boolean;
  current: boolean;
  count: number;
  onSelect?: (state: RoutingQState) => void;
}) => {
  const first = row.order[0] ?? null;
  const words = `${qStateWords(row, labels)}: ${first ? `tries ${ACTION_LABEL[first].label.toLowerCase()} first` : 'untrained, the plain move'}${count ? ` · ${count}` : ''}`;
  const face = (
    <>
      {current && (
        <span className="absolute -inset-1.5 rounded-full border-2 border-[#F4C524] motion-safe:animate-ping" aria-hidden />
      )}
      {first ? (
        <ActionIcon action={first} />
      ) : (
        <span className="h-8 w-8 rounded-full border-2 border-dashed border-[#2A3352]" aria-hidden />
      )}
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 min-w-[1.1rem] rounded-full bg-[#F4C524] px-1 text-center text-[10px] font-semibold leading-4 text-[#10152A]">
          {count}
        </span>
      )}
    </>
  );
  const shared = {
    'data-tile': row.state,
    'data-first': first ?? 'plain',
    'data-untrained': row.untrained || undefined,
    'data-current': current || undefined,
    'data-selected': selected || undefined,
    'data-count': count,
    title: words,
    className: cn(
      'relative inline-flex rounded-full transition-transform',
      (selected || current) && 'outline outline-2 outline-offset-2 outline-[#F4C524]'
    ),
  };
  return onSelect ? (
    <button
      type="button"
      {...shared}
      aria-label={words}
      aria-pressed={selected}
      onClick={() => onSelect(row.state)}
      className={cn(shared.className, 'hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white')}
    >
      {face}
    </button>
  ) : (
    <span {...shared} role="img" aria-label={words}>
      {face}
    </span>
  );
};

export const QBoard = ({
  rows,
  labels,
  selected = null,
  current = null,
  counts,
  onSelect,
  label,
}: {
  rows: readonly QGridRow[];
  labels: QDimensionLabels;
  /** The tile whose card is shown. */
  selected?: string | null;
  /** The tile a stepped choice stands on: it pulses. */
  current?: string | null;
  /** A count on each tile: choices so far, or the pool's visits. */
  counts?: Readonly<Record<string, number>>;
  /** Makes each tile a button that shows its state. */
  onSelect?: (state: RoutingQState) => void;
  label: string;
}) => (
  <div className="space-y-2">
    <div className="grid gap-2 lg:grid-cols-3" role="group" aria-label={label}>
      {qBoard(rows).map(zone => (
        <div key={zone.stage} data-zone={zone.stage} className="min-w-0 rounded-xl border border-[#1B2240] px-2.5 pb-3 pt-2" style={{ background: BOARD_BACKGROUND }}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="font-display text-xs tracking-[0.16em] text-white">{labels.stage[zone.stage].label.toUpperCase()}</span>
            <span className="text-[11px] text-[#9AA3BF]">{labels.stage[zone.stage].levels}</span>
          </div>
          <div className="grid grid-cols-[3.8rem_repeat(4,minmax(0,1fr))] items-center justify-items-center gap-x-1 gap-y-2.5">
            <span />
            {['passed', 'failed'].map(outcome => (
              <span key={outcome} className="col-span-2 text-[10px] tracking-[0.14em] text-[#7A84A6]">
                {labels.outcome[outcome as 'passed' | 'failed'].label.toUpperCase()}
              </span>
            ))}
            <span />
            {Q_BOARD_COLUMNS.map(({ outcome, budget }) => (
              <span key={`${outcome}:${budget}`} className="text-[10px] text-[#5A6488]" title={`${labels.budget[budget].label}: ${labels.budget[budget].range}`}>
                {budget === 'more' ? '>½' : '≤½'}
              </span>
            ))}
            {zone.rows.map(({ mastery, tiles }) => [
              <span key={`${mastery}-label`} className="flex items-center gap-1.5 justify-self-start whitespace-nowrap text-[11px] text-[#D6DAE8]">
                <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: MASTERY_COLOR[mastery] }} aria-hidden />
                {labels.mastery[mastery].label}
              </span>,
              ...tiles.map(tile => (
                <Tile
                  key={tile.state}
                  row={tile}
                  labels={labels}
                  selected={selected === tile.state}
                  current={current === tile.state}
                  count={counts?.[tile.state] ?? 0}
                  onSelect={onSelect}
                />
              )),
            ])}
          </div>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-[#9AA3BF]">
      {(Object.keys(ACTION_STYLE) as RoutingAction[]).map(action => (
        <span key={action} className="flex items-center gap-1.5">
          <ActionIcon action={action} size="sm" />
          {ACTION_LABEL[action].label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-5 w-5 rounded-full border-2 border-dashed border-[#2A3352]" aria-hidden />
        Untrained: the plain move
      </span>
      <span className="text-[#5A6488]">· &gt;½ / ≤½: budget left · colour: what it tries first</span>
    </div>
  </div>
);

/** One state read out: the situation in words, and the row's whole order. */
export const QStateCard = ({
  row,
  labels,
  heading,
  taken,
  masked = [],
  takenCounts,
  details,
  controls,
}: {
  row: QGridRow;
  labels: QDimensionLabels;
  heading: ReactNode;
  /** The action a choice took; `plain` where the row ran out. */
  taken?: RoutingAction | 'plain' | null;
  /** The actions the routing FSM masked at that choice. */
  masked?: readonly RoutingAction[];
  /** The pool's count of each action taken here. */
  takenCounts?: Partial<Record<RoutingAction | 'plain', number>>;
  details?: ReactNode;
  controls?: ReactNode;
}) => (
  <div className="grid gap-3 rounded-xl border border-[#2A3352] bg-[#161C35] px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start" data-card={row.state}>
    <div className="min-w-0 space-y-2">
      <p className="font-display text-sm tracking-[0.1em] text-white">{heading}</p>
      <p className="text-xs text-[#9AA3BF]">{qStateWords(row, labels)}</p>
      {row.untrained ? (
        <p className="text-xs text-[#C7CCE0]" data-order-plain>
          Training never reached this situation, so the table has no order here: the game takes the plain move, nothing
          added.
          {takenCounts?.plain ? ` Taken ${takenCounts.plain} time${takenCounts.plain === 1 ? '' : 's'}.` : ''}
        </p>
      ) : (
        <>
          <p className="text-[11px] tracking-[0.12em] text-[#7A84A6]">THE ORDER IT TRIES · THE FIRST ALLOWED IS TAKEN</p>
          <ol className="flex flex-wrap gap-1.5" aria-label="The order this state tries">
            {row.order.map((action, index) => {
              const isTaken = taken === action || (taken === 'plain' && action === 'none');
              const isMasked = masked.includes(action);
              const count = takenCounts?.[action] ?? 0;
              return (
                <li
                  key={action}
                  data-order-action={action}
                  data-taken={isTaken || undefined}
                  data-masked={isMasked || undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs',
                    isTaken ? 'border-[#F4C524] bg-[#F4C524]/10 text-white' : 'border-[#2A3352] bg-[#0F1430] text-[#C7CCE0]',
                    isMasked && 'opacity-50'
                  )}
                >
                  <span className="tabular-nums text-[#7A84A6]">{index + 1}</span>
                  <ActionIcon action={action} size="sm" />
                  <span className={cn(isMasked && 'line-through')}>{ACTION_LABEL[action].label}</span>
                  {isMasked && <span className="text-[10px] text-[#9AA3BF]">not allowed here</span>}
                  {takenCounts && <span className={cn('tabular-nums', count ? 'font-semibold text-[#F4C524]' : 'text-[#5A6488]')}>×{count}</span>}
                </li>
              );
            })}
          </ol>
        </>
      )}
      {details}
    </div>
    {controls}
  </div>
);
