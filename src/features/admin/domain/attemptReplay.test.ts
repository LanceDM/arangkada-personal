import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import { driveState } from '@/domain/routing/routingTypes';
import {
  POST_TEST_SEED,
  type DecisionRecord,
  type DecisionTelemetryDoc,
  type RoutedEntryRecord,
  type RoutingTelemetryDoc,
  type StoredAttempt,
} from '@/features/driving-sim';
import {
  attemptList,
  attemptSummary,
  decisionRows,
  levelEntrySummary,
  moveLabel,
  routingSummary,
  matchesReplayPlayer,
  playerAttemptList,
  replayPlayers,
} from './attemptReplay';
import type { UserRow } from './adminReport';

const T0 = Date.UTC(2026, 9, 17, 1, 0, 0);

const log = (timestamp: number, result: ActionLog['result'], extra: Partial<ActionLog> = {}): ActionLog => ({
  timestamp,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : result === 'violation' ? -10 : 0,
  competency: 'pedestrians',
  ...extra,
});

const record = (logIndex: number, extra: Partial<DecisionRecord> = {}): DecisionRecord => ({
  logIndex,
  timestamp: T0 + logIndex,
  scenarioId: `level2.${logIndex}.a`,
  kind: 'road',
  settlement: 'response',
  competency: 'pedestrians',
  result: 'correct',
  points: 10,
  remediation: false,
  support: 'full',
  theta: { requested: 1, effective: 1, baselineLead: 400, lead: 400, room: null, floor: 120 },
  reaction: { ms: 812 },
  bktBefore: 0.41,
  bktAfter: 0.47,
  ...extra,
});

const decisions = (records: DecisionRecord[], extra: Partial<DecisionTelemetryDoc> = {}): DecisionTelemetryDoc =>
  ({
    schemaVersion: 1,
    levelId: 2,
    attemptSeed: 4242,
    route: ['level2.0.a', 'level2.1.a', 'level1.3.b'],
    bkt: {},
    policy: {
      source: 'routing',
      requested: { support: null, approachScale: null },
      applied: { support: 'full', approachScale: 1 },
    },
    rerolls: [],
    decisions: records,
    truncated: false,
    totalCount: records.length,
    ...extra,
  }) as unknown as DecisionTelemetryDoc;

const courseEntry = (extra: Partial<RoutedEntryRecord> = {}): RoutedEntryRecord => ({
  kind: 'course',
  levelId: 2,
  gradedDecisions: 3,
  outcome: 'passed',
  route: ['level2.0.a', 'level2.1.a'],
  cursorBefore: { state: 'DRIVE(1)', outcome: 'passed', seq: 1, decisionsSpent: 9 },
  cursorAfter: { state: 'DRIVE(2)', outcome: 'passed', seq: 2, decisionsSpent: 12 },
  starts: 1,
  move: 'advance+practice(pedestrians)',
  legal: ['advance', 'advance+practice(pedestrians)'],
  destination: 2,
  item: { competency: 'pedestrians', scenarioId: 'level1.3.b', sourceLevelId: 1 },
  review: null,
  decidedIn: 'optimized',
  observation: null,
  ...extra,
});

const routing = (entry: RoutedEntryRecord | null, extra: Partial<RoutingTelemetryDoc> = {}): RoutingTelemetryDoc =>
  ({
    schemaVersion: 1,
    mode: 'new',
    assignedGroup: 'optimized',
    groupInEffect: 'optimized',
    override: false,
    options: {},
    driving: { support: 'full', approachScale: 1, weakAreaRoll: false, liveReroll: false, practicePolicy: null },
    entry,
    play: null,
    log: [],
    truncated: false,
    totalCount: 0,
    ...extra,
  }) as unknown as RoutingTelemetryDoc;

const stored = (id: string, extra: Partial<StoredAttempt> = {}, logs: ActionLog[] = [log(T0, 'correct')]): StoredAttempt => ({
  id,
  attempt: { levelId: 2, timestamp: T0 + 5 * 60_000, finalScore: 90, violations: 0, correctDecisions: logs.length, logs },
  fsm: { transitions: [{ from: 'IDLE', to: 'DRIVING', trigger: 'start', timestamp: T0 - 60_000, snapshot: { gameplay: 'DRIVING', competency: 'unassigned' }, params: { approachScale: 1, reactionScale: 1 } }], truncated: false, totalCount: 480 },
  decisions: decisions([record(0)]),
  routing: routing(courseEntry()),
  ...extra,
});

