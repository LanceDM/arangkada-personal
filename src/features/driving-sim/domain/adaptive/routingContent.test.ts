// The routing FSM is told about Story's content as data. These hold
// what it is told to the content itself: availability to the practice pool and
// the route, "teaches" to what every roll of a level really presents, and the
// machine's legal practice moves to items that can really be placed.
import { describe, it, expect } from 'vitest';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { REVIEW_LEVELS, driveState, FINAL_STATE } from '@/domain/routing/routingTypes';
import { destinationOf, legalTransitions } from '@/domain/routing/routingTable';
import { aimOf, addOnOf } from '@/domain/learner/adaptive/routingPolicy';
import { createRng } from '@/shared/lib/rng';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { LEVELS, buildLevelConfig, getRerollableSlots, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { evaluateWeightedRule } from '@/features/driving-sim/domain/evaluation/ruleEngine';
import { garageHotspotToEvent } from '@/features/driving-sim/domain/evaluation/evaluatePlayerAction';
import { REVIEW_TEACHES, practiceAvailability, practiceItem, routingContext } from './routingContent';

const graded = (event: ScenarioEvent): DrivingCompetency =>
  evaluateWeightedRule(event, event.correctAction, 0).trace.competency;

/** Everything one play of `route` grades: its scenarios and its garage and aftermath questions. */
const presented = (route: LevelConfig): Set<DrivingCompetency> =>
  new Set(
    [...route.events, ...[...(route.garage?.hotspots ?? []), ...(route.aftermath?.hotspots ?? [])].map(garageHotspotToEvent)].map(
      graded
    )
  );

/** A learner's sign-coverage record, drawn so that rolls that read coverage vary with it. */
const someCoverage = (rng: () => number): SignCoverage =>
  Object.fromEntries(
    ['Stop', 'Yield', 'No Parking', 'No Entry', 'Speed Limit'].map(name => [
      name,
      { seen: Math.floor(rng() * 6), correct: Math.floor(rng() * 3), wrong: Math.floor(rng() * 3), lastSeenAt: 1 },
    ])
  );

const roll = (levelId: number, seed: number) => {
  const rng = createRng(seed);
  return buildLevelConfig(levelId, rng() < 0.5 ? {} : someCoverage(rng), null, rng)!;
};

describe('what a review of a level teaches', () => {
  it('is presented by every roll of that level', () => {
    for (const level of REVIEW_LEVELS) {
      expect(REVIEW_TEACHES[level].length, `Level ${level}`).toBeGreaterThan(0);
      for (let seed = 0; seed < 150; seed += 1) {
        const route = roll(level, 1000 * level + seed);
        const onRoute = presented(route);
        for (const competency of REVIEW_TEACHES[level]) expect(onRoute.has(competency), `Level ${level}, ${competency}`).toBe(true);
      }
    }
  });

  it('is all of a level that does not roll', () => {
    const fixed = REVIEW_LEVELS.filter(level => !getRerollableSlots(level));
    expect(fixed.length).toBeGreaterThan(0);
    for (const level of fixed) {
      expect(new Set(REVIEW_TEACHES[level])).toEqual(presented(LEVELS.find(l => l.id === level)!));
    }
  });
});

describe('practice availability at a destination', () => {
  it('is none without a portable scenario, on-route when every one is on the route, and placeable exactly where an item can be drawn', () => {
    let placed = 0;
    for (const base of LEVELS) {
      for (const seed of [1, 2, 3]) {
        const route = roll(base.id, seed);
        const ids = new Set(route.events.map(e => e.id));
        const availability = practiceAvailability(base.id, route);
        for (const competency of COMPETENCIES) {
          const candidates = remediationCandidates(competency, base.id);
          const item = practiceItem(competency, base.id, route, createRng(seed));
          if (candidates.length === 0) expect(availability[competency]).toBe('none');
          else if (candidates.every(c => ids.has(c.variant.id))) expect(availability[competency]).toBe('on-route');
          else expect(availability[competency]).toBe('placeable');
          expect(item !== null).toBe(availability[competency] === 'placeable');
          if (!item) continue;
          // A real practice item: marked, of the competency asked for, not on the route, and appended.
          expect(item.remediation).toBe(true);
          expect(ids.has(item.id)).toBe(false);
          expect(graded({ ...item, triggerAtDistance: 0 })).toBe(competency);
          expect(withRemediation(route, item).events).toHaveLength(route.events.length + 1);
          placed += 1;
        }
      }
    }
    expect(placed).toBeGreaterThan(100);
  });

  it('reads on-route when the route already holds every candidate', () => {
    const route = roll(2, 7);
    const all = remediationCandidates('document_awareness', 2).map((c, i) => ({ ...c.variant, triggerAtDistance: 100 * i }));
    const crowded = { ...route, events: [...route.events, ...all] } as LevelConfig;
    expect(practiceAvailability(2, crowded).document_awareness).toBe('on-route');
    expect(practiceItem('document_awareness', 2, crowded, createRng(1))).toBeNull();
  });
});

describe('the context the routing FSM is told', () => {
  it('carries the verdict, the destination content and what reviews teach, and nothing to place once the course is over', () => {
    const route = roll(3, 11);
    const context = routingContext('passed', { levelId: 3, route });
    expect(context.outcome).toBe('passed');
    expect(context.practice).toEqual(practiceAvailability(3, route));
    expect(context.teaches).toBe(REVIEW_TEACHES);
    const over = routingContext('passed', null);
    expect(new Set(Object.values(over.practice))).toEqual(new Set(['none']));
    expect(legalTransitions(FINAL_STATE, over).map(m => m.transition.kind)).toEqual(['certify']);
  });

  it("lists practice on today's content only where an item can be placed", () => {
    let offered = 0;
    for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const) {
      for (const outcome of ['passed', 'failed'] as const) {
        const destination = destinationOf(driveState(level), outcome)!;
        const route = roll(destination, 100 * level + (outcome === 'passed' ? 1 : 2));
        const context = routingContext(outcome, { levelId: destination, route });
        for (const move of legalTransitions(driveState(level), context)) {
          if (addOnOf(move.transition) !== 'practice') continue;
          expect(practiceItem(aimOf(move.transition)!, destination, route, createRng(level))).not.toBeNull();
          offered += 1;
        }
      }
    }
    expect(offered).toBeGreaterThan(50);
  });
});
