/**
 * The routing FSM in the game: the cursor, the
 * decision, the entry and its settlement.
 *
 * These pin the pieces: where a player starts, what the learned policy reads
 * as its budget, that every entry
 * is played on the plain FSM's settings, that a left entry is entered again
 * unchanged, and how a review and the final exam end.
 */
import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { ROUTING_Q_STATES, type RoutingTable } from '@/domain/learner/adaptive/routingQPolicy';
import {
  CERTIFIED_STATE,
  COURSE_LEVELS,
  FINAL_EXAM_LEVEL,
  FINAL_STATE,
  driveState,
  stateId,
  transitionId,
  type FrontierState,
  type Outcome,
} from '@/domain/routing/routingTypes';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { levelSupport } from './practiceSelection';
import {
  cursorFrontierLevel,
  enterCourseEntry,
  freeReplayLevel,
  nextCourseEntry,
  readStoredCursor,
  settleCourseEntry,
  startingCursor,
  storedCursor,
  type OptimizedRouting,
  type PendingEntry,
  type RoutingCursor,
  type RoutingGroup,
} from './courseRouting';

const graded = (competency: DrivingCompetency, result: ActionLog['result'], timestamp: number): ActionLog => ({
  timestamp,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency,
});

/** Every competency answered right twice, then one missed twice: BKT's weakest is `weak`. */
const weakAt = (weak: DrivingCompetency): ActionLog[] => [
  ...COMPETENCIES.flatMap((c, i) => [graded(c, 'correct', i * 2), graded(c, 'correct', i * 2 + 1)]),
  graded(weak, 'violation', 100),
  graded(weak, 'violation', 101),
];

/** A table whose every row asks for practice on the weakest first. */
const PRACTISE_WEAKEST: RoutingTable = Object.fromEntries(
  ROUTING_Q_STATES.map(state => [state, ['weakest', 'related', 'review', 'none']])
) as unknown as RoutingTable;

const optimizedWith = (table: RoutingTable): OptimizedRouting => ({ table, tableId: 'test', seed: 0, budgetSize: 336 });

const cursorAt = (state: FrontierState, outcome: Outcome | null, decisionsSpent = 0): RoutingCursor => ({
  state, outcome, seq: 4, decisionsSpent, pending: null,
});

const decide = (cursor: RoutingCursor, group: RoutingGroup, history: ActionLog[] = [], attemptSeed = 0x5eed, table = PRACTISE_WEAKEST) =>
  nextCourseEntry({ cursor, group, history, attemptSeed, coverage: {}, optimized: group === 'optimized' ? optimizedWith(table) : null });

describe('where a player starts', () => {
  it('is the first level in course order they have not passed', () => {
    expect(startingCursor(new Set()).state).toEqual(driveState(0));
    expect(startingCursor(new Set([0, 1, 2])).state).toEqual(driveState(3));
    expect(startingCursor(new Set([0, 1, 3])).state).toEqual(driveState(2));
    expect(startingCursor(new Set(COURSE_LEVELS)).state).toEqual(FINAL_STATE);
    expect(startingCursor(new Set([...COURSE_LEVELS, FINAL_EXAM_LEVEL])).state).toEqual(CERTIFIED_STATE);
  });

  it('plays that level as it stands, with nothing spent and nothing pending', () => {
    const cursor = startingCursor(new Set([0]));
    expect(cursor).toMatchObject({ outcome: null, seq: 0, decisionsSpent: 0, pending: null });
    expect(cursorFrontierLevel(cursor)).toBe(1);
    const entry = enterCourseEntry(decide(cursor, 'conventional'));
    expect(entry.levelId).toBe(1);
    expect(entry.pending.transition).toBeNull();
    expect(entry.fsm.getTransitionLog()).toEqual([]);
  });

  it('has nothing left to enter once certified', () => {
    expect(cursorFrontierLevel(startingCursor(new Set([...COURSE_LEVELS, FINAL_EXAM_LEVEL])))).toBeNull();
    expect(() => decide({ ...cursorAt(FINAL_STATE, null), state: CERTIFIED_STATE }, 'conventional')).toThrow();
  });
});

