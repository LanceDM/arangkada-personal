// Shared machinery for levels whose content is rolled fresh each attempt
// from a pool of interchangeable variants (levels 1-4). Kept separate from
// any one level's file so the pattern isn't reimplemented per level.
import { pickForCoverage, type SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { DrivingCompetency } from '@/domain/learner/competency';
import type { AuthoredEvent, ScenarioEvent } from './scenarioDefinition';

/** One variant a pool slot can be filled with; buildEvents attaches the distance. */
/**
 * One authored variant, before it is placed at a slot's distance.
 *
 * Distributive on purpose: `AuthoredEvent` is a union of the interaction modes,
 * and a plain `Omit` over a union collapses it back into one wide shape - which
 * would quietly undo the constraint at exactly the point content is written.
 */
export type SlotVariant = AuthoredEvent extends unknown
  ? Omit<AuthoredEvent, 'triggerAtDistance'>
  : never;

/** Rolls one variant per slot and attaches each slot's fixed road position. */
export const buildEvents = (
  slots: SlotVariant[][],
  distances: number[],
  // slotIndex lets a caller (e.g. the dev scenario harness) pick a different
  // variant per slot instead of applying the same rule to every one.
  pick: (pool: SlotVariant[], slotIndex: number) => SlotVariant
): ScenarioEvent[] =>
  slots.map((pool, index) => ({ ...pick(pool, index), triggerAtDistance: distances[index] }));

/**
 * Narrows a pool of pooled scenario variants (or garage-hotspot variants) to
 * ones tagged with the player's current weak competency, so level content
 * generation can bias toward what they need practice on. Falls through to
 * the full pool whenever there's no match - a slot whose pool is entirely
 * one competency, or no weak-area signal yet - so this is always safe and
 * never returns an empty array.
 */
export const filterByWeakCompetency = <T extends { competency?: DrivingCompetency }>(
  pool: T[],
  weakCompetency: DrivingCompetency | null
): T[] => {
  if (!weakCompetency) return pool;
  const matching = pool.filter(item => item.competency === weakCompetency);
  return matching.length > 0 ? matching : pool;
};

/**
 * Weak-competency-aware uniform random pick, for pools with no sign/marking
 * coverage to track (levels 1/2). `rng` defaults to `Math.random`; passing a
 * seeded generator (see `shared/lib/rng`) makes the pick reproducible,
 * which each attempt's roll and the dev scenario harness rely on.
 */
export const pickWeighted = <T extends { competency?: DrivingCompetency }>(
  pool: T[],
  weakCompetency: DrivingCompetency | null,
  rng: () => number = Math.random
): T => {
  const scoped = filterByWeakCompetency(pool, weakCompetency);
  return scoped[Math.floor(rng() * scoped.length)];
};

/**
 * Re-rolls not-yet-visible events in place, using the player's current weak
 * competency for THIS run (not prior-level history). Never touches an event
 * within `safetyMargin` of the player - that event is either already visible
 * on canvas or already resolved, and swapping its content there would be a
 * visible glitch (a sign changing appearance mid-approach) or would rewrite
 * history. Callers should pass a safety margin at least as large as the
 * renderer's own visibility distance (see `distanceToScreenY`
 * filter - 1300 distance-units at the current CANVAS_HEIGHT).
 */
export const rerollUpcomingEvents = (
  currentEvents: ScenarioEvent[],
  slots: SlotVariant[][],
  distances: number[],
  playerDistance: number,
  safetyMargin: number,
  weakCompetency: DrivingCompetency | null,
  coverage?: SignCoverage,
  // Defaults to Math.random, and live play passes nothing yet: unlike the
  // roll before the drive, the mid-drive re-roll is not drawn from the
  // attempt's seed. Passing a seeded generator (see
  // shared/lib/rng) is what makes a replayed re-roll reproducible.
  rng: () => number = Math.random
): ScenarioEvent[] =>
  currentEvents.map((event, index) => {
    // Never reroll an adaptively injected event (the selector's remediation, see
    // `withRemediation` in levelCatalog) - it was already chosen
    // deliberately, for a reason that has nothing to do with this level's own
    // pool, and it does not correspond to any slot/distance here. Checked by
    // the `remediation` marker rather than by position, so this stays correct
    // even if a future design ever places injected content somewhere other
    // than the end of the route - unlike an index check, which would silently
    // stop working the moment that assumption changed.
    if (event.remediation) return event;
    // Defensive fallback, not the primary guard: any other position beyond
    // this level's own pool still has no slot/distance to reroll from.
    // Shouldn't be reachable by anything other than the case above today, but
    // indexing out of range here throws inside the requestAnimationFrame
    // loop and silently freezes the drive - the one failure mode worth
    // guarding against even for a cause we haven't anticipated.
    if (index >= slots.length) return event;
    if (distances[index] - playerDistance <= safetyMargin) return event;
    const picked = coverage
      ? pickForCoverage(filterByWeakCompetency(slots[index], weakCompetency), coverage)
      : pickWeighted(slots[index], weakCompetency, rng);
    return { ...picked, triggerAtDistance: distances[index] };
  });
