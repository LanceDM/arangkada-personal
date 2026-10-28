// @vitest-environment jsdom
/**
 * The drive, mounted for real: React, a canvas and an animation frame.
 *
 * The session and render goldens pin what a drive computes and what it paints,
 * but neither mounts a component, so neither could see the canvas go blank in
 * development. Strict Mode runs every effect setup -> cleanup -> setup, and a
 * cleanup that permanently retires the session leaves the second setup driving
 * a dead one: `update()` returns immediately, no frame is ever composed and
 * nothing reaches the canvas.
 *
 * These tests own that lifecycle. `requestAnimationFrame` is driven by hand so
 * a frame is an assertion rather than a wait.
 */
import { StrictMode, useRef } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { AuthoredEvent, LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { CRASH_HOLD_MS, type DrivingSnapshot } from '@/features/driving-sim/application/session/DrivingSession';
import type { LevelResult } from '@/domain/learner/attempt';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import { recordingCanvasContext } from '@/features/driving-sim/presentation/canvas/rendering/recordingCanvas';
import { provideDrivingSimDependencies } from '@/features/driving-sim/application/dependencies';
import { useScenarioEvaluation } from '@/features/driving-sim/application/useScenarioEvaluation';
import { useDrivingSimulation } from './useDrivingSimulation';
import { memoryAssessments, memoryBackground, memoryCompetencyCourse, memoryCourseStore } from '@/features/driving-sim/application/testDependencies';

/** Stands in for `app/dependencies`, which a mounted drive expects to have run. */
provideDrivingSimDependencies({
  learnerHistory: { load: async () => ({ source: 'local', attempts: [] }) },
  storyAttempts: {
    save: async () => 'test-attempt',
    saveFsmTelemetry: async () => {},
    saveDecisionTelemetry: async () => {},
    saveRoutingTelemetry: async () => {},
  },
  signCoverage: { load: () => ({}), record: () => {} },
  briefingProgress: { load: () => ({}), save: () => {}, markLessonsRead: () => {} },
  routingMode: 'legacy',
  routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
  routingOverride: { load: () => 'assigned', save: () => {} },
  competencyCourse: memoryCompetencyCourse(memoryCourseStore()),
  assessments: memoryAssessments(memoryCourseStore()),
  background: memoryBackground(memoryCourseStore()),
  optimizedRouting: async () => {
    throw new Error('no drive here reads the routing table');
  },
});

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const level = LEVELS.find(entry => entry.id === 1)!;

/**
 * The same level with a road closure across it and no pre-drive stage, so a
 * driver holding the throttle hits something at a known frame. Used for the
 * one thing only a real crash can set up: a completion that is genuinely
 * waiting on a timer when the screen goes away.
 */
const crashLevel: LevelConfig = {
  ...level,
  garage: undefined,
  roadLength: 6000,
  events: [
    {
      id: 'test.road-closed',
      triggerAtDistance: 260,
      type: 'obstacle_ahead',
      description: '',
      correctAction: 'brake',
      points: 10,
      penaltyMessage: '',
      rewardMessage: '',
      duration: 3000,
      sign: { name: 'Road Works', category: 'W. Warning Sign', meaning: '', art: 'diamond' },
      scene: 'roadwork',
    } satisfies AuthoredEvent,
  ],
};

/** Hand-driven `requestAnimationFrame`: a frame happens when a test says so. */
const frameClock = () => {
  let nextHandle = 1;
  let pending = new Map<number, FrameRequestCallback>();
  let time = 0;

  const raf = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle++;
    pending.set(handle, callback);
    return handle;
  });
  const cancel = vi.fn((handle: number) => {
    pending.delete(handle);
  });

  return {
    raf,
    cancel,
    get scheduled() {
      return pending.size;
    },
    /** Runs everything currently scheduled, once. */
    tick(frames = 1) {
      for (let i = 0; i < frames; i++) {
        const due = pending;
        pending = new Map();
        time += 16;
        for (const callback of due.values()) callback(time);
      }
    },
  };
};

/**
 * The smallest thing that is still the real drive: the same hooks GameScreen
 * uses, a canvas, and nothing else. Keeping the UI out means a failure here is
 * the lifecycle rather than a component.
 */
const Harness = ({
  keys,
  onComplete,
  drivenLevel = level,
  report,
}: {
  keys: Set<string>;
  onComplete: (result: LevelResult, telemetry: LevelFsmTelemetry) => void;
  drivenLevel?: LevelConfig;
  report?: (snapshot: DrivingSnapshot) => void;
}) => {
  const fsmRef = useRef<DrivingFSM | null>(null);
  fsmRef.current ??= new DrivingFSM();
  const fsm = fsmRef.current;
  const keysRef = useRef(keys);

  const evaluation = useScenarioEvaluation({ fsm });
  const { canvasRef, snapshot } = useDrivingSimulation({
    level: drivenLevel,
    onComplete,
    fsm,
    keysRef,
    // The test owns the key set, so the drive must not take it away when it
    // releases a frozen panel. The real host hands `useKeyboard`'s own
    // suppression in here; what it does is that hook's business, not this
    // lifecycle's.
    releaseHeldKeys: () => {},
    scoreRef: evaluation.scoreRef,
    logsRef: evaluation.logsRef,
    tracesRef: evaluation.tracesRef,
    signOutcomesRef: evaluation.signOutcomesRef,
    violationsRef: evaluation.violationsRef,
    correctRef: evaluation.correctRef,
    evaluateAction: evaluation.evaluateAction,
    support: 'full',
  });

  report?.(snapshot);
  return <canvas ref={canvasRef} width={460} height={700} />;
};

