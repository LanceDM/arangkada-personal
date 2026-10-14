import { describe, it, expect } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { createRng } from '@/shared/lib/rng';
import type { PracticeAvailability, ReviewLevel, RoutingContext, RoutingState, RoutingTransition } from './routingTypes';
import {
  COURSE_LEVELS,
  REVIEW_LEVELS,
  ROUTING_ALPHABET,
  ROUTING_STATES,
  TUTORIAL_LEVEL,
  frontierLevel,
  stateId,
  transitionId,
} from './routingTypes';
import { destinationOf, legalTransitions, step } from './routingTable';
import { probeContext } from './characterizeRouting';

/**
 * The routing design's table written a second time, as a specification,
 * without reading `routingTable.ts`: the name of the state `transition` must
 * lead to from `state` under `context`, or null where the design makes it
 * illegal.
 */
const r2 = (state: RoutingState, context: RoutingContext, transition: RoutingTransition): string | null => {
  const passed = context.outcome === 'passed';
  const next = (level: number) => (level === 11 ? 'FINAL' : `DRIVE(${level + 1})`);
  switch (transition.kind) {
    case 'retry':
      if (passed) return null;
      // The final exam is retried as it is: never with practice.
      if (state.kind === 'FINAL') return transition.practice === null ? 'FINAL' : null;
      if (state.kind !== 'DRIVE') return null;
      if (transition.practice === null) return stateId(state);
      // Practice is placeable at the level retried, and never on the tutorial.
      return state.level !== 0 && context.practice[transition.practice] === 'placeable' ? stateId(state) : null;
    case 'advance':
      if (!passed || state.kind !== 'DRIVE' || state.level === 11) return null;
      if (transition.practice !== null && context.practice[transition.practice] !== 'placeable') return null;
      return next(state.level);
    case 'to_final':
      return passed && state.kind === 'DRIVE' && state.level === 11 ? 'FINAL' : null;
    case 'review': {
      // Review only after a pass, of a level already passed and not the
      // tutorial, and only for a competency with no portable item that it teaches.
      if (!passed || state.kind !== 'DRIVE') return null;
      const { level, competency } = transition;
      if (level < 1 || level > state.level) return null;
      if (context.practice[competency] !== 'none') return null;
      if (!context.teaches[level].includes(competency)) return null;
      return `REVIEW(${level}->${next(state.level)})`;
    }
    case 'return':
      return state.kind === 'REVIEW' ? stateId(state.frontier) : null;
    case 'certify':
      // Terminal: CERTIFIED is not FINAL, so nothing leaves it.
      return passed && state.kind === 'FINAL' ? 'CERTIFIED' : null;
  }
};

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

const contexts = (seed: number, count: number): RoutingContext[] => {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => randomContext(rng));
};

const PLAIN_KINDS = new Set(['retry', 'advance', 'to_final', 'return', 'certify']);
const isPlain = (transition: RoutingTransition) =>
  PLAIN_KINDS.has(transition.kind) && !('practice' in transition && transition.practice !== null);

describe('the vocabulary', () => {
  it('has 80 distinct states over 25 control states, and 148 distinct transition labels', () => {
    expect(new Set(ROUTING_STATES.map(stateId)).size).toBe(80);
    expect(ROUTING_STATES).toHaveLength(80);
    expect(new Set(ROUTING_ALPHABET.map(transitionId)).size).toBe(148);
    expect(ROUTING_ALPHABET).toHaveLength(148);
  });

  it('reviews every course level but the tutorial', () => {
    expect([...REVIEW_LEVELS]).toEqual(COURSE_LEVELS.filter(level => level !== TUTORIAL_LEVEL));
  });

  it('returns every review to a frontier above the level it replays', () => {
    for (const state of ROUTING_STATES) {
      if (state.kind === 'REVIEW') expect(state.level).toBeLessThan(frontierLevel(state.frontier));
    }
  });
});

