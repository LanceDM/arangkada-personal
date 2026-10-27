import { getLevelModule } from '@/features/driving-sim/domain/scenario/content/lessons/lessonCatalog';
import { pickForCoverage, type SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import { buildEvents, filterByWeakCompetency } from '@/features/driving-sim/domain/scenario/pooling';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { LevelConfig } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { RoadPaintSpan } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { SLOTS } from './pools';

const levelModule = getLevelModule(3);

/**
 * A sign-reading drive, rebuilt on every attempt.
 *
 * The route keeps the seven beats the module's own "Scenario" section
 * describes -- stop, give way, a blocked route, a posted speed, a bend warning,
 * a pedestrian crossing, then a signalised junction -- with a lane-guidance
 * beat added after the speed sign. Each beat draws a different sign from its
 * pool every run, so replaying the level is a fresh recognition test rather
 * than a memorised sequence of key presses. Pool contents live in ./pools -
 * this file is just how a roll becomes a playable level.
 *
 * Every variant inside a slot carries the same points and severity, so the pass
 * mark and star thresholds below hold whatever is rolled. What a slot does not
 * hold constant is the action: braking is the answer to some of these signs and
 * the violation at others, and two slots are settled by which lane you are in
 * rather than which key you press.
 */
export const SLOT_DISTANCES = [840, 1590, 2340, 3090, 3840, 4590, 5340, 6090];

/** Every sign this level can show, for measuring how much of it has been met. */
export const level3SignNames = (): string[] =>
  [...new Set(SLOTS.flat().map(variant => variant.sign?.name).filter((name): name is string => Boolean(name)))];

/**
 * Fixed parts of the drive. The pass mark and star thresholds are tied to the
 * 165 points every roll is worth: 20 for each of the first seven slots and 25
 * for the signal.
 *
 * The pass mark sits deliberately above 102, which is the most a player can
 * score by simply holding the brake through the whole level. Lane guidance and
 * the bend always need something other than braking, so that ceiling holds for
 * every roll; leaving clear air above it is what stops the old dominant
 * strategy from creeping back in.
 */
const level3Base = {
  id: 3,
  name: levelModule.title,
  moduleId: levelModule.id,
  description: levelModule.desc,
  // Slots sit 550 apart so two full crossroads never overlap on screen, with a
  // short run-out after the last one.
  roadLength: 6440,
  speedLimit: 60,
  requiredScore: 110,
  stars2: 130,
  stars3: 160,
  /**
   * An ordinary two-way street: four lanes, the left two carrying opposing
   * traffic.
   *
   * Level 3 declared no paint at all before the carriageway went to four lanes,
   * which made it a one-way road by default — and on a one-way road half of
   * this level's own content is nonsense. A Keep Right sign, a Left Turner Must
   * Give Way sign and a No Overtaking line all describe a relationship with
   * traffic coming the other way, and there was none. Declaring the layout also
   * turns on the standing wrong-side penalty, so the left half now costs
   * something everywhere rather than only where a sign happens to look.
   */
  paint: {
    oncomingLanes: 2,
    base: 'broken_yellow',
    // Widened per-attempt, never here: `as const` above would otherwise freeze
    // this array as `readonly []`, which a mutable RoadPaint cannot accept.
    spans: [] as RoadPaintSpan[],
  },
} as const;

/**
 * A fresh roll of the drive: one sign from each slot's pool.
 *
 * Given a coverage record the slots are filled by what the learner still needs
 * — unseen signs first, then ones they have been getting wrong — so replaying
 * works through the syllabus instead of resampling the same handful. Without
 * one it falls back to an even random draw. A weakCompetency further narrows
 * each slot's pool to variants tagged with that competency before coverage
 * picks within it - a no-op for slots whose pool is entirely one competency.
 */
export const createLevel3 = (
  coverage?: SignCoverage,
  weakCompetency?: DrivingCompetency | null,
  rng: () => number = Math.random
): LevelConfig => ({
  ...level3Base,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => {
    const scoped = filterByWeakCompetency(pool, weakCompetency ?? null);
    return coverage
      ? pickForCoverage(scoped, coverage, rng)
      : scoped[Math.floor(rng() * scoped.length)];
  }),
});

/**
 * Stable version of the level used for the level map, briefing and results,
 * where the metadata matters and the specific signs do not. The played drive
 * comes from `createLevel3()` instead.
 */
export const level3: LevelConfig = {
  ...level3Base,
  events: buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]),
};
