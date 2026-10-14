/**
 * Where the policy's support level reaches Story Mode, and where it may not.
 *
 * The tutorial always shows the move, the final exam never does, and a level
 * the policy has nothing to say about is played on the baseline machine. The
 * injected practice item keeps the timing it was written with: the difficulty
 * mode that used to widen or narrow it scaled the same distance theta scales,
 * which made the two impossible to tell apart.
 */
import { describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { chooseAction } from '@/domain/learner/adaptive/qLearningPolicy';
import { createRng } from '@/shared/lib/rng';
import { buildLevelConfig, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import {
  FINAL_EXAM_LEVEL_ID,
  adaptsLevel,
  decidePractice,
  levelSupport,
  practiceFor,
  practiceState,
  selectPractice,
  type PracticeChoice,
} from './practiceSelection';

const graded = (competency: DrivingCompetency, result: ActionLog['result']): ActionLog => ({
  timestamp: 0,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency,
});

/** Sound everywhere but one competency, which has been failed twice. */
const weakAt = (weak: DrivingCompetency): ActionLog[] => [
  ...COMPETENCIES.filter(c => c !== weak).flatMap(c => [graded(c, 'correct'), graded(c, 'correct')]),
  graded(weak, 'violation'),
  graded(weak, 'violation'),
];

const choiceAt = (levelId: number): PracticeChoice => selectPractice(weakAt('road_signs'), levelId, createRng(1))!;

describe('the support level a level entry is played at', () => {
  it('is the final exam\'s fixed none, whatever the policy would choose', () => {
    expect(FINAL_EXAM_LEVEL_ID).toBe(12);
    for (const support of ['full', 'cue', 'none'] as const) {
      expect(levelSupport(12, { ...choiceAt(8), support })).toBe('none');
    }
    expect(levelSupport(12, null)).toBe('none');
  });

  it('is the tutorial\'s fixed full, whatever the policy would choose', () => {
    for (const support of ['full', 'cue', 'none'] as const) {
      expect(levelSupport(0, { ...choiceAt(8), support })).toBe('full');
    }
  });

  it('is the policy\'s choice elsewhere, and full where the policy chose nothing', () => {
    for (let levelId = 1; levelId <= 11; levelId += 1) {
      for (const support of ['full', 'cue', 'none'] as const) {
        expect(levelSupport(levelId, { ...choiceAt(8), support })).toBe(support);
      }
      expect(levelSupport(levelId, null)).toBe('full');
    }
  });

  it('comes from the same policy action as theta', () => {
    const choice = choiceAt(8);
    expect(choice.support).toBe(chooseAction(choice.state).support);
    expect(choice.support).toBe(choice.action.support);
  });
});

describe('the weakest competency the decision reads', () => {
  /** `road_signs` missed once and `driver_legality` right once then missed twice: both at BKT 15. */
  const tied: ActionLog[] = [
    ...COMPETENCIES.filter(c => c !== 'road_signs' && c !== 'driver_legality').flatMap(c => [
      graded(c, 'correct'),
      graded(c, 'correct'),
    ]),
    graded('driver_legality', 'correct'),
    graded('driver_legality', 'violation'),
    graded('driver_legality', 'violation'),
    graded('road_signs', 'violation'),
  ];

  it('goes to the first in COMPETENCIES on a tie by default, as the earlier studies read it', () => {
    const decision = decidePractice(tied)!;
    expect(decision.weakestScore).toBe(15);
    expect(decision.weakest).toBe('driver_legality');
  });

  it('goes to the least observed on a tie under least-observed, and reads the state on that one', () => {
    const decision = decidePractice(tied, 'least-observed')!;
    expect(decision.weakest).toBe('road_signs');
    expect(decision.weakestScore).toBe(15);
    // Recent form is read on road_signs, missed on its only attempt.
    expect(decision.state).toBe(practiceState(decision.profile, tied, 'road_signs'));
    expect(decision.state.startsWith('critical:struggling')).toBe(true);
  });
});

describe('the final exam does not adapt', () => {
  it('is the one level the adaptive layer may not act on', () => {
    for (let levelId = 0; levelId <= 11; levelId += 1) expect(adaptsLevel(levelId)).toBe(true);
    expect(adaptsLevel(FINAL_EXAM_LEVEL_ID)).toBe(false);
  });
});

/** A level entry the way `buildAdaptivePlan` takes one: roll, then pick against the roll. */
const entry = (weak: DrivingCompetency, levelId: number, seed: number) => {
  const rolled = buildLevelConfig(levelId, undefined, weak, createRng(seed))!;
  const onRoute = new Set(rolled.events.map(event => event.id));
  const decision = decidePractice(weakAt(weak));
  return { rolled, onRoute, decision, choice: practiceFor(decision, levelId, createRng(seed), onRoute) };
};

const PRACTICE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

describe('the injected practice item', () => {
  it('keeps the timing it was written with', () => {
    let checked = 0;
    for (const weak of COMPETENCIES) {
      for (const levelId of [3, 8, 11]) {
        const { rolled, choice } = entry(weak, levelId, 7);
        if (!choice) continue;
        const appended = withRemediation(rolled, choice.variant).events.at(-1)!;
        expect(appended.id, choice.variant.id).toBe(choice.variant.id);
        expect(appended.warningDistance, choice.variant.id).toBe(choice.variant.warningDistance);
        expect(appended.duration, choice.variant.id).toBe(choice.variant.duration);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

/**
 * `withRemediation` refuses to place a scenario the route already
 * holds, so a pick that lands on one used to append nothing while the level
 * was still played at the policy's h and theta, and the attempt's record named
 * an injected scenario that never existed.
 */
describe('a practice item is never one the attempt is already driving', () => {
  it('is always placed, on every level it can be chosen for', () => {
    let checked = 0;
    for (const weak of COMPETENCIES) {
      for (const levelId of PRACTICE_LEVELS) {
        const { rolled, onRoute, choice } = entry(weak, levelId, 3);
        if (!choice) continue;
        const where = `${weak} at level ${levelId}`;
        expect(onRoute.has(choice.variant.id), where).toBe(false);
        const played = withRemediation(rolled, choice.variant);
        expect(played.events.length, where).toBe(rolled.events.length + 1);
        expect(played.events.at(-1)!.id, where).toBe(choice.variant.id);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('passes over a competency whose every candidate is already on the route', () => {
    // Level 7's lead van is the only portable hazard_awareness scenario at or
    // below Level 7, and Level 7 drives it itself, so the chain has to fall
    // through to a curriculum relative rather than choose it and place nothing.
    const onRoute = new Set(buildLevelConfig(7, undefined, null, undefined)!.events.map(event => event.id));
    const candidates = remediationCandidates('hazard_awareness', 7);
    expect(candidates.map(candidate => candidate.variant.id)).toEqual(['level7.following-distance-lead-van']);
    expect(onRoute.has('level7.following-distance-lead-van')).toBe(true);

    const choice = practiceFor(decidePractice(weakAt('hazard_awareness')), 7, createRng(5), onRoute)!;
    expect(choice.weakestCompetency).toBe('hazard_awareness');
    expect(choice.competency).not.toBe('hazard_awareness');
    expect(onRoute.has(choice.variant.id)).toBe(false);
    // The stand-in is still a practice item, so h and theta are still the
    // policy's: the route decides what is placed, never how the level is run.
    expect(choice.support).toBe(choice.action.support);
    expect(choice.transitionParams.approachScale).toBeGreaterThan(0);
  });

  it('leaves every attempt that was already placing one exactly as it was', () => {
    let kept = 0;
    let moved = 0;
    for (const weak of COMPETENCIES) {
      for (const levelId of PRACTICE_LEVELS) {
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
          const rolled = buildLevelConfig(levelId, undefined, weak, createRng(seed))!;
          const onRoute = new Set(rolled.events.map(event => event.id));
          const decision = decidePractice(weakAt(weak));
          // What the same seed drew before the route was consulted at all.
          const blind = practiceFor(decision, levelId, createRng(seed), new Set());
          const picked = practiceFor(decision, levelId, createRng(seed), onRoute);
          if (!blind) {
            expect(picked).toBeNull();
            continue;
          }
          if (onRoute.has(blind.variant.id)) {
            expect(picked!.variant.id).not.toBe(blind.variant.id);
            expect(onRoute.has(picked!.variant.id)).toBe(false);
            moved += 1;
          } else {
            expect(picked!.variant.id, `${weak} at level ${levelId}, seed ${seed}`).toBe(blind.variant.id);
            kept += 1;
          }
        }
      }
    }
    // Both halves are real: most attempts keep the scenario their seed gave
    // them, and the ones that move are the ones that were placing nothing.
    expect(moved).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(moved);
  });
});
