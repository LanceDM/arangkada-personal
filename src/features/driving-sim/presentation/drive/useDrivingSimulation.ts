/**
 * The bridge between a `DrivingSession` and the browser.
 *
 * Presentation, not application: this is the only thing in the drive that
 * knows a canvas and an animation frame exist. The session below it is
 * headless, and this is what gives it a screen.
 *
 * It owns four things and no more: the animation frame, the keyboard, painting
 * the frame the session composed, and the timers behind the two brief notices.
 * What a frame's reports *mean* - scoring, the mastery estimate, the finished
 * result - belongs to `driveController`, which knows none of the above.
 *
 * The screen is re-rendered only when something it shows actually changed
 * (`snapshotChanged`). The canvas keeps painting every frame regardless, which
 * is the point of separating the two.
 *
 * The host owns the drive's lifetime, and every effect here has to survive
 * Strict Mode's setup -> cleanup -> setup replay: teardown cancels the frame
 * and the timers, and the next setup puts them back.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { SupportLevel } from '@/domain/learner/competency';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { drawVisibilityVeil } from '@/features/driving-sim/presentation/canvas/rendering/renderers/roadRenderer';
import { renderFrame } from '@/features/driving-sim/presentation/canvas/rendering/renderFrame';
import { readInput } from '@/features/driving-sim/presentation/input/keyboardInput';
import { loadSignCoverage } from '@/features/driving-sim/application/signCoverage';
import {
  createDriveController,
  type DriveController,
} from '@/features/driving-sim/application/session/driveController';
import {
  createDrivingSession,
  snapshotChanged,
  type DrivingSnapshot,
} from '@/features/driving-sim/application/session/DrivingSession';
import type { useFSM } from '@/features/driving-sim/application/useFSM';
import type { useScenarioEvaluation } from '@/features/driving-sim/application/useScenarioEvaluation';

/** How long the stage shakes after rough ground throws the car about. */
const JOLT_MS = 450;

interface UseDrivingSimulationOptions {
  level: LevelConfig;
  onComplete: (result: LevelResult, telemetry: LevelFsmTelemetry) => void;
  fsm: ReturnType<typeof useFSM>['fsm'];
  keysRef: RefObject<Set<string>>;
  scoreRef: ReturnType<typeof useScenarioEvaluation>['scoreRef'];
  logsRef: ReturnType<typeof useScenarioEvaluation>['logsRef'];
  tracesRef: ReturnType<typeof useScenarioEvaluation>['tracesRef'];
  signOutcomesRef: ReturnType<typeof useScenarioEvaluation>['signOutcomesRef'];
  violationsRef: ReturnType<typeof useScenarioEvaluation>['violationsRef'];
  correctRef: ReturnType<typeof useScenarioEvaluation>['correctRef'];
  evaluateAction: ReturnType<typeof useScenarioEvaluation>['evaluateAction'];
  /**
   * Drops whatever is held on the keyboard right now, so releasing the drive
   * from a frozen panel never applies a key the player was leaning on while
   * reading. Owned by `useKeyboard`, which is the only thing that knows what is
   * down. See `releaseHeldKeys`.
   */
  releaseHeldKeys: () => void;
  /** Held false while a pre-drive stage is running, so the drive stays idle. */
  enabled?: boolean;
  /**
   * The learner's graded history before this attempt, oldest first, which the
   * live mastery estimate reads ahead of the run's own logs. Taken once per
   * mounted drive, as the session is.
   */
  priorLogs?: readonly ActionLog[];
  /**
   * Road distance the drive starts from. Dev-only: lets the scenario harness
   * start just before a chosen event rather than replaying the whole route.
   */
  initialDistance?: number;
  /**
   * The support level h this level entry is played at, which decides whether
   * the road marks the response being graded, as it decides the briefing and
   * the prompt. Taken once per mounted drive, as the session is.
   */
  support: SupportLevel;
  /**
   * Whether the drive re-rolls its route toward a weak competency as it goes:
   * Legacy's game does, the routing FSM's groups do not. Taken once
   * per mounted drive.
   */
  liveReroll?: boolean;
}

export interface DrivingSimulation {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** What the screen shows. Replaced only when one of its values changes. */
  snapshot: DrivingSnapshot;
  /** Briefly true when rough ground has thrown the car about. */
  jolted: boolean;
  answerInspection: (action: string) => void;
  answerCutscene: (action: string) => void;
  playParking: (action: string) => void;
  playRightOfWay: (action: string) => void;
  /** Player has read the scenario and released the drive. */
  /** Player acknowledged that the route ahead was adapted. */
  dismissAdaptationNotice: () => void;
  /** Player has read the scenario held in front of them. Idempotent. */
  dismissBriefing: () => void;
}