describe('legalTransitions lists exactly what the routing design allows', () => {
  it('in every state, over 200 random contexts: the same labels, the same targets, in alphabet order', () => {
    const mismatches: string[] = [];
    for (const context of contexts(20260929, 200)) {
      for (const state of ROUTING_STATES) {
        const listed = legalTransitions(state, context).map(move => `${transitionId(move.transition)} -> ${stateId(move.to)}`);
        const expected = ROUTING_ALPHABET.flatMap(transition => {
          const to = r2(state, context, transition);
          return to === null ? [] : [`${transitionId(transition)} -> ${to}`];
        });
        if (listed.join('|') !== expected.join('|')) {
          mismatches.push(`${stateId(state)} ${context.outcome}: listed [${listed}] expected [${expected}]`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('step accepts exactly the listed transitions and lands where they say', () => {
    const disagreements: string[] = [];
    for (const context of contexts(7, 25)) {
      for (const state of ROUTING_STATES) {
        const listed = new Map(legalTransitions(state, context).map(move => [transitionId(move.transition), stateId(move.to)]));
        for (const transition of ROUTING_ALPHABET) {
          const taken = step(state, context, transition);
          const expected = listed.get(transitionId(transition));
          if ((taken === null ? undefined : stateId(taken)) !== expected) {
            disagreements.push(`${stateId(state)} ${context.outcome} ${transitionId(transition)}`);
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });
});

describe('the guards', () => {
  const kinds = (state: RoutingState, context: RoutingContext) =>
    legalTransitions(state, context).map(move => transitionId(move.transition));

  it('never adds practice to the tutorial or the final exam, even where every competency is placeable', () => {
    expect(kinds({ kind: 'DRIVE', level: 0 }, probeContext('open', 'failed'))).toEqual(['retry']);
    expect(kinds({ kind: 'FINAL' }, probeContext('open', 'failed'))).toEqual(['retry']);
    expect(kinds({ kind: 'DRIVE', level: 11 }, probeContext('open', 'passed'))).toEqual(['to_final']);
  });

  it('offers review only after a pass, and never after the tutorial', () => {
    expect(kinds({ kind: 'DRIVE', level: 5 }, probeContext('gap', 'failed'))).toEqual(['retry']);
    expect(kinds({ kind: 'DRIVE', level: 0 }, probeContext('gap', 'passed'))).toEqual(['advance']);
    expect(kinds({ kind: 'DRIVE', level: 2 }, probeContext('gap', 'passed'))).toEqual([
      'advance',
      ...[1, 2].flatMap(level => COMPETENCIES.map(c => `review(${level},${c})`)),
    ]);
  });

  it('never offers practice and review for the same competency', () => {
    for (const ctx of contexts(3, 50)) {
      for (const state of ROUTING_STATES) {
        const moves = legalTransitions(state, ctx).map(move => move.transition);
        const practised = new Set(moves.flatMap(t => ('practice' in t && t.practice ? [t.practice] : [])));
        const reviewed = moves.flatMap(t => (t.kind === 'review' ? [t.competency] : []));
        expect(reviewed.filter(c => practised.has(c))).toEqual([]);
      }
    }
  });

  it('holds nothing but CERTIFIED without a move, whatever the verdict and the content', () => {
    for (const ctx of contexts(4, 50)) {
      for (const state of ROUTING_STATES) {
        expect(legalTransitions(state, ctx).length === 0).toBe(state.kind === 'CERTIFIED');
      }
    }
  });
});

describe('the pass guard', () => {
  it('leaves exactly one plain move in every state but CERTIFIED, and it leads to destinationOf', () => {
    for (const ctx of contexts(5, 50)) {
      for (const state of ROUTING_STATES) {
        const plain = legalTransitions(state, ctx).filter(move => isPlain(move.transition));
        if (state.kind === 'CERTIFIED') {
          expect(plain).toEqual([]);
          expect(destinationOf(state, ctx.outcome)).toBeNull();
          continue;
        }
        expect(plain).toHaveLength(1);
        const [{ to }] = plain;
        const destination = destinationOf(state, ctx.outcome);
        if (to.kind === 'CERTIFIED') expect(destination).toBeNull();
        else if (to.kind === 'FINAL') expect(destination).toBe(12);
        else if (to.kind === 'DRIVE') expect(destination).toBe(to.level);
        else throw new Error(`a plain move led to ${stateId(to)}`);
      }
    }
  });
});

describe('determinism', () => {
  it('gives the same answer to the same question', () => {
    for (const ctx of contexts(6, 20)) {
      for (const state of ROUTING_STATES) {
        expect(legalTransitions(state, ctx)).toEqual(legalTransitions(state, ctx));
      }
    }
  });

  it('sends a transition from a state to one place, whatever the context', () => {
    const targets = new Map<string, Set<string>>();
    for (const ctx of contexts(8, 200)) {
      for (const state of ROUTING_STATES) {
        for (const move of legalTransitions(state, ctx)) {
          const key = `${stateId(state)} ${transitionId(move.transition)}`;
          targets.set(key, (targets.get(key) ?? new Set()).add(stateId(move.to)));
        }
      }
    }
    expect([...targets].filter(([, to]) => to.size > 1).map(([key]) => key)).toEqual([]);
  });
});
