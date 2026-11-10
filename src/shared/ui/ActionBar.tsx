import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * A screen's primary action, pinned to the bottom of the viewport while the
 * screen above it scrolls, so a long screen on a phone never leaves its
 * button behind. It stays in the flow, so on a screen short enough to need no
 * scrolling it simply sits under the content.
 *
 * Sticky positioning pins to the nearest scrolling ancestor: an ancestor with
 * `overflow: hidden` becomes that ancestor and nothing pins, so a rounded card
 * around one clips with `overflow-clip` instead. The bottom padding clears a
 * phone's home indicator (`env(safe-area-inset-bottom)`).
 *
 * `className` gives the bar the background of the surface it sits on and the
 * negative margin that runs it to that surface's edges.
 */
export const ActionBar = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    data-action-bar=""
    className={cn(
      'sticky bottom-0 z-10 space-y-2 border-t border-border/50 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      className
    )}
  >
    {children}
  </div>
);