describe('attemptList', () => {
  it('numbers the attempts oldest first, names their kind, and carries no score', () => {
    const list = attemptList([
      stored('a'),
      stored('b', { routing: routing(null) }),
      stored('c', { routing: null }),
      stored('d', { routing: routing(courseEntry({ kind: 'post-test' })) }),
    ]);
    expect(list.map(item => [item.id, item.number, item.kind])).toEqual([
      ['a', 1, 'course'],
      ['b', 2, 'legacy'],
      ['c', 3, 'unrecorded'],
      ['d', 4, 'post-test'],
    ]);
    expect(list[0]).toMatchObject({ levelId: 2, level: expect.stringMatching(/^Level 2/), decisions: 1 });
    expect(Object.keys(list[0]).sort()).toEqual(['decisions', 'id', 'kind', 'level', 'levelId', 'number', 'savedAt']);
  });
});

describe('decisionRows', () => {
  it('joins each logged decision to its record by log index, and falls back to the log where there is none', () => {
    const logs = [
      log(T0, 'correct'),
      log(T0 + 1, 'violation', { reactionTime: 1500, ruleId: 'R-12', remediation: true, sourceLevelId: 1 }),
      log(T0 + 2, 'violation'),
      log(T0 + 3, 'neutral', { reactionCensored: true }),
    ];
    const rows = decisionRows(
      stored('a', {
        decisions: decisions([
          record(0, { theta: { requested: 1.5, effective: 1.38, baselineLead: 400, lead: 552, room: 552, floor: 120 } }),
          record(2, { result: 'violation', settlement: 'expired', reaction: { censored: true }, bktBefore: 0.5, bktAfter: 0.31 }),
        ]),
      }, logs)
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      recorded: true,
      scenarioId: 'level2.0.a',
      verdict: 'correct',
      response: { kind: 'timed', ms: 812 },
      support: 'full',
      theta: { requested: 1.5, effective: 1.38 },
      bkt: { before: 0.41, after: 0.47 },
    });
    expect(rows[1]).toMatchObject({
      recorded: false,
      scenarioId: null,
      rule: 'R-12',
      verdict: 'violation',
      practiceItem: true,
      response: { kind: 'timed', ms: 1500 },
      theta: null,
      bkt: null,
    });
    expect(rows[2]).toMatchObject({ recorded: true, settlement: 'expired', response: { kind: 'censored' }, bkt: { before: 0.5, after: 0.31 } });
    expect(rows[3]).toMatchObject({ recorded: false, verdict: 'neutral', response: { kind: 'censored' } });
  });

  it('records no response for a question', () => {
    const rows = decisionRows(stored('a', { decisions: decisions([record(0, { kind: 'garage', settlement: 'question', reaction: null, support: null, theta: null })]) }));
    expect(rows[0]).toMatchObject({ response: { kind: 'none' }, support: null, theta: null });
  });
});

describe('levelEntrySummary', () => {
  it('reads what the level was played at from the decision record, else from the routing record', () => {
    expect(levelEntrySummary(stored('a'))).toMatchObject({
      source: 'routing',
      applied: { support: 'full', approachScale: 1 },
      route: ['level2.0.a', 'level2.1.a', 'level1.3.b'],
      rerolls: [],
    });
    expect(levelEntrySummary(stored('a', { decisions: null }))).toMatchObject({
      source: null,
      applied: { support: 'full', approachScale: 1 },
      route: ['level2.0.a', 'level2.1.a'],
    });
    expect(levelEntrySummary(stored('a', { decisions: null, routing: null }))).toMatchObject({ applied: null, route: null });
  });
});

describe('moveLabel', () => {
  it('names every kind of routing move', () => {
    expect(moveLabel('advance')).toBe('Advance to the next level');
    expect(moveLabel('retry+practice(parking)')).toBe('Retry the level, with a practice item for Parking Compliance');
    expect(moveLabel('review(2,hazard_awareness)')).toBe('Review Level 2 for Hazard Awareness');
    expect(moveLabel('to_final')).toBe('Go to the Final Mission');
    expect(moveLabel('something-new')).toBe('something-new');
  });
});

