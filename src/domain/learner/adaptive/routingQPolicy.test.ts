import { describe, it, expect } from 'vitest';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { createRng } from '@/shared/lib/rng';
import type { PracticeAvailability, ReviewLevel, RoutingContext, RoutingMove } from '@/domain/routing/routingTypes';
import { FINAL_STATE, REVIEW_LEVELS, ROUTING_STATES, driveState, stateId, transitionId } from '@/domain/routing/routingTypes';
import { legalTransitions } from '@/domain/routing/routingTable';
import { relatedCompetencies } from './relatedness';
import { isListed, plainMove, type RoutingChoice } from './routingPolicy';
import {
  ROUTING_ACTIONS,
  ROUTING_Q_STATES,
  budgetLeft,
  isRoutingChoice,
  legalRoutingActions,
  routingActionMove,
  routingQState,
  routingStage,
  routingTablePolicy,
  routingTableRow,
  type RoutingAction,
  type RoutingObservation,
  type RoutingTable,
} from './routingQPolicy';

const AVAILABILITY: readonly PracticeAvailability[] = ['placeable', 'on-route', 'none'];

const randomContext = (rng: () => number): RoutingContext => ({
  outcome: rng() < 0.5 ? 'passed' : 'failed',
  practice: Object.fromEntries(
    COMPETENCIES.map(competency => [competency, AVAILABILITY[Math.floor(rng() * AVAILABILITY.length)]])
  ) as Record<DrivingCompetency, PracticeAvailability>,
  teaches: Object.fromEntries(
    REVIEW_LEVELS.map(level => [level, COMPETENCIES.filter(() => rng() < 0.3)])
  ) as Record<ReviewLevel, DrivingCompetency[]>,
});

/** Every non-terminal state under `count` random contexts, with what the machine lists there. */
const cells = (seed: number, count: number): RoutingChoice[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => randomContext(rng)).flatMap(context =>
    ROUTING_STATES.filter(state => state.kind !== 'CERTIFIED').map(state => ({
      state,
      context,
      legal: legalTransitions(state, context),
    }))
  );
};

const ids = (moves: readonly RoutingMove[]) => moves.map(move => transitionId(move.transition));
const observe = (competency: DrivingCompetency, score = 20, spent = 0, size = 330): RoutingObservation => ({
  weakest: { competency, score },
  budget: { spent, size },
});

describe("the learned policy's state", () => {
  it('has 36 distinct states', () => {
    expect(ROUTING_Q_STATES).toHaveLength(36);
    expect(new Set(ROUTING_Q_STATES).size).toBe(36);
  });

  it('reads the stage of the level just played, the tutorial with Levels 1-4', () => {
    expect(([0, 1, 4, 5, 8, 9, 11] as const).map(routingStage)).toEqual([
      'early', 'early', 'early', 'middle', 'middle', 'late', 'late',
    ]);
  });

  it('reads more than half of the budget left as "more", and half or less as "less"', () => {
    expect(budgetLeft({ spent: 0, size: 330 })).toBe('more');
    expect(budgetLeft({ spent: 164, size: 330 })).toBe('more');
    expect(budgetLeft({ spent: 165, size: 330 })).toBe('less');
    expect(budgetLeft({ spent: 329, size: 330 })).toBe('less');
  });

  it('is the stage, the weakest mastery bucket, the verdict and the budget left, read at a course level', () => {
    const context = { ...randomContext(createRng(1)), outcome: 'failed' as const };
    const choice = { state: driveState(6), context, legal: legalTransitions(driveState(6), context) };
    expect(routingQState(choice, observe('parking', 39, 200))).toBe('middle:critical:failed:less');
    expect(routingQState(choice, observe('parking', 40, 10))).toBe('middle:weak:failed:more');
    expect(routingQState(choice, observe('parking', 90, 10))).toBe('middle:ok:failed:more');
    const final = { ...choice, state: FINAL_STATE, legal: legalTransitions(FINAL_STATE, context) };
    expect(() => routingQState(final, observe('parking'))).toThrow();
  });
});

