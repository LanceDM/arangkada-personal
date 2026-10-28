/**
 * The level entry as a whole: the route this attempt drives, and the record of
 * the decision that shaped it, taken together.
 *
 * The seam this pins is where the two used to disagree. The practice
 * item was picked before the route was rolled, so it could be a scenario the
 * route already held; `withRemediation` then placed nothing, the level was
 * still played at the policy's h and theta, and the record named an injected
 * scenario that no drive would ever meet. The plan now rolls first, picks
 * against what it rolled, and carries the finished level, so what the record
 * names is on the road.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { ActionLog } from '@/domain/learner/attempt';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { COMPETENCIES } from '@/domain/learner/profile';
import { GAME_OPTIONS, LEGACY_OPTIONS } from '@/features/driving-sim/domain/adaptive/adaptiveOptions';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { level3SignNames } from '@/features/driving-sim/domain/scenario/content/levels/level3/level3';
import { provideDrivingSimDependencies, type DrivingSimDependencies } from '../dependencies';
import type { LearnerHistory } from '../ports';
import { buildAdaptivePlan } from './buildAdaptivePlan';

const graded = (competency: DrivingCompetency, result: ActionLog['result'], timestamp: number): ActionLog => ({
  timestamp,
  action: 'brake',
  result,
  points: result === 'correct' ? 10 : -10,
  competency,
});

/** Sound everywhere but one competency, which has been failed twice. */
const weakAt = (weak: DrivingCompetency): ActionLog[] => [
  ...COMPETENCIES.filter(c => c !== weak).flatMap((c, i) => [
    graded(c, 'correct', i * 2),
    graded(c, 'correct', i * 2 + 1),
  ]),
  graded(weak, 'violation', 100),
  graded(weak, 'violation', 101),
];

const historyOf = (logs: ActionLog[]): LearnerHistory => ({
  source: 'local',
  attempts: logs.length > 0 ? [{ levelId: 1, timestamp: 0, logs }] : [],
});

/** Only the two ports a level entry reads; the rest would throw if it were touched. */
const provide = (logs: ActionLog[], coverage: SignCoverage = {}) =>
  provideDrivingSimDependencies({
    learnerHistory: { load: async () => historyOf(logs) },
    signCoverage: { load: () => coverage, record: () => undefined },
  } as unknown as DrivingSimDependencies);

/** A coverage record in which every one of Level 3's plates but the first has been failed. */
const failingAllButOne = (): SignCoverage =>
  Object.fromEntries(
    level3SignNames()
      .slice(1)
      .map(name => [name, { seen: 2, correct: 0, wrong: 2, lastSeenAt: 5 }])
  );

const SEED = 0x5eed1e;

/**
 * Two competencies tied at BKT 8 (default model): `road_signs` missed once,
 * `driver_legality` missed, right, missed. List order picks `driver_legality`, the
 * first in COMPETENCIES; least-observed picks `road_signs`.
 */
const tiedAt8 = (): ActionLog[] => [
  ...COMPETENCIES.filter(c => c !== 'road_signs' && c !== 'driver_legality').flatMap((c, i) => [
    graded(c, 'correct', i * 2),
    graded(c, 'correct', i * 2 + 1),
  ]),
  graded('driver_legality', 'violation', 100),
  graded('driver_legality', 'correct', 101),
  graded('driver_legality', 'violation', 102),
  graded('road_signs', 'violation', 103),
];