describe('routingSummary', () => {
  it('names the move, the legal moves and the log entries the attempt added', () => {
    const summary = routingSummary(
      stored('a', {
        routing: routing(courseEntry(), {
          log: [
            {
              seq: 2,
              from: driveState(1),
              to: driveState(2),
              transition: { kind: 'advance', practice: 'pedestrians' },
              outcome: 'passed',
              legal: [],
              at: T0,
            },
          ],
        }),
      })
    );
    expect(summary.move).toEqual({ id: 'advance+practice(pedestrians)', label: 'Advance to the next level, with a practice item for Pedestrian Safety' });
    expect(summary.legal.map(move => move.id)).toEqual(['advance', 'advance+practice(pedestrians)']);
    expect(summary.log).toEqual([{ seq: 2, from: 'DRIVE(1)', to: 'DRIVE(2)', transition: 'advance+practice(pedestrians)', outcome: 'passed', at: T0 }]);
    expect(summary.postTestSeed).toBeNull();
  });

  it("checks a post-test's roll against the fixed seed", () => {
    const postTest = (attemptSeed: number) =>
      routingSummary(
        stored('p', {
          routing: routing(courseEntry({ kind: 'post-test', move: null, legal: [], cursorBefore: null, cursorAfter: null, item: null })),
          decisions: decisions([], { attemptSeed }),
        })
      );
    expect(postTest(POST_TEST_SEED).postTestSeed).toEqual({ seed: POST_TEST_SEED, fixed: POST_TEST_SEED, matches: true });
    expect(postTest(POST_TEST_SEED + 1).postTestSeed).toMatchObject({ matches: false });
    expect(postTest(POST_TEST_SEED).move).toBeNull();
  });

  it('reads an attempt with no routing record', () => {
    expect(routingSummary(stored('a', { routing: null }))).toMatchObject({ kind: 'unrecorded', record: null, move: null, legal: [], log: [] });
  });
});

describe('attemptSummary', () => {
  it('times the drive as the export does, and says which records are there', () => {
    const attempt = stored('a', { routing: null });
    const summary = attemptSummary(attempt, attemptList([attempt])[0]);
    expect(summary.durationMs).toBe(6 * 60_000);
    expect(summary.seed).toBe(4242);
    expect(summary.records).toEqual({
      fsm: { present: true, truncated: false, totalCount: 480 },
      decisions: { present: true, truncated: false, totalCount: 1 },
      routing: { present: false, truncated: false, totalCount: null },
    });
  });
});

describe('replayPlayers', () => {
  const user = (id: string, username: string, email: string): UserRow => ({
    id, username, email, createdAt: T0, totalScore: 0, longestStreak: 0, bestExamScore: 0,
  });
  const users = [
    user('pool-1', 'P01', ''),
    user('u-zoe', 'zoe', 'zoe@example.test'),
    user('u-ana', 'Ana', 'ana@example.test'),
    user('u-kim', '', 'kim@example.test'),
    user('u-0123456789', '', ''),
  ];

  it('lists every account outside the pool by name, the email else the id standing in for a missing one', () => {
    expect(replayPlayers(users, new Set(['pool-1']))).toEqual([
      { uid: 'u-ana', name: 'Ana', email: 'ana@example.test' },
      { uid: 'u-kim', name: 'kim@example.test', email: 'kim@example.test' },
      { uid: 'u-0123456789', name: 'u-012345', email: null },
      { uid: 'u-zoe', name: 'zoe', email: 'zoe@example.test' },
    ]);
  });

  it('searches by name or email, ignoring case', () => {
    const players = replayPlayers(users, new Set(['pool-1']));
    expect(players.filter(player => matchesReplayPlayer(player, 'ANA')).map(player => player.uid)).toEqual(['u-ana']);
    expect(players.filter(player => matchesReplayPlayer(player, 'kim@')).map(player => player.uid)).toEqual(['u-kim']);
    expect(players.filter(player => matchesReplayPlayer(player, '  '))).toHaveLength(4);
  });
});

describe('playerAttemptList', () => {
  it("lists a player's attempts from their documents alone, with no kind and no score", () => {
    const list = playerAttemptList([
      { id: 'x', savedAt: T0, data: { levelId: 3, finalScore: 90, logs: [log(T0, 'correct'), log(T0 + 1, 'violation')] } },
      { id: 'y', savedAt: T0 + 1, data: {} },
    ]);
    expect(list).toEqual([
      { id: 'x', number: 1, levelId: 3, level: expect.stringMatching(/^Level 3/), kind: null, savedAt: T0, decisions: 2 },
      { id: 'y', number: 2, levelId: -1, level: expect.any(String), kind: null, savedAt: T0 + 1, decisions: 0 },
    ]);
  });
});
