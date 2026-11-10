import { describe, expect, it } from 'vitest';
import { MASTERY_BUCKETS, masteryBucket } from '@/domain/learner/adaptive/qLearningPolicy';
import {
  BUDGET_LEFT,
  ROUTING_ACTIONS,
  ROUTING_Q_STATES,
  ROUTING_STAGES,
  budgetLeft,
  legalRoutingActions,
  routingStage,
} from '@/domain/learner/adaptive/routingQPolicy';
import { OUTCOMES, PROBE_NAMES, probeContext } from '@/domain/routing/characterizeRouting';
import { legalTransitions } from '@/domain/routing/routingTable';
import { COMPETENCIES } from '@/domain/learner/profile';
import { ROUTING_STATES, stateId, transitionId } from '@/domain/routing/routingTypes';
import type { StoredAttempt } from '@/features/driving-sim';
import { designatedRoutingPolicyOf, routingTableId } from './designatedRoutingPolicy';
import { ACTION_LABEL, Q_BOARD_COLUMNS, qBoard, qChecksHold, qChoices, qDimensionLabels, qGrid, qPoolVisits, qStateParts, type QPoolAccount } from './qMapping';
import { movesFromIds, routingGraph } from './routingGraph';
import { playCourse, type FixtureEntry } from './routingRecords.fixture';
import results from './designatedRoutingTable.json';

const graph = routingGraph();
const designated = designatedRoutingPolicyOf(results);

const COURSE: FixtureEntry[] = [
  { outcome: 'passed' },
  { outcome: 'passed', probe: 'open' },
  { outcome: 'failed', probe: 'open' },
  { outcome: 'passed', probe: 'open', weakest: { competency: 'parking', score: 55 } },
  { outcome: 'passed', probe: 'gap' },
  { outcome: 'passed' },
  { outcome: 'passed', probe: 'none' },
  { outcome: 'passed', probe: 'open', weakest: null },
];

const optimized = (entries = COURSE, idPrefix = 'o') =>
  playCourse({ group: 'optimized', entries, table: designated.table, tableId: designated.tableId, budgetSize: designated.budgetSize, idPrefix });

describe('the designated table', () => {
  it('is the one the game plays, read and checked as the game reads it', () => {
    expect(designated.tableId).toBe('553a49a0');
    expect(routingTableId(designated.table)).toBe('553a49a0');
    expect(designated.seed).toBe(11);
    expect(designated.budgetSize).toBe(336);
  });
});

describe('the grid', () => {
  const grid = qGrid(designated.table);

  it("has the policy's 36 states in its order, by its 4 actions", () => {
    expect(grid.map(row => row.state)).toEqual(ROUTING_Q_STATES);
    for (const row of grid) {
      expect(Object.keys(row.rank)).toEqual(ROUTING_ACTIONS);
      expect(`${row.stage}:${row.mastery}:${row.outcome}:${row.budget}`).toBe(row.state);
      expect(ROUTING_STAGES).toContain(row.stage);
      expect(MASTERY_BUCKETS).toContain(row.mastery);
      expect(OUTCOMES).toContain(row.outcome);
      expect(BUDGET_LEFT).toContain(row.budget);
    }
  });

  it("shows each row's order as the table holds it", () => {
    for (const row of grid) {
      expect(row.order).toEqual(designated.table[row.state]);
      for (const action of ROUTING_ACTIONS) {
        const at = designated.table[row.state].indexOf(action);
        expect(row.rank[action]).toBe(at === -1 ? null : at + 1);
      }
    }
  });

  it('marks the rows training never visited as untrained', () => {
    const untrained = grid.filter(row => row.untrained).map(row => row.state);
    expect(untrained).toHaveLength(8);
    expect(untrained.every(state => /^early:(weak|ok):/.test(state))).toBe(true);
    expect(grid.find(row => row.state === 'middle:critical:failed:less')).toMatchObject({ untrained: false, order: ['none'] });
  });
});

