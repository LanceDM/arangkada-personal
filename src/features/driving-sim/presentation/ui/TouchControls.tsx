/**
 * The on-screen controls of a touch device: a steering pad for the left thumb
 * and the pedals for the right. The horn has no pad: it is the keyboard's H
 * alone, since the only place it is graded is Level 8, where sounding it is
 * the mistake.
 *
 * Each pad follows its fingers rather than its buttons. A finger is captured
 * by the pad it lands on and reported on whichever control it is over as it
 * moves, so a thumb can rock from left to right, or from faster to the brake,
 * without lifting - and a finger that slides off every control lets go of it.
 * What a finger means for the car is `TouchInput`'s business; this only says
 * where the fingers are.
 *
 * Nothing here scrolls, zooms, selects or opens a menu: `touch-none` hands
 * every gesture on the pads to these handlers, and a long press is a held
 * control rather than a text selection.
 */
import { memo, useEffect, useRef, useSyncExternalStore, type ComponentType, type PointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { TouchControl, TouchInput } from '@/features/driving-sim/presentation/input/touchInput';
import { useText } from '@/shared/i18n/useText';
import type { Localized } from '@/shared/lib/localized';
import { driveMessages as m } from './messages';

interface PadControl {
  control: TouchControl;
  /** What a screen reader calls it. */
  label: Localized;
  /** The word under the icon. */
  caption: Localized;
  Icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Size and colour, as classes. */
  look: string;
  /** Classes for the pressed state. */
  pressed: string;
}

const STEERING: PadControl[] = [
  {
    control: 'left',
    label: m.steerLeft,
    caption: m.left,
    Icon: ArrowLeft,
    look: 'h-[clamp(64px,14vmin,108px)] w-[clamp(76px,16vmin,124px)] border-border bg-card/90 text-foreground',
    pressed: 'border-primary bg-primary/30',
  },
  {
    control: 'right',
    label: m.steerRight,
    caption: m.right,
    Icon: ArrowRight,
    look: 'h-[clamp(64px,14vmin,108px)] w-[clamp(76px,16vmin,124px)] border-border bg-card/90 text-foreground',
    pressed: 'border-primary bg-primary/30',
  },
];

const FASTER: PadControl = {
  control: 'throttle',
  label: m.fasterHint,
  caption: m.faster,
  Icon: ArrowUp,
  look: 'h-[clamp(56px,12vmin,92px)] w-[clamp(76px,16vmin,124px)] border-accent/50 bg-accent/15 text-foreground',
  pressed: 'border-accent bg-accent/40',
};

const BRAKE: PadControl = {
  control: 'brake',
  label: m.slowerHint,
  caption: m.brake,
  Icon: ArrowDown,
  look: 'h-[clamp(68px,15vmin,116px)] w-[clamp(76px,16vmin,124px)] border-destructive/50 bg-destructive/15 text-foreground',
  pressed: 'border-destructive bg-destructive/40',
};

const PadButton = ({ entry, held }: { entry: PadControl; held: boolean }) => {
  const say = useText();
  const { Icon } = entry;
  return (
    <div
      role="button"
      aria-label={say(entry.label)}
      aria-pressed={held}
      data-control={entry.control}
      data-pressed={held}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 shadow-lg transition-[transform,background-color] duration-75 ${entry.look} ${
        held ? `${entry.pressed} scale-95` : ''
      }`}
    >
      <Icon className="h-[45%] max-h-9 w-auto" aria-hidden />
      <span className="font-display text-[11px] font-black uppercase tracking-wider">{say(entry.caption)}</span>
    </div>
  );
};

/** One pad: the fingers that land on it, and the controls they are over. */
const ControlPad = ({
  input,
  label,
  className,
  children,
}: {
  input: TouchInput;
  label: Localized;
  className: string;
  children: ReactNode;
}) => {
  const say = useText();
  const padRef = useRef<HTMLDivElement>(null);

  /** The control under a point, by the pad's own buttons, so another layer over the pad cannot answer for it. */
  const controlAt = (x: number, y: number): TouchControl | null => {
    for (const button of padRef.current?.querySelectorAll<HTMLElement>('[data-control]') ?? []) {
      const box = button.getBoundingClientRect();
      if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
        return button.dataset.control as TouchControl;
      }
    }
    return null;
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    // Captured, so the pad hears this finger wherever it goes until it lifts.
    // A browser that refuses the capture still gets the press: a missed press
    // is worse than a slide the pad cannot follow.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Not capturable here; tracked without it.
    }
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-control]');
    input.press(
      event.pointerId,
      button ? (button.dataset.control as TouchControl) : controlAt(event.clientX, event.clientY)
    );
  };

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!input.tracks(event.pointerId)) return;
    input.move(event.pointerId, controlAt(event.clientX, event.clientY));
  };

  const onUp = (event: PointerEvent<HTMLDivElement>) => input.lift(event.pointerId);

  return (
    <div
      ref={padRef}
      role="group"
      aria-label={say(label)}
      className={`touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] ${className}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={event => event.preventDefault()}
    >
      {children}
    </div>
  );
};

/** Re-renders a pad when a finger lands, moves between controls or lifts, and at no other time. */
const useHeld = (input: TouchInput) => {
  useSyncExternalStore(input.subscribe, input.getVersion, input.getVersion);
  return (control: TouchControl) => input.holds(control);
};

/**
 * Lets go of every finger when the page stops being looked at, or the pads go
 * away: a system gesture or an app switch need not deliver the lift.
 */
const useLiftOnLeave = (input: TouchInput) => {
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') input.liftAll();
    };
    const liftAll = () => input.liftAll();
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', liftAll);
    window.addEventListener('blur', liftAll);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', liftAll);
      window.removeEventListener('blur', liftAll);
      input.liftAll();
    };
  }, [input]);
};

export const SteeringPad = memo(({ input }: { input: TouchInput }) => {
  const held = useHeld(input);
  useLiftOnLeave(input);
  return (
    <ControlPad input={input} label={m.steering} className="flex items-end gap-3">
      {STEERING.map(entry => (
        <PadButton key={entry.control} entry={entry} held={held(entry.control)} />
      ))}
    </ControlPad>
  );
});
SteeringPad.displayName = 'SteeringPad';

export const PedalPad = memo(({ input }: { input: TouchInput }) => {
  const held = useHeld(input);
  return (
    <ControlPad input={input} label={m.speed} className="flex flex-col items-center gap-3">
      <PadButton entry={FASTER} held={held('throttle')} />
      <PadButton entry={BRAKE} held={held('brake')} />
    </ControlPad>
  );
});
PedalPad.displayName = 'PedalPad';