describe("the learned policy's actions, masked by what the machine lists", () => {
  it('names only listed moves, and is masked exactly where the machine lists no such move', () => {
    let masked = 0;
    for (const { legal } of cells(2, 12)) {
      for (const weakest of COMPETENCIES) {
        const listed = ids(legal);
        const firstRelative = relatedCompetencies(weakest).find(r => listed.some(id => id.endsWith(`+practice(${r})`)));
        const reviews = listed.filter(id => id.startsWith('review(') && id.endsWith(`,${weakest})`));
        const expected: Record<RoutingAction, string | undefined> = {
          none: transitionId(plainMove(legal).transition),
          weakest: listed.find(id => id.endsWith(`+practice(${weakest})`)),
          related: firstRelative && listed.find(id => id.endsWith(`+practice(${firstRelative})`)),
          review: reviews.at(-1),
        };
        for (const action of ROUTING_ACTIONS) {
          const move = routingActionMove(action, legal, weakest);
          expect(move && transitionId(move.transition)).toBe(expected[action]);
          if (move) expect(isListed(legal, move)).toBe(true);
          else masked += 1;
        }
        expect(legalRoutingActions(legal, weakest)).toEqual(ROUTING_ACTIONS.filter(a => expected[a] !== undefined));
        expect(legalRoutingActions(legal, weakest)[0]).toBe('none');
        expect(isRoutingChoice(legal, weakest)).toBe(legalRoutingActions(legal, weakest).length >= 2);
      }
    }
    expect(masked).toBeGreaterThan(0);
  }, 60_000);

  it('offers every action somewhere, and a choice only at a course level', () => {
    const offered = new Set<RoutingAction>();
    for (const { state, legal } of cells(3, 12)) {
      for (const weakest of COMPETENCIES) {
        legalRoutingActions(legal, weakest).forEach(action => offered.add(action));
        if (state.kind !== 'DRIVE') expect(isRoutingChoice(legal, weakest), stateId(state)).toBe(false);
      }
    }
    expect([...offered].sort()).toEqual([...ROUTING_ACTIONS].sort());
  }, 60_000);
});

describe("the learned policy's table", () => {
  it('ranks the actions a state tried, best first, ties to the earlier action, and ends at none', () => {
    expect(routingTableRow([0, 0, 0, 0], [0, 0, 0, 0])).toEqual([]);
    expect(routingTableRow([1, 5, 3, 9], [2, 4, 1, 0])).toEqual(['weakest', 'related', 'none']);
    expect(routingTableRow([2, 5, 1, 7], [1, 1, 1, 1])).toEqual(['review', 'weakest', 'none']);
    expect(routingTableRow([4, 4, 4, 4], [1, 1, 1, 1])).toEqual(['none']);
    expect(routingTableRow([0, 3, 1, 2], [0, 1, 0, 3])).toEqual(['weakest', 'review']);
  });

  const randomTable = (rng: () => number): RoutingTable =>
    Object.fromEntries(
      ROUTING_Q_STATES.map(state => {
        const row = [...ROUTING_ACTIONS].filter(() => rng() < 0.7).sort(() => rng() - 0.5);
        return [state, row];
      })
    ) as unknown as RoutingTable;

  it('returns a listed move in every cell: the first legal action of its row, else the plain move', () => {
    const rng = createRng(4);
    const tables = Array.from({ length: 5 }, () => randomTable(rng));
    let skipped = 0;
    for (const choice of cells(5, 8)) {
      for (const weakest of COMPETENCIES) {
        const observation = observe(weakest, Math.floor(rng() * 100), Math.floor(rng() * 330));
        for (const table of tables) {
          const move = routingTablePolicy(table)(choice, observation);
          expect(isListed(choice.legal, move), stateId(choice.state)).toBe(true);
          if (!isRoutingChoice(choice.legal, weakest)) {
            expect(move).toBe(plainMove(choice.legal));
            continue;
          }
          const row = table[routingQState(choice, observation)];
          const first = row.find(action => routingActionMove(action, choice.legal, weakest));
          if (first !== row[0]) skipped += 1;
          expect(transitionId(move.transition)).toBe(
            transitionId((first ? routingActionMove(first, choice.legal, weakest)! : plainMove(choice.legal)).transition)
          );
        }
      }
    }
    // A preferred action that was illegal at the cell was passed over somewhere.
    expect(skipped).toBeGreaterThan(0);
  }, 60_000);

  it('takes the plain move wherever a row is untrained', () => {
    const empty = Object.fromEntries(ROUTING_Q_STATES.map(state => [state, []])) as unknown as RoutingTable;
    for (const choice of cells(6, 10)) {
      for (const weakest of COMPETENCIES) {
        expect(routingTablePolicy(empty)(choice, observe(weakest))).toBe(plainMove(choice.legal));
      }
    }
  }, 60_000);
});