describe('the board', () => {
  const board = qBoard(qGrid(designated.table));

  it("puts every state on exactly one tile, in the policy's order", () => {
    const tiles = board.flatMap(zone => zone.rows.flatMap(row => row.tiles.map(tile => tile.state)));
    expect(tiles).toEqual(ROUTING_Q_STATES);
  });

  it('has a zone per stage, a row per mastery bucket, a column per verdict and budget', () => {
    expect(board.map(zone => zone.stage)).toEqual(ROUTING_STAGES);
    expect(Q_BOARD_COLUMNS).toEqual(OUTCOMES.flatMap(outcome => BUDGET_LEFT.map(budget => ({ outcome, budget }))));
    for (const zone of board) {
      expect(zone.rows.map(row => row.mastery)).toEqual(MASTERY_BUCKETS);
      for (const row of zone.rows) {
        expect(row.tiles.map(tile => ({ outcome: tile.outcome, budget: tile.budget }))).toEqual(Q_BOARD_COLUMNS);
        for (const tile of row.tiles) expect([tile.stage, tile.mastery]).toEqual([zone.stage, row.mastery]);
      }
    }
  });
});

describe('the labels', () => {
  const labels = qDimensionLabels(designated.budgetSize);

  it("take their numbers from the functions that decide them", () => {
    expect(labels.stage.early.levels).toBe('Levels 0–4');
    expect(labels.stage.middle.levels).toBe('Levels 5–8');
    expect(labels.stage.late.levels).toBe('Levels 9–11');
    expect([routingStage(4), routingStage(5), routingStage(8), routingStage(9)]).toEqual(['early', 'middle', 'middle', 'late']);
    expect(labels.mastery.critical.range).toBe('below 40');
    expect(labels.mastery.weak.range).toBe('40 to under 70');
    expect(labels.mastery.ok.range).toBe('70 or more');
    expect([masteryBucket(39.9), masteryBucket(40), masteryBucket(69.9), masteryBucket(70)]).toEqual(['critical', 'weak', 'weak', 'ok']);
    expect(labels.budget.more.range).toBe('under 168 of 336 decisions spent');
    expect(labels.budget.less.range).toBe('168 or more of 336 spent');
    expect([budgetLeft({ spent: 167, size: 336 }), budgetLeft({ spent: 168, size: 336 })]).toEqual(['more', 'less']);
  });

  it('cover every value of every dimension and every action', () => {
    expect(Object.keys(labels.stage)).toEqual(ROUTING_STAGES);
    expect(Object.keys(labels.mastery)).toEqual(MASTERY_BUCKETS);
    expect(Object.keys(labels.budget)).toEqual(BUDGET_LEFT);
    expect(Object.keys(ACTION_LABEL)).toEqual(ROUTING_ACTIONS);
  });

  it('parse only the 36 states', () => {
    expect(qStateParts('late:ok:failed:less')).toEqual({ stage: 'late', mastery: 'ok', outcome: 'failed', budget: 'less' });
    expect(qStateParts('late:ok:failed')).toBeNull();
    expect(qStateParts('soon:ok:failed:less')).toBeNull();
  });
});