describe('every course entry is played on the plain FSM\'s settings', () => {
  const states: FrontierState[] = [...COURSE_LEVELS.map(driveState), FINAL_STATE];

  it('in both groups, at every frontier and on either verdict', () => {
    for (const group of ['conventional', 'optimized'] as const) {
      for (const state of states) {
        for (const outcome of ['passed', 'failed'] as const) {
          if (state.kind === 'FINAL' && outcome === 'passed') continue; // certifies at the attempt's end
          for (const history of [[], weakAt('road_signs'), weakAt('parking'), weakAt('general_rules')]) {
            const entry = enterCourseEntry(decide(cursorAt(state, outcome), group, history));
            const { level, rolled, item } = entry;
            expect(entry.support).toBe(levelSupport(entry.levelId, null));
            expect(level.events.length).toBe(rolled.events.length + (item ? 1 : 0));
            if (item) {
              const appended = level.events.at(-1)!;
              expect(appended.id).toBe(item.scenarioId);
              expect(appended.remediation).toBe(true);
              // The item is of the competency the transition named, and no other.
              expect(entry.pending.transition).toMatchObject({ practice: item.competency });
            }
            if (entry.levelId === FINAL_EXAM_LEVEL || entry.review) expect(item).toBeNull();
            if (group === 'conventional') expect(item).toBeNull();
          }
        }
      }
    }
  });

  it('Conventional takes the pass guard\'s move and nothing else, reading the weakest competency only to record it', () => {
    const pending = decide(cursorAt(driveState(5), 'passed'), 'conventional', weakAt('lane_discipline'));
    expect(pending.transition).toEqual({ kind: 'advance', practice: null });
    expect(pending.observation).toMatchObject({ weakest: 'lane_discipline', asked: false, size: null, qState: null });
    expect(decide(cursorAt(driveState(5), 'failed'), 'conventional').transition).toEqual({ kind: 'retry', practice: null });
    expect(decide(cursorAt(driveState(11), 'passed'), 'conventional').transition).toEqual({ kind: 'to_final' });
  });
});

describe("the learned policy's budget input", () => {
  it('is graded decisions of course entries against 336: more below 168, less from 168 on, and less for ever after', () => {
    const at = (spent: number) =>
      decide(cursorAt(driveState(5), 'passed', spent), 'optimized', weakAt('lane_discipline')).observation;
    expect(at(0)).toMatchObject({ budgetLeft: 'more', size: 336, spent: 0, asked: true });
    expect(at(167).budgetLeft).toBe('more');
    expect(at(168).budgetLeft).toBe('less');
    expect(at(400).budgetLeft).toBe('less');
    expect(at(167).qState).toBe('middle:critical:passed:more');
    expect(at(168).qState).toBe('middle:critical:passed:less');
  });

  it('records the row the learned policy read and the action its move came from', () => {
    const observation = decide(cursorAt(driveState(5), 'passed'), 'optimized', weakAt('lane_discipline')).observation;
    expect(observation.row).toEqual(PRACTISE_WEAKEST['middle:critical:passed:more']);
    expect(observation.action).toBe('weakest');
    expect(observation.tableId).toBe('test');
  });

  it('is not asked with no history, where no weakest competency can be read: the plain move', () => {
    const pending = decide(cursorAt(driveState(1), 'passed'), 'optimized', []);
    expect(pending.transition).toEqual({ kind: 'advance', practice: null });
    expect(pending.observation.asked).toBe(false);
  });
});

describe('an entry left unfinished', () => {
  it('is entered again exactly: the same move, route and item, counted as a second start', () => {
    const first = decide(cursorAt(driveState(5), 'passed'), 'optimized', weakAt('lane_discipline'));
    const pendingCursor: RoutingCursor = { ...cursorAt(driveState(5), 'passed'), pending: first };
    // A different seed, history and group are ignored: the decision stands.
    const again = nextCourseEntry({ cursor: pendingCursor, group: 'conventional', history: [], attemptSeed: 1, coverage: { Stop: { seen: 3, correct: 0, wrong: 3, lastSeenAt: 9 } }, optimized: null });
    expect(again).toEqual({ ...first, starts: 2 });
    const a = enterCourseEntry(first);
    const b = enterCourseEntry(again);
    expect(b.level.events.map(e => e.id)).toEqual(a.level.events.map(e => e.id));
    expect(b.item).toEqual(a.item);
    expect(b.fsm.getTransitionLog()).toEqual(a.fsm.getTransitionLog());
  });
});

