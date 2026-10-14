/**
 * Entering Story Mode in a New group: where the player
 * stands, the next course entry the routing FSM gives them, and a free replay
 * of a level they have passed.
 *
 * Each returns an `AdaptivePlan`, the shape a Legacy entry has, so the drive,
 * the per-decision record and the results take an entry the same way whichever
 * game built it. A New plan never carries the practice policy's choice: no
 * weak area, no practice choice and no theta, and h is the plain FSM's.
 */
import type { RoutingCursor, CourseEntry, RoutingGroup } from '@/features/driving-sim/domain/adaptive/courseRouting';
import {
  enterCourseEntry,
  freeReplayLevel,
  nextCourseEntry,
  startingCursor,
} from '@/features/driving-sim/domain/adaptive/courseRouting';
import { courseNote, type CourseNote } from '@/features/driving-sim/domain/adaptive/routingBriefing';
import { POST_TEST_LEVEL_ID, POST_TEST_SEED } from '@/features/driving-sim/domain/adaptive/pilotPostTest';
import { recordRoutedDecision } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import { drivingSimDeps } from '../dependencies';
import { historyLogs, loadLearnerHistory } from '../learnerHistory';
import { loadSignCoverage } from '../signCoverage';
import type { AdaptivePlan } from './buildAdaptivePlan';

/**
 * A signed-in player's stored cursor; otherwise - a guest, or a player who has
 * never entered the course in a New group - one placed at the first level
 * their history has not passed.
 */
export const loadCourseCursor = async (uid: string | null): Promise<RoutingCursor> => {
  const stored = uid ? await drivingSimDeps().routing.loadCursor(uid) : null;
  if (stored) return stored;
  const history = await loadLearnerHistory(uid);
  return startingCursor(new Set(history.attempts.filter(attempt => attempt.passed).map(attempt => attempt.levelId)));
};

export interface CourseRun {
  /** The cursor as entered, with the entry pending on it. */
  cursor: RoutingCursor;
  entry: CourseEntry;
  plan: AdaptivePlan;
  /** The entry's seed: a resumed entry keeps the one it was decided with. */
  attemptSeed: number;
  note: CourseNote;
}

/**
 * The next course entry: the one pending on the cursor, entered again, or a
 * fresh decision by the group's policy. The cursor is saved with the entry
 * pending on it before the briefing shows, so leaving and coming back enters
 * the same entry.
 */
export const startCourseEntry = async ({
  uid,
  group,
  cursor,
  attemptSeed,
}: {
  uid: string | null;
  group: RoutingGroup;
  cursor: RoutingCursor;
  /** A fresh seed, used only if a new decision is made. */
  attemptSeed: number;
}): Promise<CourseRun> => {
  const deps = drivingSimDeps();
  const history = historyLogs(await loadLearnerHistory(uid));
  const optimized = group === 'optimized' && !cursor.pending ? await deps.optimizedRouting() : null;
  const pending = nextCourseEntry({ cursor, group, history, attemptSeed, coverage: loadSignCoverage(), optimized });
  const entry = enterCourseEntry(pending);
  const entered: RoutingCursor = { ...cursor, pending };
  if (uid) await deps.routing.saveCursor(uid, entered);

  return {
    cursor: entered,
    entry,
    attemptSeed: pending.attemptSeed,
    note: courseNote(entry),
    plan: {
      weakArea: null,
      practice: null,
      level: entry.level,
      support: entry.support,
      record: recordRoutedDecision({ history, item: entry.item, support: entry.support }),
      priorLogs: history,
      explanation: `routing (${pending.group}): ${pending.transition ? JSON.stringify(pending.transition) : 'no move'} -> level ${entry.levelId}${entry.item ? ` + ${entry.item.scenarioId}` : ''}`,
    },
  };
};

export interface FreeReplayRun {
  levelId: number;
  plan: AdaptivePlan;
  attemptSeed: number;
  /** The route as rolled. */
  route: string[];
}

/** A passed level played again from the map, outside the routing FSM, on the plain FSM's settings. */
export const startFreeReplay = async ({
  uid,
  levelId,
  attemptSeed,
}: {
  uid: string | null;
  levelId: number;
  attemptSeed: number;
}): Promise<FreeReplayRun> => {
  const history = historyLogs(await loadLearnerHistory(uid));
  const played = freeReplayLevel(levelId, attemptSeed, loadSignCoverage());
  return {
    levelId,
    attemptSeed,
    route: played.rolled.events.map(event => event.id),
    plan: {
      weakArea: null,
      practice: null,
      level: played.level,
      support: played.support,
      record: recordRoutedDecision({ history, item: null, support: played.support }),
      priorLogs: history,
      explanation: `free replay of level ${levelId}, outside the routing FSM`,
    },
  };
};

/**
 * The pilot's post-test: the final exam on its one fixed roll,
 * outside the routing FSM, at the final exam's own support level. A free
 * replay in every respect but the seed, which every participant shares.
 */
export const startPostTest = async ({ uid }: { uid: string | null }): Promise<FreeReplayRun> => {
  const run = await startFreeReplay({ uid, levelId: POST_TEST_LEVEL_ID, attemptSeed: POST_TEST_SEED });
  return {
    ...run,
    plan: {
      ...run.plan,
      explanation: `pilot post-test: level ${POST_TEST_LEVEL_ID} on seed ${POST_TEST_SEED}, outside the routing FSM`,
    },
  };
};