describe("an Optimized account's choices", () => {
  it('are every move the table was asked for, read back as the policy decides', () => {
    const attempts = optimized();
    const { choices, unasked } = qChoices(attempts, designated, graph);
    const asked = attempts.filter(stored => stored.routing?.entry?.observation?.asked);
    expect(choices.map(choice => choice.attempt.id)).toEqual(asked.map(stored => stored.id));
    expect(choices.length).toBeGreaterThanOrEqual(4);
    expect(qChecksHold(choices)).toBe(true);
    for (const choice of choices) {
      expect(choice.row).toEqual(designated.table[choice.qState as keyof typeof designated.table]);
      expect(choice.legal.some(each => each.action === 'none')).toBe(true);
      expect([...choice.legal.map(each => each.action), ...choice.masked].sort()).toEqual([...ROUTING_ACTIONS].sort());
      if (choice.action) expect(choice.legal.find(each => each.action === choice.action)?.move).toBe(choice.move);
    }
    // The tutorial's pass, at early:critical:passed:more, practises the weakest.
    expect(choices[0]).toMatchObject({ qState: 'early:critical:passed:more', action: 'weakest', move: 'advance+practice(lane_discipline)' });
    // A pass with no practice content anywhere: the weakest is masked, and the table reviews.
    expect(choices.find(choice => choice.action === 'review')).toMatchObject({ masked: expect.arrayContaining(['weakest', 'related']) });
    expect(unasked.map(each => each.reason).sort()).toEqual(['no-reading', 'one-action']);
  });

  it('decide the legal actions from the machine\'s own moves, in every cell', () => {
    for (const state of ROUTING_STATES) {
      for (const outcome of OUTCOMES) {
        for (const probe of PROBE_NAMES) {
          const legal = legalTransitions(state, probeContext(probe, outcome));
          if (legal.length === 0) continue;
          const rebuilt = movesFromIds(graph, stateId(state), legal.map(move => transitionId(move.transition)))!;
          for (const competency of COMPETENCIES) {
            expect(legalRoutingActions(rebuilt, competency)).toEqual(legalRoutingActions(legal, competency));
          }
        }
      }
    }
  });

  it('flag a record that does not agree with the table', () => {
    const attempts = optimized();
    const tamper = (change: (entry: NonNullable<NonNullable<StoredAttempt['routing']>['entry']>) => void) => {
      const copy = structuredClone(attempts);
      const first = copy.find(stored => stored.routing?.entry?.observation?.asked)!;
      change(first.routing!.entry!);
      return qChoices(copy, designated, graph).choices[0].checks;
    };
    expect(tamper(entry => (entry.observation!.tableId = 'deadbeef'))).toMatchObject({ table: false, row: true, action: true });
    expect(tamper(entry => (entry.observation!.row = ['none']))).toMatchObject({ row: false });
    expect(tamper(entry => (entry.observation!.action = 'related'))).toMatchObject({ action: false });
    expect(tamper(entry => (entry.legal = [...entry.legal, 'certify']))).toMatchObject({ legal: false });
  });

  it('are nothing for a Conventional account, whose moves the table never decides', () => {
    const conventional = playCourse({ group: 'conventional', entries: COURSE });
    expect(qChoices(conventional, designated, graph)).toEqual({ choices: [], unasked: [] });
  });
});

describe("the pool's visits", () => {
  it('count the states read and the actions taken, over Optimized participants only', () => {
    const accounts: QPoolAccount[] = [
      { code: 'P01', cohort: 'study', group: 'conventional', attempts: playCourse({ group: 'conventional', entries: COURSE, idPrefix: 'c' }) },
      { code: 'P02', cohort: 'study', group: 'optimized', attempts: optimized(COURSE, 'o') },
      { code: 'P04', cohort: 'study', group: 'optimized', attempts: optimized(COURSE.slice(0, 3), 'p') },
      { code: 'E01B', cohort: 'test', group: 'optimized', attempts: optimized(COURSE, 'e') },
    ];
    const visits = qPoolVisits(accounts, designated, graph);
    const one = qChoices(accounts[1].attempts, designated, graph);
    const two = qChoices(accounts[2].attempts, designated, graph);
    expect(visits.accounts).toBe(2);
    expect(visits.choices).toBe(one.choices.length + two.choices.length);
    expect(visits.unasked).toBe(one.unasked.length + two.unasked.length);
    expect(Object.keys(visits.byState)).toEqual(ROUTING_Q_STATES);
    const total = Object.values(visits.byState).reduce((sum, state) => sum + state.visits, 0);
    expect(total).toBe(visits.choices);
    for (const state of Object.values(visits.byState)) {
      expect(Object.values(state.taken).reduce((sum, count) => sum + count, 0)).toBe(state.visits);
    }
    const both = [...one.choices, ...two.choices];
    for (const state of ROUTING_Q_STATES) {
      const here = both.filter(choice => choice.qState === state);
      expect(visits.byState[state].visits).toBe(here.length);
      for (const action of ROUTING_ACTIONS) {
        expect(visits.byState[state].taken[action]).toBe(here.filter(choice => choice.action === action).length);
      }
    }
    expect(visits.byState['early:critical:passed:more'].taken.weakest).toBeGreaterThan(0);
    expect(JSON.stringify(visits)).not.toMatch(/score|accuracy/i);
  });
});