describe('settling an entry', () => {
  const review: PendingEntry = {
    from: driveState(2),
    outcome: 'passed',
    transition: { kind: 'review', level: 2, competency: 'general_rules' },
    group: 'optimized',
    attemptSeed: 0x5eed,
    coverage: {},
    observation: { weakest: 'general_rules', weakestScore: 20, spent: 30, size: 336, budgetLeft: 'more', asked: true, qState: 'early:critical:passed:more', row: ['review', 'none'], action: 'review', tableId: 'test' },
    starts: 1,
  };

  it('a review replays its level with nothing added, then returns to its frontier whatever it scored', () => {
    for (const outcome of ['passed', 'failed'] as const) {
      const entry = enterCourseEntry(review);
      expect(entry.levelId).toBe(2);
      expect(entry.review).toEqual({ level: 2, competency: 'general_rules' });
      expect(entry.item).toBeNull();
      expect(stateId(entry.fsm.getState())).toBe('REVIEW(2->DRIVE(3))');

      const cursor = { ...cursorAt(driveState(2), 'passed', 30), pending: review };
      const settled = settleCourseEntry(cursor, entry, outcome, 12);
      expect(settled.cursor).toEqual({ state: driveState(3), outcome: null, seq: 6, decisionsSpent: 42, pending: null });
      expect(settled.log.map(e => [e.seq, transitionId(e.transition)])).toEqual([[4, 'review(2,general_rules)'], [5, 'return']]);
    }
  });

  it('a passed final exam certifies; a failed one waits to be retried', () => {
    const final = enterCourseEntry(decide(cursorAt(FINAL_STATE, null), 'conventional'));
    expect(final.levelId).toBe(FINAL_EXAM_LEVEL);
    const passed = settleCourseEntry(cursorAt(FINAL_STATE, null), final, 'passed', 8);
    expect(passed.cursor.state).toEqual(CERTIFIED_STATE);
    expect(passed.log.map(e => transitionId(e.transition))).toEqual(['certify']);

    const again = enterCourseEntry(decide(cursorAt(FINAL_STATE, null), 'conventional'));
    expect(settleCourseEntry(cursorAt(FINAL_STATE, null), again, 'failed', 8).cursor).toMatchObject({ state: FINAL_STATE, outcome: 'failed' });
    const retry = enterCourseEntry(decide(cursorAt(FINAL_STATE, 'failed'), 'optimized', weakAt('parking')));
    expect(retry.pending.transition).toEqual({ kind: 'retry', practice: null });
    expect(retry.item).toBeNull();
  });

  it('any other entry leaves its verdict on the cursor for the next decision', () => {
    const entry = enterCourseEntry(decide(cursorAt(driveState(4), 'passed'), 'conventional'));
    const settled = settleCourseEntry(cursorAt(driveState(4), 'passed', 100), entry, 'failed', 9);
    expect(settled.cursor).toEqual({ state: driveState(5), outcome: 'failed', seq: 5, decisionsSpent: 109, pending: null });
  });

  it('a move the machine does not list is refused, never substituted', () => {
    expect(() => enterCourseEntry({ ...review, transition: { kind: 'review', level: 2, competency: 'parking' } })).toThrow(/refused/);
    expect(() => enterCourseEntry({ ...review, transition: { kind: 'advance', practice: 'parking' } })).toThrow(/refused/);
  });
});

describe('a free replay', () => {
  it('rolls the level on the plain FSM\'s settings with nothing added', () => {
    for (const level of LEVELS) {
      const played = freeReplayLevel(level.id, 0x5eed, {});
      expect(played.support).toBe(levelSupport(level.id, null));
      expect(played.level).toBe(played.rolled);
    }
  });
});

describe('the stored cursor', () => {
  it('reads back as it was written, coverage included', () => {
    const pending = decide(cursorAt(driveState(3), 'failed'), 'optimized', weakAt('road_signs'));
    const cursor: RoutingCursor = {
      ...cursorAt(driveState(3), 'failed', 77),
      pending: { ...pending, coverage: { 'No Entry': { seen: 2, correct: 1, wrong: 1, lastSeenAt: 5 } } },
    };
    const stored = JSON.parse(JSON.stringify(storedCursor(cursor, 123)));
    expect(stored.pending.coverage).toEqual([{ name: 'No Entry', seen: 2, correct: 1, wrong: 1, lastSeenAt: 5 }]);
    expect(readStoredCursor(stored)).toEqual(cursor);
    expect(readStoredCursor({ ...stored, schemaVersion: 2 })).toBeNull();
    expect(readStoredCursor(null)).toBeNull();
  });
});
