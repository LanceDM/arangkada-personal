import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';

interface QuestionTimerProps {
  /** Seconds the question allows. */
  limitSec: number;
  /** Held while the answer plays out, or while another panel holds the drive. */
  paused: boolean;
  /** Called once, when the time runs out unanswered. */
  onExpire: () => void;
}

/**
 * The in-drive question's clock (TENTATIVE 30 s): a bar above the prompt that
 * empties as time runs. Running out fails the scenario without updating BKT.
 * Keyed by the event by its parent, so each question starts a fresh clock.
 */
const QuestionTimer = ({ limitSec, paused, onExpire }: QuestionTimerProps) => {
  const limitMs = limitSec * 1000;
  const [leftMs, setLeftMs] = useState(limitMs);
  const leftRef = useRef(limitMs);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (paused || expiredRef.current) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      leftRef.current = Math.max(0, leftRef.current - (now - last));
      last = now;
      setLeftMs(leftRef.current);
      if (leftRef.current <= 0) {
        expiredRef.current = true;
        onExpireRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const share = leftMs / limitMs;
  const seconds = Math.ceil(leftMs / 1000);
  const urgent = seconds <= 5;

  return (
    <div
      role="timer"
      aria-label={`${seconds} seconds left to answer`}
      className="pointer-events-none fixed left-1/2 top-3 z-[200] w-[min(320px,calc(100vw-32px))] -translate-x-1/2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg"
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Timer className="h-3.5 w-3.5" />
          Time to answer
        </span>
        <span className={urgent ? 'text-destructive' : 'text-foreground'}>{paused && seconds > 0 ? 'held' : `${seconds} s`}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${urgent ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
};

export default QuestionTimer;