export const useDrivingSimulation = ({
  level,
  onComplete,
  fsm,
  keysRef,
  scoreRef,
  logsRef,
  tracesRef,
  signOutcomesRef,
  violationsRef,
  correctRef,
  evaluateAction,
  releaseHeldKeys,
  enabled = true,
  initialDistance,
  priorLogs,
  support,
  liveReroll = true,
}: UseDrivingSimulationOptions): DrivingSimulation => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // One session per mounted drive. `GameScreen` is keyed per attempt, so a
  // retry mounts a fresh one rather than reusing this.
  const [session] = useState(() =>
    createDrivingSession({ level, fsm, initialDistance, signCoverage: loadSignCoverage(), support })
  );
  const [history] = useState(() => priorLogs ?? []);
  const [rerollsLive] = useState(liveReroll);

  const [snapshot, setSnapshot] = useState<DrivingSnapshot>(() => session.getSnapshot());
  const [jolted, setJolted] = useState(false);

  /**
   * Everything the host has scheduled but not yet run, and whether it is still
   * attached to a live screen.
   *
   * Strict Mode replays every effect as setup -> cleanup -> setup, so teardown
   * state has to be *restored by setup* rather than latched by cleanup. A
   * one-way "this drive is over" flag survives the replay and leaves the second
   * setup driving something already retired, which is what used to leave the
   * canvas blank in development.
   */
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const liveRef = useRef(true);

  /** A timeout that a teardown takes back, and that never fires into a dead screen. */
  const schedule = useCallback((run: () => void, delay: number) => {
    const timers = timersRef.current;
    const id = setTimeout(() => {
      timers.delete(id);
      if (liveRef.current) run();
    }, delay);
    timers.add(id);
  }, []);

  useEffect(() => {
    liveRef.current = true;
    const timers = timersRef.current;
    return () => {
      liveRef.current = false;
      for (const id of timers) clearTimeout(id);
      timers.clear();
    };
  }, []);

  /** Snapshot the run's totals the moment it ends. */
  const totals = useCallback(
    (extraViolations = 0) => ({
      score: scoreRef.current,
      violations: violationsRef.current + extraViolations,
      correctActions: correctRef.current,
      logs: logsRef.current,
      signOutcomes: signOutcomesRef.current,
    }),
    [correctRef, logsRef, scoreRef, signOutcomesRef, violationsRef]
  );

  /**
   * The controller, built when the drive is set up and dropped on teardown.
   *
   * Built in an effect rather than during render for the same reason every
   * other resource here is: Strict Mode replays setup -> cleanup -> setup, and
   * anything the drive owns has to be restored by setup. It also keeps the
   * refs it reads out of the render pass, where a ref's value is not a thing
   * React can be trusted to have settled.
   */
  const controllerRef = useRef<DriveController | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    controllerRef.current = createDriveController({
      session,
      level,
      evaluateAction,
      readLogs: () => logsRef.current,
      priorLogs: history,
      liveReroll: rerollsLive,
      readTraces: () => tracesRef.current,
      readTotals: totals,
      host: {
        jolt: () => {
          setJolted(true);
          schedule(() => setJolted(false), JOLT_MS);
        },
        finish: (result, telemetry, holdMs) => {
          if (holdMs > 0) schedule(() => onCompleteRef.current(result, telemetry), holdMs);
          else onCompleteRef.current(result, telemetry);
        },
      },
    });
    return () => {
      controllerRef.current = null;
    };
  }, [evaluateAction, history, level, logsRef, rerollsLive, schedule, session, totals, tracesRef]);

  const handle = useCallback(
    (reported: readonly GameEvent[]) => controllerRef.current?.handle(reported),
    []
  );

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    let animationFrame = 0;
    let running = true;
    let previous = session.getSnapshot();

    const tick = () => {
      if (!running) return;
      handle(session.update(readInput(keysRef.current)));

      const frame = session.getFrame();
      if (frame) {
        renderFrame(ctx, frame.scene);
        if (frame.flash > 0) {
          ctx.fillStyle = `rgba(220,38,38,${frame.flash})`;
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        if (frame.veil > 0) drawVisibilityVeil(ctx, frame.veil);
      }

      const next = session.getSnapshot();
      if (snapshotChanged(previous, next)) {
        previous = next;
        setSnapshot(next);
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    // `running` covers the frame that is already dispatched when the effect is
    // torn down: cancelling its handle is too late to stop it on its own.
    return () => {
      running = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [enabled, handle, keysRef, session]);

  /**
   * Releases the drive from one of the frozen panels.
   *
   * The held keys go first, so the frame that resumes the world reads a
   * keyboard the player has to press again rather than one they were leaning on
   * while reading. Both session calls are idempotent, so a second
   * acknowledgement — a double click, a key repeat, Strict Mode replaying the
   * panel's own effect — resumes nothing twice.
   */
  const resume = useCallback(
    (release: () => readonly GameEvent[]) => {
      releaseHeldKeys();
      handle(release());
    },
    [handle, releaseHeldKeys]
  );

  return {
    canvasRef,
    snapshot,
    jolted,
    answerInspection: useCallback((action: string) => handle(session.answerInspection(action)), [handle, session]),
    answerCutscene: useCallback((action: string) => handle(session.answerCutscene(action)), [handle, session]),
    playParking: useCallback((action: string) => session.playParking(action), [session]),
    playRightOfWay: useCallback((action: string) => session.playRightOfWay(action), [session]),
    dismissAdaptationNotice: useCallback(
      () => resume(() => session.dismissAdaptationNotice()),
      [resume, session]
    ),
    dismissBriefing: useCallback(() => resume(() => session.dismissBriefing()), [resume, session]),
  };
};
