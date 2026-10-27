/**
 * What happens after a drive ends: persist the attempt (signed-in only), then
 * work out what comes next.
 *
 * In Legacy that is today's suggestion, read back through `loadLearnerHistory`
 * rather than computed from this run alone, so a signed-in player's
 * recommendation reflects every attempt across sessions and devices -
 * including the one just saved. In a New group it is the routing FSM's: the
 * entry's verdict settles the cursor, and the old practice policy, which the
 * suggestion reads, is never consulted.
 */
import type { LevelResult } from '@/domain/learner/attempt';
import { POLICY_TABLE_ID } from '@/domain/learner/adaptive/qLearningPolicy';
import type { Outcome, RoutingLogEntry } from '@/domain/routing/routingTypes';
import type { LevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { buildDecisionTelemetry } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import {
  buildRoutingTelemetry,
  recordCourseEntry,
  recordFreeReplay,
  type RoutedEntryRecord,
} from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import { settleCourseEntry, type CourseEntry, type RoutingCursor } from '@/features/driving-sim/domain/adaptive/courseRouting';
import { courseResultNote } from '@/features/driving-sim/domain/adaptive/routingBriefing';
import {
  getLevelRecommendation,
  type LevelRecommendation,
} from '@/features/driving-sim/domain/adaptive/practiceSelection';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { historyLogs, loadLearnerHistory } from '../learnerHistory';
import { drivingSimDeps } from '../dependencies';
import type { AdaptivePlan } from './buildAdaptivePlan';
import type { RoutingGroupResolution } from './resolveRoutingGroup';

/** How the attempt was entered: everything the per-decision record needs that the drive does not know. */
export interface AttemptStart {
  attemptSeed: number;
  plan: AdaptivePlan;
  /** The level as rolled for this attempt. */
  level: LevelConfig;
}

export interface CompleteMissionInput {
  /** Null for a guest, whose runs are never persisted. */
  uid: string | null;
  result: LevelResult;
  /** The drive's FSM telemetry, kept out of `LevelResult` so the raw log never enters React state or the store. */
  telemetry?: LevelFsmTelemetry;
  /** Absent only where the attempt was not entered through a plan, which is never the case in real play. */
  start?: AttemptStart;
  /** The group the attempt was played in, recorded with it. */
  group: RoutingGroupResolution;
}

/** The verdict the routing FSM is handed: the level's pass mark, a crash counting as a fail. */
export const routingOutcome = (result: LevelResult): Outcome => (result.completed ? 'passed' : 'failed');

/**
 * The attempt's graded decisions, standing penalties excluded: the unit the
 * learned policy's budget is counted in, as the simulation counts it. Without the drive's
 * traces, every log is counted.
 */
export const gradedDecisionsOf = (result: LevelResult, telemetry?: LevelFsmTelemetry): number =>
  telemetry ? telemetry.decisions.filter(trace => trace.kind !== 'penalty').length : result.logs.length;

/**
 * Saves one attempt and the documents beside it. The compact FSM summary rides
 * inline on the attempt; the raw transition log, the per-decision record and
 * the routing record go to telemetry subdocuments, keyed by the id the save
 * returns, so the bulk-read attempts collection stays lean.
 */
const saveAttempt = async (
  uid: string,
  { result, telemetry, start }: Pick<CompleteMissionInput, 'result' | 'telemetry' | 'start'>,
  routing: { group: RoutingGroupResolution; entry: RoutedEntryRecord | null; log: readonly RoutingLogEntry[] }
) => {
  const { storyAttempts } = drivingSimDeps();
  const attemptId = await storyAttempts.save(uid, {
    levelId: result.levelId,
    timestamp: Date.now(),
    finalScore: result.score,
    violations: result.violations,
    correctDecisions: result.correctActions,
    logs: result.logs,
    ...(telemetry
      ? { fsmMetrics: telemetry.metrics, reactionLatencies: telemetry.reactionLatencies }
      : {}),
  });
  const legacy = routing.group.groupInEffect === 'legacy';
  const plan = start?.plan;
  await Promise.all([
    ...(telemetry
      ? [
          storyAttempts.saveFsmTelemetry(uid, attemptId, telemetry.transitions),
          ...(start
            ? [
                storyAttempts.saveDecisionTelemetry(
                  uid,
                  attemptId,
                  buildDecisionTelemetry({
                    entry: {
                      levelId: result.levelId,
                      attemptSeed: start.attemptSeed,
                      route: start.level.events.map(event => event.id),
                      policy: start.plan.record,
                    },
                    logs: result.logs,
                    traces: telemetry.decisions,
                    rerolls: telemetry.rerolls,
                  })
                ),
              ]
            : []),
        ]
      : []),
    storyAttempts.saveRoutingTelemetry(
      uid,
      attemptId,
      buildRoutingTelemetry({
        mode: routing.group.mode,
        assignedGroup: routing.group.assignedGroup,
        groupInEffect: routing.group.groupInEffect,
        override: routing.group.override,
        options: GAME_OPTIONS,
        driving: {
          support: plan?.support ?? 'full',
          approachScale: plan?.practice?.transitionParams.approachScale ?? 1,
          weakAreaRoll: legacy && Boolean(plan?.weakArea),
          liveReroll: legacy,
          practicePolicy: legacy ? POLICY_TABLE_ID : null,
        },
        entry: routing.entry,
        log: routing.log,
        at: Date.now(),
      })
    ),
  ]);
};

/** Legacy: today's game. Saves the attempt and returns today's suggestion. */
export const completeMission = async ({
  uid,
  result,
  telemetry,
  start,
  group,
}: CompleteMissionInput): Promise<LevelRecommendation> => {
  if (uid) await saveAttempt(uid, { result, telemetry, start }, { group, entry: null, log: [] });

  return getLevelRecommendation(
    historyLogs(await loadLearnerHistory(uid)),
    result.levelId,
    GAME_OPTIONS.weakestTieBreak
  );
};

/**
 * A course entry in a New group. Its verdict settles the cursor - taking a
 * review's `return` or the final exam's `certify` where it ends one - and the
 * attempt is saved with the routing record before the cursor is, so a cursor
 * never names a move whose attempt is missing.
 */
export const completeCourseAttempt = async ({
  uid,
  result,
  telemetry,
  start,
  group,
  course,
}: CompleteMissionInput & { course: { cursor: RoutingCursor; entry: CourseEntry } }): Promise<{
  cursor: RoutingCursor;
  note: string;
}> => {
  const outcome = routingOutcome(result);
  const gradedDecisions = gradedDecisionsOf(result, telemetry);
  const settled = settleCourseEntry(course.cursor, course.entry, outcome, gradedDecisions);
  if (uid) {
    await saveAttempt(uid, { result, telemetry, start }, {
      group,
      entry: recordCourseEntry({ entry: course.entry, before: course.cursor, after: settled.cursor, outcome, gradedDecisions }),
      log: settled.log,
    });
    await drivingSimDeps().routing.saveCursor(uid, settled.cursor);
  }
  return { cursor: settled.cursor, note: courseResultNote(course.entry, outcome) };
};

const completeOutsideCourse = async (
  { uid, result, telemetry, start, group, route }: CompleteMissionInput & { route: string[] },
  kind: 'free-replay' | 'post-test'
): Promise<void> => {
  if (!uid) return;
  await saveAttempt(uid, { result, telemetry, start }, {
    group,
    entry: recordFreeReplay({
      levelId: result.levelId,
      route,
      outcome: routingOutcome(result),
      gradedDecisions: gradedDecisionsOf(result, telemetry),
      kind,
    }),
    log: [],
  });
};

/** A free replay in a New group: saved and recorded, and nothing in the routing FSM moves. */
export const completeFreeReplay = (input: CompleteMissionInput & { route: string[] }): Promise<void> =>
  completeOutsideCourse(input, 'free-replay');

/** The pilot's post-test: saved like a free replay, and recorded as the post-test. */
export const completePostTest = (input: CompleteMissionInput & { route: string[] }): Promise<void> =>
  completeOutsideCourse(input, 'post-test');
