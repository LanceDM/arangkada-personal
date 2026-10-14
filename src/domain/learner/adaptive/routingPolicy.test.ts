import { describe, it, expect } from 'vitest';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { createRng } from '@/shared/lib/rng';
import type { PracticeAvailability, ReviewLevel, RoutingContext, RoutingMove } from '@/domain/routing/routingTypes';
import { REVIEW_LEVELS, ROUTING_STATES, driveState, stateId, transitionId } from '@/domain/routing/routingTypes';
import { legalTransitions } from '@/domain/routing/routingTable';
import { relatedCompetencies } from './relatedness';
import {
  addOnOf,
  aimOf,
  aimsOf,
  isListed,
  plainMove,
  plainPolicy,
  practiceMove,
  reviewMoves,
  thresholdRule,
  type WeakestReading,
} from './routingPolicy';

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
const cells = (seed: number, count: number) => {
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

describe('the move vocabulary', () => {
  it('names what each transition adds, and what it aims at', () => {
    expect(addOnOf({ kind: 'advance', practice: null })).toBe('none');
    expect(addOnOf({ kind: 'retry', practice: 'parking' })).toBe('practice');
    expect(addOnOf({ kind: 'review', level: 6, competency: 'parking' })).toBe('review');
    expect(addOnOf({ kind: 'certify' })).toBe('none');
    expect(aimOf({ kind: 'advance', practice: 'road_signs' })).toBe('road_signs');
    expect(aimOf({ kind: 'review', level: 2, competency: 'hazard_awareness' })).toBe('hazard_awareness');
    expect(aimOf({ kind: 'return' })).toBeNull();
  });

  it('finds exactly one plain move in every cell of every state but CERTIFIED', () => {
    for (const { legal } of cells(1, 60)) {
      const plain = plainMove(legal);
      expect(isListed(legal, plain)).toBe(true);
      expect(addOnOf(plain.transition)).toBe('none');
    }
  });

  it('refuses to name a plain move where none is listed', () => {
    expect(() => plainMove([])).toThrow();
  });

  it('finds a practice move or a review exactly where the machine lists one', () => {
    for (const { legal } of cells(2, 30)) {
      for (const competency of COMPETENCIES) {
        const practice = practiceMove(legal, competency);
        expect(practice === undefined).toBe(!ids(legal).some(id => id.endsWith(`+practice(${competency})`)));
        if (practice) expect(isListed(legal, practice)).toBe(true);
        for (const review of reviewMoves(legal, competency)) {
          expect(isListed(legal, review)).toBe(true);
          expect(aimOf(review.transition)).toBe(competency);
        }
      }
      expect(aimsOf(legal, 'practice').every(c => practiceMove(legal, c))).toBe(true);
      expect(aimsOf(legal, 'review').every(c => reviewMoves(legal, c).length > 0)).toBe(true);
    }
  });

  it('does not take a move of another state for a listed one', () => {
    const legal = legalTransitions(driveState(3), { ...randomContext(createRng(3)), outcome: 'passed' });
    const elsewhere = legalTransitions(driveState(5), { ...randomContext(createRng(3)), outcome: 'passed' });
    expect(isListed(legal, plainMove(elsewhere))).toBe(false);
  });
});

describe('the plain policy', () => {
  it('always takes the plain move', () => {
    for (const choice of cells(4, 20)) expect(plainPolicy(choice, null)).toBe(plainMove(choice.legal));
  });
});

describe('the threshold rule', () => {
  const rule = thresholdRule(85);

  /** The routing design's rule written a second time, over the listed labels alone. */
  const expected = (legal: readonly RoutingMove[], weakest: WeakestReading | null): string => {
    const listed = ids(legal);
    const plain = transitionId(plainMove(legal).transition);
    if (!weakest || weakest.score >= 85) return plain;
    for (const c of [weakest.competency, ...relatedCompetencies(weakest.competency)]) {
      const practice = listed.find(id => id.endsWith(`+practice(${c})`));
      if (practice) return practice;
    }
    const reviews = listed.filter(id => id.startsWith('review(') && id.endsWith(`,${weakest.competency})`));
    return reviews.at(-1) ?? plain;
  };

  it('returns a listed move in every cell, for every reading, as the routing design orders the chain', () => {
    const rng = createRng(5);
    let practised = 0;
    let related = 0;
    let reviewed = 0;
    for (const choice of cells(6, 40)) {
      const readings: Array<WeakestReading | null> = [
        null,
        ...COMPETENCIES.map(competency => ({ competency, score: Math.floor(rng() * 100) })),
      ];
      for (const reading of readings) {
        const move = rule(choice, reading);
        expect(isListed(choice.legal, move), `${stateId(choice.state)}`).toBe(true);
        expect(transitionId(move.transition)).toBe(expected(choice.legal, reading));
        if (reading && addOnOf(move.transition) === 'practice') {
          if (aimOf(move.transition) === reading.competency) practised += 1;
          else related += 1;
        }
        if (addOnOf(move.transition) === 'review') reviewed += 1;
      }
    }
    // Every branch of the chain was taken somewhere.
    expect(practised).toBeGreaterThan(0);
    expect(related).toBeGreaterThan(0);
    expect(reviewed).toBeGreaterThan(0);
  });

  it('adds nothing at or above the threshold, or with nothing observed', () => {
    for (const choice of cells(7, 10)) {
      expect(rule(choice, null)).toBe(plainMove(choice.legal));
      expect(rule(choice, { competency: 'parking', score: 85 })).toBe(plainMove(choice.legal));
    }
  });

  it('reviews the most recent passed level that teaches the weakest, and only where nothing can be practised', () => {
    const context: RoutingContext = {
      outcome: 'passed',
      practice: Object.fromEntries(COMPETENCIES.map(c => [c, 'none'])) as Record<DrivingCompetency, PracticeAvailability>,
      teaches: Object.fromEntries(
        REVIEW_LEVELS.map(level => [level, level === 2 || level === 6 || level === 9 ? ['parking'] : []])
      ) as Record<ReviewLevel, DrivingCompetency[]>,
    };
    const choice = { state: driveState(7), context, legal: legalTransitions(driveState(7), context) };
    expect(transitionId(rule(choice, { competency: 'parking', score: 10 }).transition)).toBe('review(6,parking)');

    const withRelative: RoutingContext = { ...context, practice: { ...context.practice, lane_discipline: 'placeable' } };
    const relatedChoice = { ...choice, context: withRelative, legal: legalTransitions(driveState(7), withRelative) };
    expect(transitionId(rule(relatedChoice, { competency: 'parking', score: 10 }).transition)).toBe(
      'advance+practice(lane_discipline)'
    );
  });
});