describe('the drive, mounted under Strict Mode', () => {
  let clock: ReturnType<typeof frameClock>;
  let recorder: ReturnType<typeof recordingCanvasContext>;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    clock = frameClock();
    vi.stubGlobal('requestAnimationFrame', clock.raf);
    vi.stubGlobal('cancelAnimationFrame', clock.cancel);

    // jsdom has no 2D context. The op recorder the render golden already uses
    // stands in, so "was a frame painted" is a fact about the op stream.
    recorder = recordingCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      recorder.ctx as unknown as RenderingContext
    );

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  /** The latest snapshot the drive projected, so a test can watch the car. */
  let latest: DrivingSnapshot | null = null;

  const mount = (
    keys = new Set<string>(),
    onComplete = vi.fn(),
    drivenLevel: LevelConfig = level
  ) => {
    latest = null;
    act(() => {
      root.render(
        <StrictMode>
          <Harness
            keys={keys}
            onComplete={onComplete}
            drivenLevel={drivenLevel}
            report={snapshot => {
              latest = snapshot;
            }}
          />
        </StrictMode>
      );
    });
  };

  /**
   * Runs frames until `done`, or gives up. Returns the frame it stopped on.
   *
   * Nothing is acknowledged along the way, and nothing needs to be: an ordinary
   * road event never stops the world, so a drive left to itself keeps driving.
   */
  const driveUntil = (done: () => boolean, limit = 600) => {
    for (let frame = 0; frame < limit; frame++) {
      act(() => clock.tick());
      if (done()) return frame;
    }
    return -1;
  };

  it('paints a frame after Strict Mode has replayed the effects', () => {
    mount();
    // Strict Mode has already run setup -> cleanup -> setup by now. If cleanup
    // retired the session, this frame finds nothing to paint.
    act(() => clock.tick());

    expect(recorder.recording().ops.length).toBeGreaterThan(0);
  });

  it('keeps painting across many frames', () => {
    mount();
    act(() => clock.tick());
    const afterFirst = recorder.recording().ops.length;

    act(() => clock.tick(10));

    expect(recorder.recording().ops.length).toBeGreaterThan(afterFirst);
  });

  it('leaves the session drivable, so held keys actually move the car', () => {
    mount(new Set<string>(['ArrowUp']));
    const start = latest!;

    act(() => clock.tick(60));

    // The car's own state, not a canvas operation: `translate` is emitted while
    // painting the road whether or not the world advanced a millimetre, so it
    // cannot tell a live session from one a Strict Mode cleanup retired.
    expect(latest!.speed).toBeGreaterThan(start.speed);
    expect(latest!.progress).toBeGreaterThan(start.progress);
    expect(clock.scheduled).toBeGreaterThan(0);
  });

  it('stops scheduling work once unmounted', () => {
    mount();
    act(() => clock.tick(3));

    act(() => root.unmount());
    const afterUnmount = recorder.recording().ops.length;

    expect(clock.scheduled).toBe(0);
    act(() => clock.tick(5));
    expect(recorder.recording().ops.length).toBe(afterUnmount);
  });

  describe('a completion still waiting on the crash hold', () => {
    beforeEach(() => {
      // Only the timers: `requestAnimationFrame` is already hand-driven above,
      // and faking it here would take the frame clock away from the test.
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const crash = (onComplete: Mock) => {
      // Right as well as up: the closure shuts the curb lane, so a car driving
      // straight down the lane the sign sends it to now passes it cleanly —
      // which is the point of the closure's geometry. Reaching it takes a
      // driver who steers at it.
      mount(new Set<string>(['ArrowUp', 'ArrowRight']), onComplete, crashLevel);
      const frame = driveUntil(() => Boolean(latest?.crashed));
      // Guards the two tests below: without a real crash there is no pending
      // completion, and both would pass while proving nothing.
      expect(frame, 'the drive never hit the road closure').toBeGreaterThan(0);
      expect(onComplete).not.toHaveBeenCalled();
    };

    it('is reported once the hold elapses', () => {
      const onComplete = vi.fn();
      crash(onComplete);

      act(() => vi.advanceTimersByTime(CRASH_HOLD_MS + 50));

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('is cancelled if the screen goes first', () => {
      const onComplete = vi.fn();
      crash(onComplete);

      act(() => root.unmount());
      act(() => vi.advanceTimersByTime(CRASH_HOLD_MS * 4));

      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
