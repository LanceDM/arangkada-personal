
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';
import type { SlotVariant } from './pooling';
import { declaredLineSpans } from './roadLine';
import { level0 } from '@/features/driving-sim/domain/scenario/content/levels/level0';
import { level1, createLevel1, SLOTS as level1Slots, SLOT_DISTANCES as level1SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level1';
import { level2, createLevel2, SLOTS as level2Slots, SLOT_DISTANCES as level2SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level2';
import { level3, createLevel3, level3SignNames, SLOT_DISTANCES as level3SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level3/level3';
import { SLOTS as level3Slots } from '@/features/driving-sim/domain/scenario/content/levels/level3/pools';
import type { SignCoverage } from '@/features/driving-sim/domain/adaptive/signCoverage';
import type { DrivingCompetency } from '@/domain/learner/competency';
import { level4, createLevel4, assembleLevel4, level4MarkingNames, SLOT_DISTANCES as level4SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level4/level4';
import { SLOTS as level4Slots } from '@/features/driving-sim/domain/scenario/content/levels/level4/pools';
import { level5, createLevel5, SLOTS as level5Slots, SLOT_DISTANCES as level5SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level5';
import { level6 } from '@/features/driving-sim/domain/scenario/content/levels/level6';
import { level7 } from '@/features/driving-sim/domain/scenario/content/levels/level7';
import { level8 } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import { level9 } from '@/features/driving-sim/domain/scenario/content/levels/level9';
import { level10 } from '@/features/driving-sim/domain/scenario/content/levels/level10';
import { level11 } from '@/features/driving-sim/domain/scenario/content/levels/level11';
import { level12, createLevel12, assembleLevel12, SLOTS as level12Slots, SLOT_DISTANCES as level12SlotDistances } from '@/features/driving-sim/domain/scenario/content/levels/level12';

export {
  level0,
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
  level11,
  level12,
};

export const LEVELS = [
  level0,
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
  level11,
  level12,
];

/**
 * Levels whose scenarios are rolled fresh for every attempt. The entries in
 * LEVELS above stay static, since the level map, briefing and results only need
 * the metadata; the drive itself is built here when the player starts it.
 */
const LEVEL_BUILDERS: Record<
  number,
  (coverage?: SignCoverage, weakCompetency?: DrivingCompetency | null, rng?: () => number) => LevelConfig
> = {
  1: createLevel1,
  2: createLevel2,
  3: createLevel3,
  4: createLevel4,
  5: createLevel5,
  // The final exam rolls too, from the seed alone: it is the same test for
  // every learner, so it is handed no coverage and no weak area. See level12.ts.
  12: (_coverage, _weakCompetency, rng) => createLevel12(rng),
};

/** Which signs each level can show, for reporting coverage of the syllabus. */
const LEVEL_SIGN_NAMES: Record<number, () => string[]> = {
  3: level3SignNames,
  4: level4MarkingNames,
};

export const signNamesForLevel = (levelId: number): string[] =>
  LEVEL_SIGN_NAMES[levelId]?.() ?? [];

/**
 * Raw pools/distances for levels whose events can be re-rolled live, mid-drive
 * (see rerollUpcomingEvents in pooling.ts) - as opposed to LEVEL_BUILDERS above,
 * which only rolls a level once, before the drive starts. Levels without an
 * entry here (0, 6-12) simply aren't live-rerollable; callers should treat a
 * null return as "nothing to do," not an error.
 */
const LEVEL_REROLL_SLOTS: Record<number, { slots: SlotVariant[][]; distances: number[] }> = {
  1: { slots: level1Slots, distances: level1SlotDistances },
  2: { slots: level2Slots, distances: level2SlotDistances },
  3: { slots: level3Slots, distances: level3SlotDistances },
  4: { slots: level4Slots, distances: level4SlotDistances },
  5: { slots: level5Slots, distances: level5SlotDistances },
};

export const getRerollableSlots = (levelId: number): { slots: SlotVariant[][]; distances: number[] } | null =>
  LEVEL_REROLL_SLOTS[levelId] ?? null;

/**
 * Raw pools/distances for every level that rolls from a pool: the live
 * re-roll's levels, and the final exam, which rolls once and never re-rolls.
 * For the dev tools that stage a level's variants, which must reach Level 12's
 * as well; the drive and the routing binding read `getRerollableSlots`.
 */
const LEVEL_POOLED_SLOTS: Record<number, { slots: SlotVariant[][]; distances: number[] }> = {
  ...LEVEL_REROLL_SLOTS,
  12: { slots: level12Slots, distances: level12SlotDistances },
};

export const getPooledSlots = (levelId: number): { slots: SlotVariant[][]; distances: number[] } | null =>
  LEVEL_POOLED_SLOTS[levelId] ?? null;

/**
 * The levels whose road is painted from what was rolled onto it: Level 4's
 * markings, and the lines Level 12's borrowed scenarios declare. Every other
 * pooled level paints the same road whatever is rolled.
 */
const LEVEL_ASSEMBLERS: Record<number, (events: ScenarioEvent[]) => LevelConfig> = {
  4: assembleLevel4,
  12: assembleLevel12,
};

/**
 * A level played with exactly these events in its slots, painted as a roll of
 * them would be. For the dev tools that stage variants by hand: spreading the
 * events over the static level kept the static roll's paint, which put the
 * wrong line under a staged one.
 */
export const levelWithEvents = (levelId: number, events: ScenarioEvent[]): LevelConfig | null => {
  const assemble = LEVEL_ASSEMBLERS[levelId];
  if (assemble) return assemble(events);
  const level = LEVELS.find(entry => entry.id === levelId);
  return level ? { ...level, events } : null;
};

/** Gap to use when a level has fewer than two events to measure its own spacing from. */
const DEFAULT_EVENT_SPACING = 700;

/**
 * Appends one adaptive remediation scenario to a level's route.
 *
 * Placed after the level's own last event, at that level's own spacing, with
 * the original trailing runway preserved behind it - so the road grows by
 * exactly one event's worth and every existing event stays where it was. Each
 * level's pacing is load-bearing and specific to it (Level 7 spaces its events
 * 1,110 to 3,300 apart, for manoeuvres driven at up to 100 km/h; Level 2 uses
 * 660 at 30), which is why the gap is measured from the level rather than fixed
 * globally.
 *
 * Growing `roadLength` is what makes this additive rather than disruptive. The
 * alternative - squeezing the extra event into the runway that already exists -
 * would tighten spacing below the level's own standard in ten of thirteen
 * levels, and Level 7 has no room for one at all.
 *
 * The variant keeps its own authored timing. How much room a learner gets is
 * theta's alone, for every event in the level, so nothing else may scale the
 * distance theta scales - or the two could not be told apart.
 *
 * Exported for ScenarioLab's fake-history panel, which needs to apply an
 * already-computed choice to an already-staged level rather than re-deriving
 * one from scratch.
 */
export const withRemediation = (level: LevelConfig, variant: SlotVariant): LevelConfig => {
  // The selector draws from every level at or below this one, including this
  // one, so it can legitimately pick a variant this level already rolled.
  // Asking the same question twice in one drive teaches nothing extra.
  if (level.events.some(event => event.id === variant.id)) return level;

  const distances = [...level.events.map(event => event.triggerAtDistance)].sort((a, b) => a - b);
  const last = distances.at(-1) ?? 0;
  const previous = distances.at(-2);
  const spacing = previous === undefined ? DEFAULT_EVENT_SPACING : Math.max(last - previous, DEFAULT_EVENT_SPACING);
  const runway = Math.max(level.roadLength - last, 0);
  const placement = last + spacing;
  const placed: ScenarioEvent = { ...variant, triggerAtDistance: placement };

  return {
    ...level,
    events: [...level.events, placed],
    roadLength: placement + runway,
    // A line the item is graded on comes with it, over its whole graded zone,
    // as Level 12 paints the lines it borrows: appended to a road of broken
    // yellow, a crossing the road permits would be failed for crossing a line
    // that is not there. Placed after every span of the level's own, so it
    // starts past the zone of the event before it and leaves that road as it
    // was. A level that declares no paint keeps the constant road; no item
    // that declares a line can be appended to one (they come from Level 4 on).
    ...(level.paint ? { paint: { ...level.paint, spans: [...level.paint.spans, ...declaredLineSpans([placed])] } } : {}),
  };
};

/**
 * The config to actually play: a fresh roll where one exists, else the static
 * level. Passing a coverage record makes the roll pick what the learner still
 * needs rather than drawing evenly; passing a weakCompetency additionally
 * biases the roll toward whichever competency the player is currently
 * weakest on (see filterByWeakCompetency in pooling.ts); passing a remediation
 * variant (see selectPractice in domain/adaptive/practiceSelection.ts) appends one
 * extra targeted scenario to the end of the route.
 */
export const buildLevelConfig = (
  levelId: number,
  coverage?: SignCoverage,
  weakCompetency?: DrivingCompetency | null,
  // A seeded generator makes the roll reproducible: real play passes the
  // attempt's roll stream (domain/scenario/attemptSeed), the scenario harness
  // its own seed. Omitted, the roll draws from Math.random.
  rng?: () => number,
  remediation?: SlotVariant | null
): LevelConfig | null => {
  const base =
    LEVEL_BUILDERS[levelId]?.(coverage, weakCompetency, rng) ?? LEVELS.find(level => level.id === levelId) ?? null;

  return base && remediation ? withRemediation(base, remediation) : base;
};
