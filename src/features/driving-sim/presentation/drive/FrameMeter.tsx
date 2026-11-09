/**
 * A small readout of how the device is keeping up, shown only when the page's
 * address carries `?perf`: the way to check a real phone or tablet, where
 * there is no developer console, before it is used for the pilot.
 *
 * Reads the drive's own frame record twice a second and nothing else, so it
 * costs the drive nothing it would notice.
 */
import { useEffect, useState, type RefObject } from 'react';
import { medianFrameRate, type FrameStats } from './frameSteps';

interface Reading {
  fps: number | null;
  stepsPerSecond: number;
  slowShare: number;
  lostMs: number;
  pauses: number;
}

const FrameMeter = ({ stats }: { stats: RefObject<FrameStats> }) => {
  const [reading, setReading] = useState<Reading | null>(null);

  useEffect(() => {
    let previous = { at: performance.now(), steps: stats.current.steps, frames: stats.current.frames, slow: stats.current.slowFrames };
    const timer = setInterval(() => {
      const now = performance.now();
      const current = stats.current;
      const seconds = (now - previous.at) / 1000;
      const frames = current.frames - previous.frames;
      setReading({
        fps: medianFrameRate(current),
        stepsPerSecond: Math.round((current.steps - previous.steps) / seconds),
        slowShare: frames > 0 ? (current.slowFrames - previous.slow) / frames : 0,
        lostMs: Math.round(current.lostMs),
        pauses: current.pauses,
      });
      previous = { at: now, steps: current.steps, frames: current.frames, slow: current.slowFrames };
    }, 500);
    return () => clearInterval(timer);
  }, [stats]);

  if (!reading) return null;
  return (
    <div
      className="pointer-events-none fixed left-2 top-2 z-[100] rounded bg-black/75 px-2 py-1 font-mono text-[11px] leading-4 text-lime-300"
      data-testid="frame-meter"
    >
      <div>display {reading.fps ?? '–'} fps</div>
      <div>world {reading.stepsPerSecond} steps/s</div>
      <div>behind {Math.round(reading.slowShare * 100)}% of frames</div>
      <div>
        lost {reading.lostMs} ms · paused {reading.pauses}
      </div>
    </div>
  );
};

export default FrameMeter;