describe('the route a level entry drives, and the record of how it was chosen', () => {
  beforeEach(() => provide([]));

  it('puts the scenario the record names on the road, once, at the end', async () => {
    let injected = 0;
    for (const weak of COMPETENCIES) {
      provide(weakAt(weak));
      for (const levelId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const plan = await buildAdaptivePlan(null, levelId, SEED);
        const route = plan.level!.events.map(event => event.id);
        const named = plan.record.practiceScenarioId;
        const where = `${weak} at level ${levelId}`;

        expect(plan.record.source, where).toBe(named === null ? 'no-portable-content' : 'policy');
        if (named === null) {
          expect(plan.practice, where).toBeNull();
          expect(route.some(id => id === plan.practice?.variant.id), where).toBe(false);
          continue;
        }

        expect(route.at(-1), where).toBe(named);
        expect(route.filter(id => id === named), where).toHaveLength(1);
        expect(plan.level!.events.at(-1)!.remediation, where).toBe(true);
        injected += 1;
      }
    }
    expect(injected).toBeGreaterThan(50);
  });

  it('plays the final exam as authored, at no theta and no injected item', async () => {
    provide(weakAt('road_signs'));
    const plan = await buildAdaptivePlan(null, 12, SEED);
    expect(plan.record.source).toBe('final-exam');
    expect(plan.practice).toBeNull();
    expect(plan.support).toBe('none');
    expect(plan.level!.events.every(event => event.remediation !== true)).toBe(true);
  });

  it('rolls the final exam from the seed alone: the same route for every history and every coverage record', async () => {
    for (const seed of [SEED, SEED + 1, SEED + 2, SEED + 3]) {
      provide([]);
      const route = (await buildAdaptivePlan(null, 12, seed)).level!.events.map(event => event.id);
      for (const options of [GAME_OPTIONS, LEGACY_OPTIONS]) {
        for (const coverage of [{}, failingAllButOne()]) {
          for (const weak of COMPETENCIES) {
            provide(weakAt(weak), coverage);
            const plan = await buildAdaptivePlan(null, 12, seed, options);
            if (options === GAME_OPTIONS) expect(plan.weakArea, weak).toBeNull();
            expect(plan.level!.events.map(event => event.id), `${weak}, seed ${seed}`).toEqual(route);
          }
        }
      }
    }
  });

  it('still hands the final exam its weak area under the legacy rule, and the roll ignores it', async () => {
    // What the legacy option still does: the plan names a weak area, which
    // only the briefing's promise of extra questions reads. The route is the
    // seed's either way, as the test above holds.
    for (const weak of COMPETENCIES) {
      provide(weakAt(weak));
      const plan = await buildAdaptivePlan(null, 12, SEED, LEGACY_OPTIONS);
      expect(plan.weakArea?.competency, weak).toBe(weak);
    }
  });

  it('breaks a tie for the weakest competency toward the least observed, and records the one it read', async () => {
    provide(tiedAt8());
    const plan = await buildAdaptivePlan(null, 3, SEED);
    expect(plan.weakArea?.competency).toBe('road_signs');
    expect(plan.record.weakest).toBe('road_signs');
    expect(plan.practice?.weakestCompetency).toBe('road_signs');

    const legacy = await buildAdaptivePlan(null, 3, SEED, LEGACY_OPTIONS);
    expect(legacy.weakArea?.competency).toBe('driver_legality');
    expect(legacy.record.weakest).toBe('driver_legality');
  });

  it('carries the history it read, oldest first, for the live estimate in the drive', async () => {
    provide(tiedAt8());
    const plan = await buildAdaptivePlan(null, 3, SEED);
    expect(plan.priorLogs).toEqual(tiedAt8());
  });

  it('rolls the same route and picks the same item for the same seed', async () => {
    provide(weakAt('road_signs'));
    const first = await buildAdaptivePlan(null, 3, SEED);
    const again = await buildAdaptivePlan(null, 3, SEED);
    expect(again.level!.events.map(e => e.id)).toEqual(first.level!.events.map(e => e.id));
    expect(again.record.practiceScenarioId).toBe(first.record.practiceScenarioId);

    const other = await buildAdaptivePlan(null, 3, SEED + 1);
    expect(other.level!.events.map(e => e.id)).not.toEqual(first.level!.events.map(e => e.id));
  });

  it('is a level played exactly as authored when there is no history to read', async () => {
    const plan = await buildAdaptivePlan(null, 8, SEED);
    expect(plan.record.source).toBe('no-history');
    expect(plan.practice).toBeNull();
    expect(plan.support).toBe('full');
    expect(plan.level!.events.every(event => event.remediation !== true)).toBe(true);
  });
});
