/**
 * Stepping a game board: Play's timer, and a step list that scrolls inside its
 * own box. Stepping never moves the page: the list keeps its row in view by
 * scrolling itself, and the board stays where it is. Play steps on by itself,
 * stops at the end, and stops at any other control.
 */
import { useEffect, useRef, useState } from 'react';

/** How long Play shows each step. */
export const PLAY_STEP_MS = 800;

/** Play: a step every `PLAY_STEP_MS`, stopping at the last. */
export const usePlayback = (position: number, last: number, onSelect: (position: number) => void) => {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (position >= last) setPlaying(false);
      else onSelect(position + 1);
    }, PLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, position, last, onSelect]);
  return [playing, setPlaying] as const;
};

/**
 * A list that keeps its row `position` in view by scrolling itself alone:
 * scrolling the row into view would move the page, and the board with it.
 * `rowIndex` maps a position to the list's child, where the list holds rows
 * that are not steps.
 */
export const useListScroll = <E extends HTMLElement>(position: number, rowIndex: (position: number) => number = at => at) => {
  const list = useRef<E>(null);
  const child = rowIndex(position);
  useEffect(() => {
    const box = list.current;
    const row = box?.children[child] as HTMLElement | undefined;
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
    }
  }, [child]);
  return list;
};
