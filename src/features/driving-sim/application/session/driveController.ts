/**
 * What a frame's reports mean.
 *
 * `DrivingSession.update` advances the world and reports what happened; it
 * never scores, never consults the learner model and never ends a run. This is
 * what does — evaluation, the weak-competency call that drives a live re-roll,
 * the finished result and its FSM telemetry.
 *
 * Application, not presentation: nothing here knows a canvas, an animation
 * frame or a `setState`. The host is told *what* happened through `DriveHost`
 * and decides how long a notice stays on screen; that split is what keeps the
 * browser bridge to input, painting and timers.
 *
 * A graded decision is scored here and the verdict handed straight back to the
 * session, which is what lets the world hold the road still on a mistake and
 * re-roll content still far enough ahead to change unseen. Settling can itself
 * report a re-roll, so reports are drained as a queue rather than recursed.
 */
import type { ActionLog } from '@/domain/learner/attempt';
import type { LevelResult } from '@/domain/learner/attempt';
import { buildBKTLearnerProfile } from '@/domain/learner/mastery/buildBKTProfile';
import { getLowestScoringCompetency } from '@/domain/learner/profile';
import { MASTERY_THRESHOLD } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { GAME_OPTIONS, type AdaptiveOptions } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { buildLevelResult, type RunTotals } from '@/features/driving-sim/domain/scoring/buildLevelResult';
import { buildLevelFsmTelemetry, type LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { GameEvent } from '@/features/driving-sim/domain/world/GameEvent';
import type { DecisionSettlement } from '@/features/driving-sim/domain/evaluation/reactionTiming';
import type { ApproachTrace } from '@/features/driving-sim/domain/fsm/approachLead';
import type { DecisionTrace, RerollTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import { CRASH_HOLD_MS, type DrivingSession } from './DrivingSession';

/** What the screen has to do about a report, once its meaning is settled. */
export interface DriveHost {
  /** Rough ground threw the car about: shake the stage briefly. */
  jolt(): void;
  /**
   * The run is over. `holdMs` is how long the last frame should stay up before
   * the results take over — a crash is held so the player sees what they hit.
   */
  finish(result: LevelResult, telemetry: LevelFsmTelemetry, holdMs: number): void;
}

export interface DriveControllerOptions {
  session: DrivingSession;
  level: LevelConfig;
  /** Scores and logs one decision, and returns whether it was right and where it was logged. */
  evaluateAction: (
    event: ScenarioEvent,
    playerAction: string,
    kind?: 'road' | 'penalty',
    quiet?: boolean,
    settlement?: DecisionSettlement,
    approach?: ApproachTrace
  ) => { isCorrect: boolean; logIndex: number };
  /** Everything logged so far this run, for the live mastery estimate. */
  readLogs: () => ActionLog[];
  /**
   * The learner's graded history before this attempt, oldest first, as the
   * level entry read it (`AdaptivePlan.priorLogs`). Read only where
   * `rerollHistory` is `full`; empty for a drive entered without a plan.
   */
  priorLogs?: readonly ActionLog[];
  /** Which logs the live estimate reads, and how it breaks a tie. Omitted means the game's rules. */
  options?: Pick<AdaptiveOptions, 'rerollHistory' | 'weakestTieBreak'>;
  /**
   * Whether the drive re-rolls its route toward a weak competency as it goes,
   * which also opens the adaptation notice and the "Extra guidance" panel.
   * Legacy's game does; the routing FSM's groups play the plain FSM's settings
   * and do not, so every decision settles with no weak competency.
   * Omitted means true, today's game.
   */
  liveReroll?: boolean;
  /** The trace kept beside each of those logs, in the same order. */
  readTraces: () => DecisionTrace[];
  /** The run's totals as they stand, plus any violation the ending itself adds. */
  readTotals: (extraViolations?: number) => RunTotals;
  host: DriveHost;
}

export interface DriveController {
  /** Acts on one frame's reports, and on anything settling them produces. */
  handle(reported: readonly GameEvent[]): void;
}

export const createDriveController = ({
  session,
  level,
  evaluateAction,
  readLogs,
  priorLogs = [],
  options = GAME_OPTIONS,
  liveReroll = true,
  readTraces,
  readTotals,
  host,
}: DriveControllerOptions): DriveController => {
  // Each re-roll, against the decision whose settling caused it. Kept here
  // rather than read off the reports later: by then other reports from the
  // same frame may have logged decisions of their own.
  const rerolls: RerollTrace[] = [];
  const telemetry = () =>
    buildLevelFsmTelemetry(session.getFsm().getTransitionLog(), readLogs(), readTraces(), rerolls);
  // One belief per learner: the history the entry was decided on, then this
  // run. `run-local` reads the run alone, where every
  // competency not yet met this run sits at pInit.
  const liveWeakCompetency = () => {
    const profile = buildBKTLearnerProfile(
      options.rerollHistory === 'full' ? [...priorLogs, ...readLogs()] : readLogs()
    );
    const lowest = getLowestScoringCompetency(profile, options.weakestTieBreak);
    return profile[lowest].score < MASTERY_THRESHOLD ? lowest : null;
  };

  return {
    handle(reported) {
      const queue = [...reported];
      while (queue.length > 0) {
        const event = queue.shift()!;
        switch (event.kind) {
          case 'decision': {
            const { isCorrect, logIndex } = evaluateAction(
              event.event,
              event.action,
              'road',
              false,
              event.settlement,
              session.approachTraceFor(event.event)
            );
            const settled = session.settleDecision({
              isCorrect,
              weakCompetency: liveReroll ? liveWeakCompetency() : null,
            });
            for (const report of settled) {
              if (report.kind === 'rerolled') rerolls.push({ afterDecision: logIndex, competency: report.competency });
            }
            queue.push(...settled);
            break;
          }
          case 'penalty':
            // Quiet: scored and logged, but silent on screen. Each standing
            // penalty already has its own always-on banner, so it must not also
            // raise a toast, a correction card and a shake every few seconds.
            evaluateAction(event.event, event.action, 'penalty', true);
            break;
          case 'jolt':
            host.jolt();
            break;
          case 'rerolled':
            // Nothing for the host to schedule: the world has already frozen
            // the drive and is holding the notice the player acknowledges, so
            // this report exists to mark where the route adapted in a recorded
            // drive rather than to put anything on screen.
            break;
          case 'crashed':
            // The impact itself is the run's final violation.
            host.finish(
              buildLevelResult(level, readTotals(1), event.reason),
              telemetry(),
              CRASH_HOLD_MS
            );
            break;
          case 'finished':
            host.finish(buildLevelResult(level, readTotals()), telemetry(), 0);
            break;
        }
      }
    },
  };
};
