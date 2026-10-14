import { useEffect, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';

/**
 * Canvas stages have a fixed drawing buffer that is taller than a laptop
 * viewport once browser chrome is subtracted. This measures the slot the layout
 * gives the stage and returns the scale that keeps the whole board -- and every
 * overlay pinned to it -- visible without page scrolling.
 *
 * The frame is tracked by callback ref rather than useRef so a stage that mounts
 * later (the road board appearing after a pre-drive stage) is still measured.
 */
export const useStageScale = (
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
  options?: {
    /**
     * Measure the slot's height only. Needed when the slot's width is set by
     * the stage it contains, where folding that width into the result would
     * feed the scale back into itself and never settle.
     *
     * The *viewport's* width is still a bound, because it is not downstream of
     * the scale and so cannot feed back. Without it a 460px board sat at full
     * size in a 337px window and the right-hand side of the road — the
     * acceleration lane, the divider and the player's own car — was simply cut
     * off the screen.
     */
    heightOnly?: boolean;
  }
) => {
  const heightOnly = options?.heightOnly ?? false;
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!frame) return;

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      if (!rect.height || (!heightOnly && !rect.width)) return;
      // A little off the window so the board never sits hard against the edge.
      const roomAcross = Math.max(0, window.innerWidth - 12) / width;
      const next = heightOnly
        ? Math.min(1, rect.height / height, roomAcross)
        : Math.min(1, rect.width / width, rect.height / height);
      setScale(Math.max(0.45, Number(next.toFixed(3))));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    // The window's own width is one of the bounds, and a window can be resized
    // without the slot's box changing at all.
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [frame, width, height, heightOnly]);

  return { frameRef: setFrame, scale };
};
