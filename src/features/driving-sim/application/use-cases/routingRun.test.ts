/**
 * Story Mode's application layer under the Legacy / New switch: which group a
 * player is in, how a course entry is entered and
 * saved, and that Legacy still saves and suggests exactly what it did, with
 * its group recorded beside it.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog, LevelResult } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { POLICY_TABLE_ID } from '@/domain/learner/adaptive/qLearningPolicy';
import { ROUTING_Q_STATES, type RoutingTable } from '@/domain/learner/adaptive/routingQPolicy';
import { driveState } from '@/domain/routing/routingTypes';
import { GAME_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import { getLevelRecommendation } from '@/features/driving-sim/domain/adaptive/practiceSelection';
import type { RoutingCursor } from '@/features/driving-sim/domain/adaptive/courseRouting';
import { buildLevelFsmTelemetry } from '@/features/driving-sim/domain/fsm/fsmMetrics';
import type { DecisionTrace } from '@/features/driving-sim/domain/telemetry/decisionTelemetry';
import type { RoutingTelemetryDoc } from '@/features/driving-sim/domain/telemetry/routingTelemetry';
import type { LevelAttempt } from '@/features/driving-sim/domain/scoring/levelAttempt';
import { provideDrivingSimDependencies, type DrivingSimDependencies } from '../dependencies';
import type { LearnerAttempt, RoutingAssignment, RoutingOverride } from '../ports';
import { buildAdaptivePlan } from './buildAdaptivePlan';
import { POST_TEST_SEED } from '@/features/driving-sim/domain/adaptive/pilotPostTest';
import { completeCourseAttempt, completeFreeReplay, completeMission, completePostTest } from './completeMission';
import { resolveRoutingGroup, routingGroupNow, type RoutingGroupResolution } from './resolveRoutingGroup';
import { loadCourseCursor, startCourseEntry, startFreeReplay, startPostTest } from './startCourseEntry';
import { memoryAssessments, memoryBackground, memoryStudyLogs, memoryCompetencyCourse, memoryCourseStore } from '@/features/driving-sim/application/testDependencies';

const graded = (competency: DrivingCompetency, result: ActionLog['result'], timestamp: number): ActionLog => ({
  timestamp, action: 'brake', result, points: result === 'correct' ? 10 : -10, competency,
});

const weakAt = (weak: DrivingCompetency): ActionLog[] => [
  ...COMPETENCIES.flatMap((c, i) => [graded(c, 'correct', i * 2), graded(c, 'correct', i * 2 + 1)]),
  graded(weak, 'violation', 100),
  graded(weak, 'violation', 101),
];

const PRACTISE_WEAKEST: RoutingTable = Object.fromEntries(
  ROUTING_Q_STATES.map(state => [state, ['weakest', 'related', 'review', 'none']])
) as unknown as RoutingTable;

interface World {
  mode: 'legacy' | 'new';
  assignment: RoutingAssignment | null;
  override: RoutingOverride;
  cursor: RoutingCursor | null;
  attempts: LearnerAttempt[];
  calls: string[];
  saved: { attempt?: LevelAttempt; routing?: RoutingTelemetryDoc; cursors: RoutingCursor[]; tableLoads: number };
}

let world: World;

const provide = () =>
  provideDrivingSimDependencies({
    learnerHistory: { load: async () => ({ source: 'local', attempts: world.attempts }) },
    storyAttempts: {
      save: async (_uid, attempt) => {
        world.calls.push('attempt');
        world.saved.attempt = attempt;
        return 'a1';
      },
      saveFsmTelemetry: async () => void world.calls.push('fsm'),
      saveDecisionTelemetry: async () => void world.calls.push('decisions'),
      saveRoutingTelemetry: async (_uid, _id, doc) => {
        world.calls.push('routing');
        world.saved.routing = doc;
      },
    },
    signCoverage: { load: () => ({}), record: () => undefined },
    briefingProgress: { load: () => ({}), save: () => undefined, markLessonsRead: () => undefined },
    routingMode: world.mode,
    routing: {
      loadAssignment: async () => world.assignment,
      loadCursor: async () => world.cursor,
      saveCursor: async (_uid, cursor) => {
        world.calls.push('cursor');
        world.saved.cursors.push(cursor);
        world.cursor = cursor;
      },
    },
    routingOverride: { load: () => world.override, save: value => void (world.override = value) },
    optimizedRouting: async () => {
      world.saved.tableLoads += 1;
      return { table: PRACTISE_WEAKEST, tableId: 'test', seed: 0, budgetSize: 336 };
    },
    competencyCourse: memoryCompetencyCourse(memoryCourseStore()),
    assessments: memoryAssessments(memoryCourseStore()),
    background: memoryBackground(memoryCourseStore()),
    ...memoryStudyLogs(memoryCourseStore()),
  } satisfies DrivingSimDependencies);

beforeEach(() => {
  world = {
    mode: 'new', assignment: null, override: 'assigned', cursor: null, attempts: [], calls: [],
    saved: { cursors: [], tableLoads: 0 },
  };
  provide();
});

const result = (levelId: number, completed: boolean, logs: ActionLog[] = []): LevelResult => ({
  levelId, score: completed ? 90 : 10, stars: completed ? 3 : 0, completed, violations: 0, correctActions: logs.length, logs,
});

describe('which game a player runs', () => {
  it('is Legacy for everyone under the Legacy switch, decided at once', async () => {
    world.mode = 'legacy';
    world.assignment = { group: 'optimized', assignedAt: 1 };
    provide();
    expect(routingGroupNow({ uid: 'u1', canOverride: false, authLoading: true })).toEqual({
      mode: 'legacy', assignedGroup: null, groupInEffect: 'legacy', override: false,
    });
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: false })).toMatchObject({ groupInEffect: 'legacy' });
  });

  it('is the assigned group under the New switch, and Conventional, unassigned, without one', async () => {
    expect(routingGroupNow({ uid: 'u1', canOverride: false, authLoading: false })).toBeNull();
    expect(routingGroupNow({ uid: null, canOverride: false, authLoading: true })).toBeNull();
    expect(routingGroupNow({ uid: null, canOverride: false, authLoading: false })).toMatchObject({
      groupInEffect: 'conventional', assignedGroup: null,
    });
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: false })).toMatchObject({
      groupInEffect: 'conventional', assignedGroup: null, override: false,
    });
    world.assignment = { group: 'optimized', assignedAt: 1 };
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: false })).toEqual({
      mode: 'new', assignedGroup: 'optimized', groupInEffect: 'optimized', override: false,
    });
  });

  it('follows a developer\'s or admin\'s override, recorded as one, and no one else\'s', async () => {
    world.assignment = { group: 'conventional', assignedAt: 1 };
    world.override = 'optimized';
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: false })).toMatchObject({ groupInEffect: 'conventional', override: false });
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: true })).toEqual({
      mode: 'new', assignedGroup: 'conventional', groupInEffect: 'optimized', override: true,
    });
    world.override = 'legacy';
    expect(await resolveRoutingGroup({ uid: 'u1', canOverride: true })).toMatchObject({ groupInEffect: 'legacy' });
  });
});

describe('entering the course', () => {
  it('places a player with no cursor at the first level their history has not passed', async () => {
    world.attempts = [
      { levelId: 0, logs: [], passed: true },
      { levelId: 1, logs: [], passed: true },
      { levelId: 2, logs: [], passed: false },
    ];
    expect((await loadCourseCursor('u1')).state).toEqual(driveState(2));
    world.cursor = { state: driveState(7), outcome: 'failed', seq: 30, decisionsSpent: 250, pending: null };
    expect((await loadCourseCursor('u1')).state).toEqual(driveState(7));
  });

  it('saves the entry pending on the cursor before the briefing, and builds a plan with nothing from the old policy', async () => {
    world.attempts = [{ levelId: 5, logs: weakAt('lane_discipline'), passed: true }];
    const cursor: RoutingCursor = { state: driveState(5), outcome: 'passed', seq: 10, decisionsSpent: 100, pending: null };
    const run = await startCourseEntry({ uid: 'u1', group: 'optimized', cursor, attemptSeed: 0x5eed });

    expect(world.saved.cursors).toEqual([run.cursor]);
    expect(run.cursor.pending).toMatchObject({ starts: 1, attemptSeed: 0x5eed, group: 'optimized' });
    expect(run.plan).toMatchObject({ weakArea: null, practice: null, support: 'full', level: run.entry.level });
    expect(run.plan.record).toMatchObject({ source: 'routing', qState: null, action: null, practised: run.entry.item?.competency ?? null });
    expect(run.plan.record.applied).toEqual({ support: 'full', approachScale: 1 });
    expect(run.entry.item?.competency).toBe('lane_discipline');
    expect(world.saved.tableLoads).toBe(1);

    // Entered again: the same entry, its own seed, and the table is not needed.
    const again = await startCourseEntry({ uid: 'u1', group: 'optimized', cursor: run.cursor, attemptSeed: 1 });
    expect(again.attemptSeed).toBe(0x5eed);
    expect(again.cursor.pending!.starts).toBe(2);
    expect(again.plan.level!.events.map(e => e.id)).toEqual(run.plan.level!.events.map(e => e.id));
    expect(world.saved.tableLoads).toBe(1);
  });

  it('saves nothing for a guest', async () => {
    const cursor: RoutingCursor = { state: driveState(0), outcome: null, seq: 0, decisionsSpent: 0, pending: null };
    await startCourseEntry({ uid: null, group: 'conventional', cursor, attemptSeed: 3 });
    expect(world.calls).toEqual([]);
  });

  it('plays a free replay on the plain settings, outside the machine', async () => {
    const run = await startFreeReplay({ uid: 'u1', levelId: 3, attemptSeed: 7 });
    expect(run.plan).toMatchObject({ weakArea: null, practice: null, support: 'full' });
    expect(run.plan.record.source).toBe('routing');
    expect(world.calls).toEqual([]);
  });

  it('plays the post-test as the final exam with no hints, outside the machine, on one roll for everyone', async () => {
    const novice = await startPostTest({ uid: 'u1' });
    expect(novice).toMatchObject({ levelId: 12, attemptSeed: POST_TEST_SEED });
    expect(novice.plan).toMatchObject({ weakArea: null, practice: null, support: 'none' });
    expect(novice.plan.record.source).toBe('routing');
    expect(world.calls).toEqual([]);

    // A learner with a different history, weak somewhere else, meets the same test.
    world.attempts = [{ levelId: 5, logs: weakAt('parking') }];
    const practised = await startPostTest({ uid: 'u2' });
    expect(practised.route).toEqual(novice.route);
    expect(practised.plan.level).toEqual(novice.plan.level);
    expect(novice.route).toHaveLength(8);
  });
});

describe('completing an attempt', () => {
  const traces = (kinds: DecisionTrace['kind'][]): DecisionTrace[] =>
    kinds.map((kind, i) => ({ scenarioId: `s${i}`, kind, settlement: null, approach: null }));

  const conventional: RoutingGroupResolution = { mode: 'new', assignedGroup: 'conventional', groupInEffect: 'conventional', override: false };

  it('settles a course entry, counting its graded decisions but not its standing penalties, and saves the cursor last', async () => {
    const cursor: RoutingCursor = { state: driveState(3), outcome: 'passed', seq: 7, decisionsSpent: 60, pending: null };
    const run = await startCourseEntry({ uid: 'u1', group: 'conventional', cursor, attemptSeed: 0x5eed });
    world.calls = [];
    world.saved.cursors = [];
    const logs = [graded('road_signs', 'correct', 1), graded('speed_control', 'violation', 2), graded('road_signs', 'correct', 3)];
    const telemetry = buildLevelFsmTelemetry([], logs, traces(['road', 'penalty', 'garage']), []);
    const settled = await completeCourseAttempt({
      uid: 'u1', result: result(4, false, logs), telemetry, group: conventional,
      start: { attemptSeed: run.attemptSeed, plan: run.plan, level: run.plan.level! },
      course: { cursor: run.cursor, entry: run.entry },
    });

    expect(settled.cursor).toEqual({ state: driveState(4), outcome: 'failed', seq: 8, decisionsSpent: 62, pending: null });
    expect(settled.note).toBe('Continue to drive Level 4 again.');
    expect(world.calls.at(0)).toBe('attempt');
    expect(world.calls.at(-1)).toBe('cursor');
    expect(new Set(world.calls)).toEqual(new Set(['attempt', 'fsm', 'decisions', 'routing', 'cursor']));
    expect(world.saved.routing).toMatchObject({
      mode: 'new', groupInEffect: 'conventional', assignedGroup: 'conventional', override: false,
      driving: { support: 'full', approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
      entry: { kind: 'course', move: 'advance', gradedDecisions: 2, outcome: 'failed' },
    });
    expect(world.saved.routing!.log.map(e => e.seq)).toEqual([7]);
  });

  it('a crash is a fail', async () => {
    const run = await startCourseEntry({ uid: null, group: 'conventional', cursor: { state: driveState(2), outcome: null, seq: 0, decisionsSpent: 0, pending: null }, attemptSeed: 9 });
    const crashed = { ...result(2, false), score: 95, crashReason: 'Hit a parked car' };
    const settled = await completeCourseAttempt({
      uid: null, result: crashed, group: conventional,
      start: { attemptSeed: 9, plan: run.plan, level: run.plan.level! }, course: { cursor: run.cursor, entry: run.entry },
    });
    expect(settled.cursor.outcome).toBe('failed');
    expect(world.calls).toEqual([]);
  });

  it('a free replay is saved and recorded, and moves no cursor', async () => {
    const run = await startFreeReplay({ uid: 'u1', levelId: 3, attemptSeed: 7 });
    await completeFreeReplay({
      uid: 'u1', result: result(3, true), group: conventional, route: run.route,
      start: { attemptSeed: 7, plan: run.plan, level: run.plan.level! },
    });
    expect(world.calls).not.toContain('cursor');
    expect(world.saved.routing!.entry).toMatchObject({ kind: 'free-replay', levelId: 3, move: null, outcome: 'passed' });
  });

  it('the post-test is saved and recorded as the post-test, and moves no cursor', async () => {
    const run = await startPostTest({ uid: 'u1' });
    await completePostTest({
      uid: 'u1', result: result(12, false), group: conventional, route: run.route,
      start: { attemptSeed: run.attemptSeed, plan: run.plan, level: run.plan.level! },
    });
    expect(world.calls).not.toContain('cursor');
    expect(world.saved.attempt).toMatchObject({ levelId: 12 });
    expect(world.saved.routing!.entry).toMatchObject({
      kind: 'post-test', levelId: 12, move: null, cursorBefore: null, outcome: 'failed', route: run.route,
    });
    expect(world.saved.routing!.driving).toMatchObject({ support: 'none', approachScale: 1, liveReroll: false });
  });

  it('saves no post-test for a guest', async () => {
    const run = await startPostTest({ uid: null });
    await completePostTest({
      uid: null, result: result(12, true), group: conventional, route: run.route,
      start: { attemptSeed: run.attemptSeed, plan: run.plan, level: run.plan.level! },
    });
    expect(world.calls).toEqual([]);
  });

  it('Legacy saves what it always saved, records its group beside it, and suggests what it always suggested', async () => {
    world.mode = 'legacy';
    world.attempts = [{ levelId: 2, logs: weakAt('road_signs') }];
    provide();
    const plan = await buildAdaptivePlan('u1', 3, 0x5eed);
    const logs = [graded('road_signs', 'correct', 500)];
    const telemetry = buildLevelFsmTelemetry([], logs, traces(['road']), []);
    const recommendation = await completeMission({
      uid: 'u1', result: result(3, true, logs), telemetry, start: { attemptSeed: 0x5eed, plan, level: plan.level! },
      group: { mode: 'legacy', assignedGroup: null, groupInEffect: 'legacy', override: false },
    });

    expect(world.saved.attempt).toMatchObject({ levelId: 3, finalScore: 90, logs, fsmMetrics: telemetry.metrics });
    expect(Object.keys(world.saved.attempt!).sort()).toEqual(
      ['correctDecisions', 'finalScore', 'fsmMetrics', 'levelId', 'logs', 'reactionLatencies', 'timestamp', 'violations']
    );
    expect(world.calls).not.toContain('cursor');
    expect(world.saved.routing).toMatchObject({
      mode: 'legacy', groupInEffect: 'legacy', entry: null, log: [], options: GAME_OPTIONS,
      driving: { support: plan.support, liveReroll: true, practicePolicy: POLICY_TABLE_ID, weakAreaRoll: plan.weakArea !== null },
    });
    expect(recommendation).toEqual(getLevelRecommendation(weakAt('road_signs'), 3, GAME_OPTIONS.weakestTieBreak));
  });
});
