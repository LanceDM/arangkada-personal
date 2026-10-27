/**
 * A line a scenario grades is painted on the road wherever it is graded.
 *
 * Level 12 borrows its violation-risk slot whole: every portable lane rule whose
 * line may not be crossed even briefly. Its road was broken yellow everywhere,
 * so a driver who read the paint saw a line that permits the pass and was
 * failed for making it. The hazard slot's overloaded truck had
 * the same fault: its own level refuses the overtake over a double yellow.
 *
 * Each now brings its line as a declaration, and the road carries it on every
 * frame of its graded zone. Read through the renderer's own `paintAt`, so the
 * blank the road leaves either side of a change of paint is counted too.
 */
import { describe, expect, it } from 'vitest';
import { COMPETENCIES } from '@/domain/learner/profile';
import { LEVELS, getPooledSlots, levelWithEvents, withRemediation } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { remediationCandidates } from '@/features/driving-sim/domain/scenario/remediationPool';
import { buildEvents, type SlotVariant } from '@/features/driving-sim/domain/scenario/pooling';
import { declaredLine } from '@/features/driving-sim/domain/scenario/roadLine';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  SLOTS,
  SLOT_DISTANCES,
  createLevel12,
  level12,
} from '@/features/driving-sim/domain/scenario/content/levels/level12';
import { computeWarningDistances } from '@/features/driving-sim/domain/systems/eventScheduler';
import { ACTION_ZONE_EXIT } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { paintAt } from './roadRenderer';

const VIOLATION_RISK = 6;
const HAZARD = 5;

/** Level 12 rolled with `slot` set to its `index`th variant, every other slot at its first. */
const rolledWith = (slot: number, index: number): LevelConfig => {
  let call = 0;
  // `buildEvents` draws once per slot, in slot order.
  return createLevel12(() => {
    const at = call++;
    return at === slot ? (index + 0.5) / SLOTS[slot].length : 0;
  });
};

/** Every road distance a scenario is graded over, as the grader measures its zone. */
const gradedDistances = (level: LevelConfig, event: ScenarioEvent): number[] => {
  const lead = computeWarningDistances(level.events).get(event.triggerAtDistance)!;
  const distances: number[] = [];
  for (let d = event.triggerAtDistance - lead; d <= event.triggerAtDistance + ACTION_ZONE_EXIT; d++) distances.push(d);
  return distances;
};

/** Where on `level` the road does not carry `art` while `event` is graded. */
const unpainted = (level: LevelConfig, event: ScenarioEvent, art: string | null) =>
  gradedDistances(level, event).filter(d => paintAt(d, level.paint!) !== art);

const eventOf = (level: LevelConfig, variant: SlotVariant) => level.events.find(event => event.id === variant.id)!;

describe('the final exam paints the line it grades', () => {
  it('declares a line for every variant of the violation-risk slot', () => {
    expect(SLOTS[VIOLATION_RISK].map(variant => [variant.id, declaredLine(variant)])).toEqual([
      ['level4.longitudinal.double-solid-yellow', 'double_solid_yellow'],
      ['level4.longitudinal.single-solid-yellow', 'single_solid_yellow'],
      ['level4.longitudinal.centre-line', 'centre_line'],
      ['level4.longitudinal.broken-and-solid-yellow', 'broken_and_solid_yellow'],
      ['level4.longitudinal.solid-yellow-side', 'broken_white_solid_yellow'],
      ['level6.no-overtake-double-yellow', 'double_solid_yellow'],
    ]);
  });

  it('carries each one on every frame its scenario is graded', () => {
    const gaps = SLOTS[VIOLATION_RISK].flatMap((variant, index) => {
      const level = rolledWith(VIOLATION_RISK, index);
      const missing = unpainted(level, eventOf(level, variant), declaredLine(variant));
      return missing.length ? [`${variant.id}: not painted at ${missing[0]}…${missing.at(-1)}`] : [];
    });

    expect(gaps).toEqual([]);
  });

  it('carries the double yellow the hazard slot’s truck is refused over, and lines no other hazard', () => {
    const lined = SLOTS[HAZARD].filter(variant => declaredLine(variant) !== null);
    expect(lined.map(variant => variant.id)).toEqual(['level10.losing-its-load']);

    const index = SLOTS[HAZARD].indexOf(lined[0]);
    const level = rolledWith(HAZARD, index);
    expect(unpainted(level, eventOf(level, lined[0]), 'double_solid_yellow')).toEqual([]);
  });

  it('leaves every scenario that declares no line on the road’s own broken yellow, whatever is rolled', () => {
    const crossed: string[] = [];
    // Every pairing of the two slots that can bring a line, beside each other.
    SLOTS[HAZARD].forEach((_, hazard) => {
      SLOTS[VIOLATION_RISK].forEach((_, violation) => {
        let call = 0;
        const level = createLevel12(() => {
          const at = call++;
          if (at === HAZARD) return (hazard + 0.5) / SLOTS[HAZARD].length;
          if (at === VIOLATION_RISK) return (violation + 0.5) / SLOTS[VIOLATION_RISK].length;
          return 0;
        });
        for (const event of level.events) {
          if (declaredLine(event) !== null) continue;
          const missing = unpainted(level, event, 'broken_yellow');
          if (missing.length) crossed.push(`${event.id} beside ${hazard}/${violation}: ${missing[0]}`);
        }
      });
    });

    expect(crossed).toEqual([]);
  });

  it('paints the static level the dev tools stage from the same declarations', () => {
    const event = level12.events[VIOLATION_RISK];
    expect(unpainted(level12, event, declaredLine(event))).toEqual([]);
    // Built the way every roll is, so the two cannot drift.
    const events = buildEvents(SLOTS, SLOT_DISTANCES, pool => pool[0]);
    expect(level12.events.map(e => e.id)).toEqual(events.map(e => e.id));
  });
});

