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
import { TouchInput } from '@/features/driving-sim/presentation/input/touchInput';
import { useDrivingSimulation, type DrivingSimulation } from './useDrivingSimulation';
import { memoryAssessments, memoryBackground, memoryStudyLogs, memoryCompetencyCourse, memoryCourseStore } from '@/features/driving-sim/application/testDependencies';

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
  quizBank: { load: async () => ({ items: [], settings: null }) },
  quizSittings: { save: async () => {} },
  routingMode: 'legacy',
  routing: { loadAssignment: async () => null, loadCursor: async () => null, saveCursor: async () => {} },
  routingOverride: { load: () => 'assigned', save: () => {} },
  competencyCourse: memoryCompetencyCourse(memoryCourseStore()),
  assessments: memoryAssessments(memoryCourseStore()),
  background: memoryBackground(memoryCourseStore()),
  ...memoryStudyLogs(memoryCourseStore()),
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
    /** Runs everything currently scheduled, once per frame, `interval` ms apart. */
    tick(frames = 1, interval = 16) {
      for (let i = 0; i < frames; i++) {
        const due = pending;
        pending = new Map();
        time += interval;
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
  touch,
  expose,
}: {
  keys: Set<string>;
  onComplete: (result: LevelResult, telemetry: LevelFsmTelemetry) => void;
  drivenLevel?: LevelConfig;
  report?: (snapshot: DrivingSnapshot) => void;
  touch?: TouchInput;
  expose?: (simulation: DrivingSimulation) => void;
}) => {
  const fsmRef = useRef<DrivingFSM | null>(null);
  fsmRef.current ??= new DrivingFSM();
  const fsm = fsmRef.current;
  const keysRef = useRef(keys);

  const evaluation = useScenarioEvaluation({ fsm });
  const simulation = useDrivingSimulation({
    level: drivenLevel,
    onComplete,
    fsm,
    keysRef,
    touch,
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

  report?.(simulation.snapshot);
  expose?.(simulation);
  return <canvas ref={simulation.canvasRef} width={460} height={700} />;
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
  /** The hook's latest return, for a test that acts as the screen does. */
  let drive: DrivingSimulation | null = null;

  const mount = (
    keys = new Set<string>(),
    onComplete = vi.fn(),
    drivenLevel: LevelConfig = level,
    touch?: TouchInput
  ) => {
    latest = null;
    drive = null;
    act(() => {
      root.render(
        <StrictMode>
          <Harness
            keys={keys}
            onComplete={onComplete}
            drivenLevel={drivenLevel}
            touch={touch}
            report={snapshot => {
              latest = snapshot;
            }}
            expose={simulation => {
              drive = simulation;
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

  describe('by touch', () => {
    it('acts on a press in the very next frame, as a key does', () => {
      const touch = new TouchInput();
      mount(new Set(), vi.fn(), level, touch);
      act(() => clock.tick());
      const before = latest!.targetSpeed;

      touch.press(1, 'throttle');
      act(() => clock.tick());

      expect(latest!.targetSpeed).toBeGreaterThan(before);
    });

    it('acts on a tap that lifted before the frame came', () => {
      const touch = new TouchInput();
      mount(new Set(), vi.fn(), level, touch);
      act(() => clock.tick());
      const before = latest!.targetSpeed;

      touch.press(1, 'throttle');
      touch.lift(1);
      act(() => clock.tick());

      expect(latest!.targetSpeed).toBeGreaterThan(before);
    });

    it('releases the drive from a briefing with every finger then down ignored until lifted', () => {
      const touch = new TouchInput();
      const keys = new Set<string>();
      // Level 3 opens with a stop sign, which is read before it is driven.
      mount(keys, vi.fn(), LEVELS.find(entry => entry.id === 3)!, touch);
      // The throttle is a setting raised a tap at a time: tap it up to speed.
      for (let tap = 0; tap < 8; tap++) {
        keys.add('ArrowUp');
        act(() => clock.tick());
        keys.delete('ArrowUp');
        act(() => clock.tick());
      }
      const frame = driveUntil(() => latest?.briefingEvent != null, 3000);
      expect(frame, 'the drive never reached a briefing').toBeGreaterThan(0);

      // A thumb resting on the brake while the scenario is read.
      touch.press(1, 'brake');
      act(() => drive!.dismissBriefing());
      act(() => clock.tick());
      const released = latest!.speed;
      act(() => clock.tick(10));
      expect(latest!.speed).toBeGreaterThanOrEqual(released);

      // A fresh press brakes.
      touch.lift(1);
      touch.press(2, 'brake');
      act(() => clock.tick(10));
      expect(latest!.speed).toBeLessThan(released);
    });

    it('records the drive as played by touch', () => {
      const touch = new TouchInput();
      const onComplete = vi.fn();
      mount(new Set(), onComplete, crashLevel, touch);
      touch.press(1, 'throttle');
      touch.press(2, 'right');
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const frame = driveUntil(() => Boolean(latest?.crashed));
        expect(frame, 'the drive never hit the road closure').toBeGreaterThan(0);
        act(() => vi.advanceTimersByTime(CRASH_HOLD_MS + 50));
      } finally {
        vi.useRealTimers();
      }
      expect(onComplete).toHaveBeenCalledTimes(1);
      const play = onComplete.mock.calls[0][2];
      expect(play).toMatchObject({ input: 'touch', touchControls: false, lostMs: 0, pauses: 0 });
      expect(play.steps).toBeGreaterThan(0);
    });
  });

  describe('the world runs at real time on every display', () => {
    const progressAfter = (frames: number, interval: number) => {
      mount(new Set(['ArrowUp']));
      act(() => clock.tick(frames, interval));
      return latest!.progress;
    };

    it('drives exactly as it always has at 60 Hz: one step per frame', () => {
      const keys = new Set(['ArrowUp']);
      mount(keys);
      act(() => clock.tick(30));
      const afterThirty = latest!.progress;
      act(() => root.unmount());
      root = createRoot(container);
      mount(keys);
      for (let frame = 0; frame < 30; frame++) act(() => clock.tick(1, 1000 / 60));
      expect(latest!.progress).toBe(afterThirty);
    });

    it('covers the same road in the same time at 120 Hz and at 30 fps', () => {
      const sixty = progressAfter(120, 1000 / 60);
      act(() => root.unmount());
      root = createRoot(container);
      const oneTwenty = progressAfter(240, 1000 / 120);
      act(() => root.unmount());
      root = createRoot(container);
      const thirty = progressAfter(60, 1000 / 30);

      expect(oneTwenty).toBeCloseTo(sixty, 2);
      expect(thirty).toBeCloseTo(sixty, 2);
    });
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
