import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { GarageHotspot } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { SupportLevel } from '@/domain/learner/competency';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import GameHUD from './GameHUD';
import FSMDiagram from './FSMDiagram';
import FeedbackStack from '@/features/driving-sim/presentation/ui/feedback/FeedbackStack';
import { useAuthSession } from '@/features/auth';
import CheckpointInspection from '@/features/driving-sim/presentation/ui/decisions/CheckpointInspection';
import RoadDecision from '@/features/driving-sim/presentation/ui/decisions/RoadDecision';
import EmergencyDecision from '@/features/driving-sim/presentation/ui/decisions/EmergencyDecision';
import ParkingDecision from '@/features/driving-sim/presentation/ui/decisions/ParkingDecision';
import QuestionTimer from '@/features/driving-sim/presentation/ui/decisions/QuestionTimer';
import { IN_DRIVE_QUESTION_LIMIT_SEC } from '@/domain/learner/stageCompetencies';
import GarageStage from './GarageStage';
import CrashResponseStage from './stage/CrashResponseStage';
import { nextAttemptSeed } from '@/features/driving-sim/application/attemptSeed';
import MissionPanel from './MissionPanel';
import RoadEventPrompt from './RoadEventPrompt';
import { showsRoadPrompt } from './panelPriority';
import AdaptationNotice from './AdaptationNotice';
import ScenarioBriefing from './ScenarioBriefing';
import { roadPositionCue } from './roadPositionLabel';
import { resolveLaneRole } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { useKeyboard, type KeyboardListener } from '@/features/driving-sim/presentation/input/useKeyboard';
import { createInputRecorder, type DriveExit } from '@/features/driving-sim/domain/telemetry/controlInputs';
import { useFSM } from '@/features/driving-sim/application/useFSM';
import { registerActiveFSM } from '@/features/driving-sim/domain/fsm/devRegistry';
import { DEFAULT_TRANSITION_PARAMS, type TransitionParams } from '@/features/driving-sim/domain/fsm/fsmTypes';
import { useScenarioEvaluation } from '@/features/driving-sim/application/useScenarioEvaluation';
import { useDrivingSimulation } from '@/features/driving-sim/presentation/drive/useDrivingSimulation';
import { useStageScale } from './useStageScale';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { garageHotspotToEvent } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { buildLevelResult } from '@/features/driving-sim/domain/scoring/buildLevelResult';
import { buildLevelFsmTelemetry, type LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';

interface GameScreenProps {
  level: LevelConfig;
  onComplete: (result: LevelResult, telemetry: LevelFsmTelemetry) => void;
  /** Leaving before the end: everything done so far comes with it, for the log. */
  onExit: (partial?: DriveExit) => void;
  /** The page is closing mid-drive (tab closed, reload): a last chance to log what was done. Best effort. */
  onAbandon?: (partial: DriveExit) => void;
  /** Dev-only: starts the drive at this road distance instead of 0. */
  initialDistance?: number;
  /**
   * The FSM transition-guard parameters the adaptive layer chose for this level
   * entry. Omitted means the machine's defaults, which reproduce the hand-tuned
   * timing exactly - so a learner the policy has nothing to say about drives the
   * baseline machine.
   */
  transitionParams?: TransitionParams;
  /**
   * The support level h the adaptive layer chose for this level entry: how much
   * of the answer every scenario shows while it is presented. Omitted
   * means full, the baseline machine's output, as omitted `transitionParams`
   * mean its baseline timing.
   */
  support?: SupportLevel;
  /**
   * The attempt's seed, which orders every question's answers. Omitted - as
   * the dev harness omits it - means a fresh one for this mount.
   */
  attemptSeed?: number;
  /**
   * The learner's graded history before this attempt, oldest first, as the
   * level entry read it: the live mastery estimate behind the re-roll and the
   * "Extra guidance" panel reads it ahead of the run's own logs. Omitted - as
   * the dev harness omits it - means no history.
   */
  priorLogs?: readonly ActionLog[];
  /**
   * Whether the drive re-rolls its route toward a weak competency, with the
   * adaptation notice and the "Extra guidance" panel that come with it.
   * Omitted means true, Legacy's game; the routing FSM's groups pass false.
   */
  liveReroll?: boolean;
}

/** The lane strip's markers where the support level withholds the response. */
const NO_LANES: number[] = [];

const GameScreen = ({
  level,
  onComplete,
  onExit,
  onAbandon,
  initialDistance,
  transitionParams,
  support = 'full',
  attemptSeed,
  priorLogs,
  liveReroll,
}: GameScreenProps) => {
  // Levels carrying a garage stage start there; the road only opens once every
  // readiness point has been judged. A level carrying an `aftermath` stage adds
  // one at the far end, played once the route has been driven.
  const [stage, setStage] = useState<'garage' | 'driving' | 'aftermath'>(
    level.garage ? 'garage' : 'driving'
  );
  /**
   * The drive's own result and telemetry, held back while the aftermath stage
   * runs.
   *
   * The simulation finishes the route and reports a score; the crash scene then
   * adds to it. Handing the first result straight to the results screen would
   * end the mission before the last four decisions had been made, so it waits
   * here and is re-totalled in `finishAftermath`.
   */
  const pendingRef = useRef<{ result: LevelResult; telemetry: LevelFsmTelemetry } | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  /**
   * Seeds the order every question on this attempt shows its answers in.
   *
   * The attempt's own seed, held once for the mount rather than read per
   * question: the garage, the road and the crash scene are one attempt and
   * should shuffle together, and a value re-derived on any render would move
   * the answers under the player's cursor on the next painted frame. A new
   * attempt mounts a fresh `GameScreen` with a new seed, which is what makes
   * the order new.
   */
  const [choiceSeed] = useState(() => attemptSeed ?? nextAttemptSeed());
  // The FSM diagram is an instructor/analysis tool: admins only. Players get the
  // same run described in plain language instead.
  const { isAdmin } = useAuthSession();

  const reducedMotion = useReducedMotion();
  const { fsm, fsmState, snapshot, prevFsmState, transitionLabel } = useFSM();
  // Every key pressed and released on the road, for the drive's input log.
  const [recorder] = useState(() => createInputRecorder());
  const listenerRef = useRef<KeyboardListener | null>(recorder);
  const { releaseHeldKeys } = useKeyboard(keysRef, listenerRef);

  // Apply the learned transition-guard parameters to this drive's machine.
  // This is where the Q-learning decision reaches the FSM: from here on, the
  // guards on DRIVING -> APPROACHING_EVENT and APPROACHING_EVENT ->
  // REACTION_WINDOW fire against theta rather than against fixed thresholds.
  // Runs before the simulation loop's effect (declared above it) so no frame
  // is ever evaluated against stale parameters.
  useEffect(() => {
    fsm.setTransitionParams(transitionParams ?? DEFAULT_TRANSITION_PARAMS);
  }, [fsm, transitionParams]);

  // Dev-only: hand this instance to the registry so /dev/profile can read the
  // transition log this drive builds up. Registered here rather than inside
  // useFSM itself, because useFSM is also used by FSMConsole (/dev/fsm) to
  // drive a throwaway instance by hand - if that registered too, opening the
  // console and firing a couple of triggers would silently overwrite the
  // pointer to a real drive's log with a near-empty scratch one. GameScreen
  // is the only useFSM caller that is ever a real drive (whether reached via
  // normal play or /dev/scenarios' ScenarioLab, which mounts this same
  // component), so it's the only one that should claim the slot. Compiled
  // out of production builds - import.meta.env.DEV is statically false there.
  useEffect(() => {
    if (import.meta.env.DEV) registerActiveFSM(fsm);
  }, [fsm]);

  const {
    score,
    scoreRef,
    result,
    dismissResult,
    screenShake,
    decisions,
    roadDecisionCount,
    logsRef,
    tracesRef,
    signOutcomesRef,
    violationsRef,
    correctRef,
    evaluateAction,
  } = useScenarioEvaluation({ fsm, support });

  /**
   * The route is finished. On a level with an aftermath stage the mission is
   * not, so the result is parked and the crash scene opens instead.
   *
   * A run that ended in an impact skips it: the driver never arrived at the
   * scene under their own control, and asking them to work through a crash
   * response they did not reach would be inventing a stop that never happened.
   */
  const finishedRef = useRef(false);
  /** The run is over: its result, with every key pressed on the road. */
  const completeWithInputs = useCallback(
    (result: LevelResult, telemetry: LevelFsmTelemetry) => {
      finishedRef.current = true;
      onComplete(result, { ...telemetry, inputs: recorder.snapshot() });
    },
    [onComplete, recorder]
  );

  const handleSimComplete = useCallback(
    (result: LevelResult, telemetry: LevelFsmTelemetry) => {
      if (level.aftermath && !result.crashReason) {
        pendingRef.current = { result, telemetry };
        setStage('aftermath');
        return;
      }
      completeWithInputs(result, telemetry);
    },
    [level.aftermath, completeWithInputs]
  );

  const {
    canvasRef,
    snapshot: drive,
    jolted,
    answerInspection,
    answerCutscene,
    timeoutQuestion,
    playParking,
    playRightOfWay,
    dismissAdaptationNotice,
    dismissBriefing,
  } = useDrivingSimulation({
    level,
    onComplete: handleSimComplete,
    fsm,
    keysRef,
    releaseHeldKeys,
    scoreRef,
    logsRef,
    tracesRef,
    signOutcomesRef,
    violationsRef,
    correctRef,
    evaluateAction,
    enabled: stage === 'driving',
    initialDistance,
    priorLogs,
    support,
    liveReroll,
  });

  // The drive's view model. Everything the screen shows comes from here; the
  // world it is projected from never reaches React.
  const {
    speed,
    targetSpeed,
    progress,
    requiredLanes,
    activeEvent,
    eventPhase,
    eventApproach,
    laneCue,
    gapCue,
    holdCue,
    bayCue,
    coastCue,
    throttleCue,
    inspectionEvent,
    cutsceneEvent,
    briefingEvent,
    roadPosition,
    adaptationNotice,
    parkingPlayed,
    rightOfWayPlayed,
    crashed,
    crawlWarning,
    wrongSideWarning,
    holdingForCorrection,
    weakCompetency,
  } = drive;

  // Which emergency question has its answer picked and playing out: its clock
  // is held from then on. Keyed by the event, so the next question starts clean.
  const [emergencyChosenId, setEmergencyChosenId] = useState<string | null>(null);
  const emergencyChosen = cutsceneEvent !== null && cutsceneEvent !== undefined && emergencyChosenId === cutsceneEvent.id;

  // Whether the screen may mark the response the active scenario is graded on:
  // the lane strip's wanted lane, and the lane and speed a merge asks for. The
  // route's own readout - which lane the car is in, and whether the separator
  // still stands - is the situation and is shown at every level.
  const showsResponse = activeEvent ? scenarioSupport(activeEvent, support).showsResponse : true;

  /**
   * Where the car is, in the road's own words — and, when a scenario is asking
   * for a merge and the support level shows it, which lane it is asking for.
   * Both the HUD strip and the road prompt read this, so the two cannot say
   * different things about the same car.
   */
  const positionCue = useMemo(() => {
    const merge = showsResponse ? activeEvent?.merge : undefined;
    return roadPositionCue(
      roadPosition,
      merge
        ? {
            intoLane: resolveLaneRole(merge.intoLane, level.paint?.oncomingLanes ?? 0),
            minSpeed: merge.minSpeed,
            speed,
          }
        : null
    );
  }, [activeEvent, level.paint?.oncomingLanes, roadPosition, showsResponse, speed]);

  // Height-only: the slot is now the board's own width, so folding width into
  // the measurement would make the scale chase itself.
  const { frameRef, scale } = useStageScale(CANVAS_WIDTH, CANVAS_HEIGHT, { heightOnly: true });

  const handleGarageAnswer = useCallback(
    (hotspot: GarageHotspot, action: string) => {
      evaluateAction(garageHotspotToEvent(hotspot), action, 'garage');
    },
    [evaluateAction]
  );

  /**
   * The crash scene is done, so the mission is. The totals are recomputed here
   * rather than reused from the drive's own result: the four decisions made at
   * the scene are worth points, count as correct actions or violations, and
   * carry competencies of their own, so a run that reported its stars before
   * they happened would be reporting the wrong ones.
   */
  const finishAftermath = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;

    // Re-derived from the live refs rather than the parked drive result: the
    // decisions made at the crash scene change the score, the correct/violation
    // counts and the competency mix, so the parked totals are stale by now.
    // Same single assembly path the drive itself ends through. The scene
    // re-rolls nothing, so the drive's re-rolls are the run's.
    completeWithInputs(
      buildLevelResult(level, {
        score: scoreRef.current,
        violations: violationsRef.current,
        correctActions: correctRef.current,
        logs: logsRef.current,
        signOutcomes: signOutcomesRef.current,
      }),
      buildLevelFsmTelemetry(fsm.getTransitionLog(), logsRef.current, tracesRef.current, pending.telemetry.rerolls)
    );
  }, [correctRef, fsm, level, logsRef, completeWithInputs, scoreRef, signOutcomesRef, tracesRef, violationsRef]);

  /** What was done so far, for a drive left before its end. */
  const partial = useCallback(
    (reason: DriveExit['reason']): DriveExit => ({
      logs: [...logsRef.current],
      score: scoreRef.current,
      stage,
      elapsedMs: recorder.elapsedMs(),
      inputs: recorder.snapshot(),
      reason,
    }),
    [logsRef, scoreRef, stage, recorder]
  );
  const exit = useCallback(() => {
    finishedRef.current = true;
    onExit(partial('exit'));
  }, [onExit, partial]);

  // Closing or reloading the tab mid-drive: log what was done (best effort; the
  // browser may not finish the write).
  useEffect(() => {
    if (!onAbandon) return;
    const onPageHide = () => {
      if (!finishedRef.current) onAbandon(partial('page_closed'));
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [onAbandon, partial]);

  const feedbackCards = <FeedbackStack result={result} onDismiss={dismissResult} />;

  // The garage replaces the road screen rather than covering it, so none of the
  // driving UI stays in the DOM where it could be selected or read out.
  if (stage === 'garage' && level.garage) {
    return (
      <>
        <GarageStage
          garage={level.garage}
          levelName={level.name}
          score={score}
          choiceSeed={choiceSeed}
          onAnswer={handleGarageAnswer}
          onComplete={() => setStage('driving')}
          onExit={exit}
        />
        <div className="fixed bottom-3 left-3 z-[60] flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-3">
          {feedbackCards}
        </div>
      </>
    );
  }

  // The crash scene, played on foot once the route has been driven. Replaces
  // the road screen for the same reason the garage does: none of the driving UI
  // should stay in the DOM where it could be read out or selected.
  //
  // Its own component rather than the garage with different words. A pre-drive
  // inspection and a road crash are different experiences — see
  // `CrashResponseStage` for what actually differs and why.
  if (stage === 'aftermath' && level.aftermath) {
    return (
      <>
        <CrashResponseStage
          stage={level.aftermath}
          levelName={level.name}
          score={score}
          choiceSeed={choiceSeed}
          onAnswer={handleGarageAnswer}
          onComplete={finishAftermath}
          onExit={exit}
        />
        <div className="fixed bottom-3 left-3 z-[60] flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-3">
          {feedbackCards}
        </div>
      </>
    );
  }

  // The three kinds of frozen decision arrive on the same channel, and they are
  // told apart by what there is to look at: a parking manoeuvre is performed on
  // the canvas, so its prompt docks over it; a right-of-way call and a
  // mechanical failure both have nothing to watch on the road and take the
  // screen, with their own diagram of what is actually happening.
  const parkingCutsceneEvent = cutsceneEvent?.parkingCutscene ? cutsceneEvent : null;
  const emergencyCutsceneEvent =
    cutsceneEvent && !cutsceneEvent.parkingCutscene && cutsceneEvent.emergency
      ? cutsceneEvent
      : null;
  const roadCutsceneEvent =
    cutsceneEvent?.parkingCutscene || cutsceneEvent?.emergency ? null : cutsceneEvent;

  // Prompts live beside the board, never over it. Suppressed while a frozen
  // decision is up: those take the screen and carry their own question.
  // Nothing beside the road while the drive is frozen to read the scenario: the
  // briefing is saying the same three things at full size, and two copies of one
  // sentence is what made the merge screen unreadable.
  const roadPrompt = !showsRoadPrompt({ inspectionEvent, cutsceneEvent, briefingEvent }) ? null : (
      <RoadEventPrompt
        level={level}
        support={support}
        activeEvent={activeEvent}
        eventPhase={eventPhase}
        eventApproach={eventApproach}
        laneCue={laneCue}
        gapCue={gapCue}
        holdCue={holdCue}
        bayCue={bayCue}
        coastCue={coastCue}
        throttleCue={throttleCue}
      />
    );

  const sidePanel = isAdmin ? (
    <FSMDiagram
      currentState={fsmState}
      snapshot={snapshot}
      previousState={prevFsmState}
      transitionLabel={transitionLabel}
    />
  ) : (
    <MissionPanel
      level={level}
      score={score}
      progress={progress}
      eventsCleared={roadDecisionCount}
      decisions={decisions}
    />
  );

  return (
    <div className="fixed inset-0 overflow-y-auto bg-background lg:overflow-hidden">
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px) rotate(-0.5deg)}
          40%{transform:translateX(6px) rotate(0.5deg)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
        @keyframes pulseGlow {
          0%,100%{box-shadow:0 0 8px rgba(240,201,41,.3)}
          50%{box-shadow:0 0 20px rgba(240,201,41,.6)}
        }
      `}</style>

      <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col items-center justify-center gap-4 p-3 lg:h-full lg:flex-row lg:items-start lg:justify-center lg:gap-5 lg:p-4">
        {/* Coaching column: reserved at every width so the stage never shifts
            when a card appears. */}
        {/* Left column: the prompt sits at the top with feedback stacked under
            it, so everything the game is telling you is in one place and the
            column is no longer empty most of the time. */}
        <div className="order-2 flex w-full flex-col gap-2 lg:static lg:order-none lg:w-[340px] lg:shrink-0 lg:justify-start lg:self-stretch">
          {/* Docked to the board at every width. On a phone the column sits
              between the canvas and the touch controls, which is the only place
              a driver can read it without taking their eyes off the road — it
              used to be pinned to the bottom of a scrolling page, several
              hundred pixels below the fold. */}
          {roadPrompt}
          {feedbackCards}
        </div>

        {/* Stage slot: sized by the layout, never by its contents, so the scale
            measurement below can't feed back into it. */}
        <div
          ref={frameRef}
          // Pinned to the board's width rather than stretching, so the two side
          // columns sit next to the road instead of being pushed to the edges.
          className="order-1 flex h-[62vh] w-full max-w-[480px] shrink-0 items-center justify-center lg:order-none lg:h-auto lg:w-[460px] lg:max-w-none lg:items-start lg:self-stretch"
        >
          <div
            className="relative shrink-0"
            style={{
              width: CANVAS_WIDTH * scale,
              height: CANVAS_HEIGHT * scale,
              // Every animation in the drive UI is opt-out. A viewer who has
              // asked the system for less motion gets the same information
              // without the board moving under them.
              animation: reducedMotion
                ? 'none'
                : crashed
                  ? 'shake 0.55s ease-in-out'
                  : jolted
                    ? 'shake 0.45s ease-in-out'
                    : screenShake
                      ? 'shake 0.4s ease-in-out'
                      : 'none',
            }}
          >
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: `scale(${scale})` }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="block rounded-2xl border border-border shadow-2xl"
              />

              <GameHUD
                score={score}
                speed={speed}
                levelName={level.name}
                levelId={level.id}
                onExit={exit}
                position={roadPosition}
                cue={positionCue}
                requiredLanes={showsResponse ? requiredLanes : NO_LANES}
                oncomingLanes={level.paint?.oncomingLanes ?? 0}
                targetSpeed={targetSpeed}
              />

              {/* Standing-penalty banners: the single on-screen cue for each of
                  the two continuous infractions, whose deductions are otherwise
                  silent. Stacked in one column so that crawling in the oncoming
                  lane shows both without them overlapping. The warning always
                  arrives before the deduction does. */}
              {(wrongSideWarning || crawlWarning) && (
                <div className="pointer-events-none absolute inset-x-0 top-[86px] z-30 flex flex-col items-center gap-1.5">
                  {wrongSideWarning && (
                    <div
                      className="rounded-md border border-destructive/60 bg-background/90 px-3 py-1.5 backdrop-blur"
                      style={reducedMotion ? undefined : { animation: 'pulseGlow 1.5s ease-in-out infinite' }}
                    >
                      <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-destructive">
                        Wrong side — return to your lane
                      </p>
                    </div>
                  )}
                  {crawlWarning && (
                    <div
                      className="rounded-md border border-road-yellow/60 bg-background/90 px-3 py-1.5 backdrop-blur"
                      style={reducedMotion ? undefined : { animation: 'pulseGlow 1.5s ease-in-out infinite' }}
                    >
                      <p className="font-display text-[10px] font-black uppercase tracking-[0.16em] text-road-yellow">
                        Move off — you are holding up traffic
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* The two docked panels and the correction hold sit *outside* the
                scaled board, over the same box.

                They used to be inside it, and so were drawn at the board's own
                scale: on a phone the whole stage renders at about 0.72, which
                turned a 15px answer into an 11px one and a 13px situation into
                a 9px one — the panels carrying the most text on the screen were
                the only things on it shrinking. Everything here is positioned
                with `inset`, so moving it out changes where nothing sits and
                leaves the type at the size it was written at. */}
            {holdingForCorrection && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
                <div className="rounded-lg border border-destructive/50 bg-card/95 px-4 py-2.5 text-center shadow-xl">
                  <p className="font-display text-[13px] font-black uppercase tracking-[0.12em] text-destructive">
                    Read the correction
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Driving resumes in a moment
                  </p>
                </div>
              </div>
            )}

            {/* Docked over the frozen road rather than replacing it: the
                junction and the other vehicle, or the car swinging into the
                bay, are already drawn on this canvas in their real lanes, so
                the question is about something the player can see. */}
            {roadCutsceneEvent && (
              <RoadDecision
                event={roadCutsceneEvent}
                onPlay={playRightOfWay}
                played={rightOfWayPlayed}
                onAnswer={answerCutscene}
                choiceSeed={choiceSeed}
                hintText={
                  roadCutsceneEvent.competency === weakCompetency
                    ? roadCutsceneEvent.lawCitation
                    : undefined
                }
              />
            )}

            {parkingCutsceneEvent && (
              <ParkingDecision
                event={parkingCutsceneEvent}
                onPlay={playParking}
                played={parkingPlayed}
                onAnswer={answerCutscene}
                choiceSeed={choiceSeed}
                hintText={
                  parkingCutsceneEvent.competency === weakCompetency
                    ? parkingCutsceneEvent.lawCitation
                    : undefined
                }
              />
            )}
          </div>
        </div>

        {/* Touch controls, under the board rather than over it.
            Laid across the road they covered the one thing a merge or an exit
            is about: the player's own car sits low and to the right, which is
            exactly where a right-hand thumb pad goes. Below the board there is
            room on a phone and nothing to hide. */}
        <div className="order-3 flex w-full max-w-[480px] items-end justify-between gap-3 px-2 md:hidden">
          <button
            onTouchStart={() => keysRef.current.add('ArrowLeft')}
            onTouchEnd={() => keysRef.current.delete('ArrowLeft')}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card/90 text-xl backdrop-blur"
>
            ←
          </button>
          <div className="flex gap-2">
            <button
              onTouchStart={() => keysRef.current.add('ArrowUp')}
              onTouchEnd={() => keysRef.current.delete('ArrowUp')}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/40 bg-accent/20 text-xl backdrop-blur"
>
              ↑
            </button>
            <button
              onTouchStart={() => keysRef.current.add('ArrowDown')}
              onTouchEnd={() => keysRef.current.delete('ArrowDown')}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/20 text-xl backdrop-blur"
>
              ↓
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onTouchStart={() => keysRef.current.add('h')}
              onTouchEnd={() => keysRef.current.delete('h')}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-road-yellow/40 bg-road-yellow/15 font-display text-sm font-black backdrop-blur"
>
              HORN
            </button>
            <button
              onTouchStart={() => keysRef.current.add('ArrowRight')}
              onTouchEnd={() => keysRef.current.delete('ArrowRight')}
              className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card/90 text-xl backdrop-blur"
                  >
                    →
            </button>
          </div>
        </div>

        {/* Right column is mission status only. */}
        <aside className="hidden w-[340px] shrink-0 flex-col gap-3 overflow-y-auto lg:flex">
          {sidePanel}
        </aside>

        {/* Mission status on a phone, last: it is the reference you scroll to
            between scenarios, not something read while driving. The prompt is
            not repeated here — the coaching column above carries it at every
            width, and two copies of one instruction was the defect this
            redesign set out to remove. */}
        <div className="order-4 flex w-full max-w-[480px] flex-col gap-3 lg:hidden">
          {isAdmin ? (
            <FSMDiagram
              currentState={fsmState}
              snapshot={snapshot}
              previousState={prevFsmState}
              transitionLabel={transitionLabel}
              compact
            />
          ) : (
            <MissionPanel
              level={level}
              score={score}
              progress={progress}
              eventsCleared={roadDecisionCount}
              decisions={decisions}
              compact
            />
          )}
        </div>
      </div>

      {/* The adaptation notice freezes the drive and waits for an explicit
          acknowledgement, because the route ahead has changed under the player.
          Rendered above the decision screens for the same reason those sit
          above the road — whichever of them is open is the only thing asked.

          An ordinary road event has no panel here on purpose: its guidance is
          shown beside the road while the car keeps moving. */}
      {adaptationNotice && (
        <AdaptationNotice competency={adaptationNotice} onContinue={dismissAdaptationNotice} />
      )}

      {/* The scenario, read before it is driven. Below the adaptation notice on
          purpose: a route that has just changed under the player is the more
          urgent thing to say, and both holds are released separately. */}
      {briefingEvent && !adaptationNotice && (
        <ScenarioBriefing event={briefingEvent} support={support} onContinue={dismissBriefing} />
      )}

      {/* The in-drive question's clock: one per question, held once the answer is chosen and playing out. */}
      {(inspectionEvent ?? cutsceneEvent) && (
        <QuestionTimer
          key={(inspectionEvent ?? cutsceneEvent)!.id}
          limitSec={IN_DRIVE_QUESTION_LIMIT_SEC}
          paused={Boolean(adaptationNotice) || rightOfWayPlayed || parkingPlayed || emergencyChosen}
          onExpire={timeoutQuestion}
        />
      )}

      {inspectionEvent && (
        <CheckpointInspection
          event={inspectionEvent}
          onAnswer={answerInspection}
          choiceSeed={choiceSeed}
          hintText={inspectionEvent.competency === weakCompetency ? inspectionEvent.lawCitation : undefined}
        />
      )}
      {emergencyCutsceneEvent && (
        <EmergencyDecision
          event={emergencyCutsceneEvent}
          onAnswer={answerCutscene}
          onChoose={() => setEmergencyChosenId(emergencyCutsceneEvent.id)}
          choiceSeed={choiceSeed}
          hintText={
            emergencyCutsceneEvent.competency === weakCompetency
              ? emergencyCutsceneEvent.lawCitation
              : undefined
          }
        />
      )}

      {/* Dev-only: the active event's stable id, so what's on screen right now
          can be Grepped straight back to its source object without going
          through a dev tool first. Whichever of the three ways an event can be
          "live" applies - inspection/cutscene take the screen over, so they
          take priority over the plain road prompt's activeEvent. */}
      {import.meta.env.DEV && (inspectionEvent ?? cutsceneEvent ?? activeEvent) && (() => {
        const event = (inspectionEvent ?? cutsceneEvent ?? activeEvent)!;
        return (
          <div className="pointer-events-none fixed right-2 top-2 z-[100] rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-lime-400">
            {event.id}
            <span className="text-sky-300"> h={support}</span>
            {event.remediation && (
              // The one visible signal, outside a console, that the adaptive
              // selector actually appended this event: its id names the level
              // it was borrowed from, which is not this level.
              <span className="text-amber-400"> [REMEDIATION {event.competency}]</span>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default GameScreen;