describe('a route staged by hand in the dev tools', () => {
  it('is painted as a roll of the same events would be, not with the static level’s lines', () => {
    const gaps = SLOTS[VIOLATION_RISK].flatMap((variant, index) => {
      const events = rolledWith(VIOLATION_RISK, index).events;
      const staged = levelWithEvents(12, events)!;
      expect(staged.paint, variant.id).toEqual(rolledWith(VIOLATION_RISK, index).paint);
      const missing = unpainted(staged, eventOf(staged, variant), declaredLine(variant));
      return missing.length ? [`${variant.id}: not painted at ${missing[0]}`] : [];
    });

    expect(gaps).toEqual([]);
  });

  it('keeps the static road of a level whose paint does not follow its roll', () => {
    const level3 = LEVELS.find(level => level.id === 3)!;
    expect(levelWithEvents(3, level3.events)!.paint).toEqual(level3.paint);
  });
});

describe('a declared line and its own level', () => {
  it('is the line its own level already paints at its point', () => {
    const declared = LEVELS.flatMap(level =>
      level.events.filter(event => event.roadLine).map(event => ({ level, event }))
    );
    expect(declared.map(({ event }) => event.id).sort()).toEqual([
      'level10.losing-its-load',
      'level6.no-overtake-double-yellow',
    ]);
    for (const { level, event } of declared) {
      expect(paintAt(event.triggerAtDistance, level.paint!), event.id).toBe(event.roadLine);
    }
  });
});

/** Every route a level can be driven on: its static config, or each variant of each slot rolled in turn. */
const everyRoute = (): { label: string; level: LevelConfig }[] =>
  LEVELS.flatMap(level => {
    const pooled = getPooledSlots(level.id);
    if (!pooled) return [{ label: `level ${level.id}`, level }];
    return pooled.slots.flatMap((pool, slot) =>
      pool.map((variant, index) => ({
        label: `level ${level.id} slot ${slot} ${variant.id}`,
        level: levelWithEvents(
          level.id,
          buildEvents(pooled.slots, pooled.distances, (p, at) => (at === slot ? p[index] : p[0]))
        )!,
      }))
    );
  });

describe('a level’s own lines', () => {
  // Level 6's double yellow opened its zone 130 before it was painted, and
  // Level 4 painted 260 before its point while grading from 400: a crossing
  // over the broken yellow was failed for crossing the line.
  it('are painted on every frame their scenario is graded, on every route', () => {
    const gaps = everyRoute().flatMap(({ label, level }) =>
      level.events.flatMap(event => {
        const art = declaredLine(event);
        if (!art || !level.paint) return [];
        const missing = unpainted(level, event, art);
        return missing.length ? [`${label} ${event.id}: not painted at ${missing[0]}…${missing.at(-1)}`] : [];
      })
    );

    expect(gaps).toEqual([]);
  });
});

describe('a practice item appended to another level', () => {
  const hosts = everyRoute().filter(({ level }) => level.id >= 1 && level.id <= 11 && level.paint);
  const lined = (maxLevelId: number) =>
    COMPETENCIES.flatMap(competency => remediationCandidates(competency, maxLevelId)).filter(
      ({ variant }) => declaredLine(variant) !== null
    );

  it('brings the line it is graded on, over every frame it is graded', () => {
    expect(lined(11).length).toBeGreaterThan(0);
    const gaps = hosts.flatMap(({ label, level }) =>
      lined(level.id).flatMap(({ variant }) => {
        const practised = withRemediation(level, variant);
        if (practised === level) return [];
        const missing = unpainted(practised, eventOf(practised, variant), declaredLine(variant));
        return missing.length ? [`${variant.id} on ${label}: not painted at ${missing[0]}…${missing.at(-1)}`] : [];
      })
    );

    expect(gaps).toEqual([]);
  });

  // The runway past the host's last event becomes the item's approach, so
  // its line may start there; up to that event's zone, nothing moves.
  it('leaves the host’s own road as it was, through its last zone', () => {
    const moved = hosts.flatMap(({ label, level }) =>
      lined(level.id).flatMap(({ variant }) => {
        const practised = withRemediation(level, variant);
        expect(practised.paint!.oncomingLanes).toBe(level.paint!.oncomingLanes);
        expect(practised.paint!.base).toBe(level.paint!.base);
        const lastExit = Math.max(...level.events.map(event => event.triggerAtDistance)) + ACTION_ZONE_EXIT;
        const changed = [];
        for (let d = 0; d <= lastExit; d++) {
          if (paintAt(d, practised.paint!) !== paintAt(d, level.paint!)) changed.push(d);
        }
        return changed.length ? [`${variant.id} on ${label}: ${changed[0]}…${changed.at(-1)}`] : [];
      })
    );

    expect(moved).toEqual([]);
  });

  it('brings nothing when it declares no line', () => {
    const level = LEVELS.find(entry => entry.id === 8)!;
    const plain = COMPETENCIES.flatMap(competency => remediationCandidates(competency, 8)).find(
      ({ variant }) => declaredLine(variant) === null && !level.events.some(event => event.id === variant.id)
    )!;
    expect(withRemediation(level, plain.variant).paint).toEqual(level.paint);
  });
});
