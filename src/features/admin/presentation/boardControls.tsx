/**
 * The pieces every game-board replay in the admin area shares: the HUD over
 * the board, the chips on a step's card, the step controls with Play, and the
 * arrow keys. Play's timer and the step list's scrolling are `useBoardStepping`'s.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { cn } from '@/shared/ui/cn';

const SEGMENTS = 24;

/** A board's frame where there is nothing to step: the same dark game screen. */
export const BoardScreen = ({ children }: { children: ReactNode }) => (
  <div className="min-w-0 space-y-3 rounded-2xl border border-[#232B47] bg-[#10152A] p-3">{children}</div>
);

/** The board's frame: a dark game screen in either theme, which steps on the arrow keys and plays on space. */
export const GameScreen = ({
  label,
  position,
  last,
  onSelect,
  onTogglePlay,
  children,
}: {
  label: string;
  position: number;
  last: number;
  onSelect: (position: number) => void;
  onTogglePlay: () => void;
  children: ReactNode;
}) => (
  <div
    className="min-w-0 space-y-3 rounded-2xl border border-[#232B47] bg-[#10152A] p-3"
    tabIndex={0}
    aria-label={label}
    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight') onSelect(Math.min(last, position + 1));
      else if (event.key === 'ArrowLeft') onSelect(Math.max(0, position - 1));
      else if (event.key === ' ') onTogglePlay();
      else return;
      event.preventDefault();
    }}
  >
    {children}
  </div>
);

export const BoardHud = ({
  label = 'STEP',
  position,
  total,
  time,
  toggle,
}: {
  label?: string;
  position: number;
  total: number;
  /** The step's time, as the board shows it. */
  time: string;
  /** A switch at the end of the HUD, such as Full table. */
  toggle?: { label: string; on: boolean; onChange: (on: boolean) => void };
}) => {
  const filled = total === 0 ? 0 : Math.round(((position + 1) / total) * SEGMENTS);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] tracking-[0.14em] text-[#9AA3BF]">
      <span className="font-display" aria-live="polite">
        {label} <b className="text-[15px] font-medium text-[#F4C524]">{total === 0 ? 0 : position + 1}</b> / {total}
      </span>
      <div className="flex min-w-[8rem] flex-1 gap-[3px]" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <i key={index} className={cn('h-1.5 flex-1 rounded-sm', index < filled ? 'bg-[#F4C524]' : 'bg-[#232B47]')} />
        ))}
      </div>
      <span className="font-display tabular-nums">{time}</span>
      {toggle && (
        <button
          type="button"
          role="switch"
          aria-checked={toggle.on}
          onClick={() => toggle.onChange(!toggle.on)}
          className="flex items-center gap-2 rounded-full border border-[#2A3352] px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-[#C7CCE0] hover:border-[#3E4766] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4C524]"
        >
          <span className={cn('relative h-3.5 w-6 rounded-full transition-colors', toggle.on ? 'bg-[#F4C524]' : 'bg-[#2A3352]')}>
            <span className={cn('absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all', toggle.on ? 'left-3' : 'left-0.5')} />
          </span>
          {toggle.label}
        </button>
      )}
    </div>
  );
};

export const BoardChip = ({ label, value }: { label: string; value: ReactNode }) => (
  <span className="rounded-lg border border-[#2A3352] bg-[#0F1430] px-2 py-0.5 text-xs text-[#9AA3BF]">
    {label} <b className="font-medium text-[#D6DAE8]">{value}</b>
  </span>
);

const ControlButton = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#34406B] bg-[#1F2748] text-[#D6DAE8] transition-colors hover:bg-[#28325A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F4C524] disabled:opacity-35"
  >
    {children}
  </button>
);

/** First, Previous, Play, Next and Last. Any control but Play stops Play. */
export const StepControls = ({
  position,
  last,
  playing,
  onSelect,
  onPlay,
  noun = 'step',
}: {
  position: number;
  last: number;
  playing: boolean;
  onSelect: (position: number) => void;
  onPlay: (play: boolean) => void;
  noun?: string;
}) => {
  const go = (to: number) => {
    onPlay(false);
    onSelect(Math.max(0, Math.min(last, to)));
  };
  return (
    <div className="flex gap-1.5">
      <ControlButton label={`First ${noun}`} onClick={() => go(0)} disabled={position <= 0}>
        <SkipBack className="h-4 w-4" />
      </ControlButton>
      <ControlButton label={`Previous ${noun}`} onClick={() => go(position - 1)} disabled={position <= 0}>
        <ChevronLeft className="h-4 w-4" />
      </ControlButton>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={() => {
          if (!playing && position >= last) onSelect(0);
          onPlay(!playing);
        }}
        disabled={last <= 0}
        className="font-display flex h-9 items-center gap-1.5 rounded-[10px] border border-[#F4C524] bg-[#F4C524] px-3.5 text-xs font-medium tracking-[0.1em] text-[#10152A] transition-colors hover:bg-[#F7D24F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {playing ? 'PAUSE' : 'PLAY'}
      </button>
      <ControlButton label={`Next ${noun}`} onClick={() => go(position + 1)} disabled={position >= last}>
        <ChevronRight className="h-4 w-4" />
      </ControlButton>
      <ControlButton label={`Last ${noun}`} onClick={() => go(last)} disabled={position >= last}>
        <SkipForward className="h-4 w-4" />
      </ControlButton>
    </div>
  );
};
