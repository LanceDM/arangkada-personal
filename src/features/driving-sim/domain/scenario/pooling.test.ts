// Unit tests for the pool-rolling machinery shared by levels 1-4
// (domain/scenario/pooling.ts). No React, no canvas.
import { describe, it, expect } from 'vitest';
import { buildEvents, filterByWeakCompetency, pickWeighted, rerollUpcomingEvents, type SlotVariant } from './pooling';
import type { ScenarioEvent } from './scenarioDefinition';

const makeVariant = (overrides: Partial<SlotVariant> = {}): SlotVariant => ({
  id: 'level0.slot.variant',
  type: 'obstacle_ahead',
  description: 'A variant',
  correctAction: 'brake',
  points: 10,
  penaltyMessage: 'penalty',
  rewardMessage: 'reward',
  duration: 200,
  ...overrides,
});

describe('buildEvents', () => {
  it('attaches each slot\'s distance and preserves the picked variant\'s other fields', () => {
    const slots: SlotVariant[][] = [
      [makeVariant({ id: 'slot0.a' }), makeVariant({ id: 'slot0.b' })],
      [makeVariant({ id: 'slot1.a', correctAction: 'stop', points: 25 })],
    ];
    const distances = [500, 1500];

    const events = buildEvents(slots, distances, pool => pool[0]);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: 'slot0.a', triggerAtDistance: 500 });
    expect(events[1]).toMatchObject({
      id: 'slot1.a',
      triggerAtDistance: 1500,
      correctAction: 'stop',
      points: 25,
    });
  });

  it('lets the picker choose a different variant per slot index', () => {
    const slots: SlotVariant[][] = [
      [makeVariant({ id: 'slot0.first' }), makeVariant({ id: 'slot0.second' })],
    ];
    const distances = [700];

    const events = buildEvents(slots, distances, (pool, slotIndex) => pool[slotIndex === 0 ? 1 : 0]);

    expect(events[0].id).toBe('slot0.second');
    expect(events[0].triggerAtDistance).toBe(700);
  });
});

describe('filterByWeakCompetency', () => {
  const pool = [
    makeVariant({ id: 'a', competency: 'speed_control' }),
    makeVariant({ id: 'b', competency: 'lane_discipline' }),
    makeVariant({ id: 'c', competency: 'speed_control' }),
  ];

  it('returns only items matching the weak competency when at least one exists', () => {
    const result = filterByWeakCompetency(pool, 'speed_control');
    expect(result.map(v => v.id)).toEqual(['a', 'c']);
  });

  it('falls back to the full pool when weakCompetency is null', () => {
    expect(filterByWeakCompetency(pool, null)).toBe(pool);
  });

  it('falls back to the full pool when nothing in the pool matches', () => {
    const result = filterByWeakCompetency(pool, 'pedestrians');
    expect(result).toBe(pool);
  });
});

describe('pickWeighted', () => {
  it('only ever returns an item present in the pool', () => {
    const pool = [makeVariant({ id: 'a' }), makeVariant({ id: 'b' }), makeVariant({ id: 'c' })];
    // Exercise every draw a Math.random()-backed rng could plausibly produce.
    for (const rngValue of [0, 0.1, 0.33, 0.5, 0.66, 0.99]) {
      const picked = pickWeighted(pool, null, () => rngValue);
      expect(pool).toContain(picked);
    }
  });

  it('only ever returns an item present in the filtered (weak-competency) pool', () => {
    const pool = [
      makeVariant({ id: 'a', competency: 'speed_control' }),
      makeVariant({ id: 'b', competency: 'lane_discipline' }),
      makeVariant({ id: 'c', competency: 'speed_control' }),
    ];
    const scoped = pool.filter(v => v.competency === 'speed_control');

    for (const rngValue of [0, 0.25, 0.5, 0.75, 0.99]) {
      const picked = pickWeighted(pool, 'speed_control', () => rngValue);
      expect(scoped).toContain(picked);
    }
  });
});

describe('rerollUpcomingEvents', () => {
  const asEvent = (variant: SlotVariant, triggerAtDistance: number): ScenarioEvent => ({
    ...variant,
    triggerAtDistance,
  });

  const slots: SlotVariant[][] = [
    [makeVariant({ id: 'slot0.a' }), makeVariant({ id: 'slot0.b' })],
    [makeVariant({ id: 'slot1.a' }), makeVariant({ id: 'slot1.b' })],
  ];
  const distances = [1000, 2000];

  it('rerolls an event beyond the safety margin', () => {
    const currentEvents = [asEvent(slots[0][0], 1000), asEvent(slots[1][0], 2000)];
    const result = rerollUpcomingEvents(currentEvents, slots, distances, 0, 500, null, undefined, () => 0.99);

    // Far past the margin (2000 - 0 = 2000 > 500): eligible to reroll, and the
    // id may or may not change depending on the draw, but it must still come
    // from that slot's own pool.
    expect(slots[1].map(v => v.id)).toContain(result[1].id);
    expect(result[1].triggerAtDistance).toBe(2000);
  });

  it('never touches an event within the safety margin', () => {
    const currentEvents = [asEvent(slots[0][0], 1000), asEvent(slots[1][0], 2000)];
    // Player at 600: slot 0 is 400 away, inside a 500 margin.
    const result = rerollUpcomingEvents(currentEvents, slots, distances, 600, 500, null, undefined, () => 0.99);

    expect(result[0]).toEqual(currentEvents[0]);
  });

  /**
   * The regression this guards: the practice selector's `withRemediation`
   * (domain/scenario/levelCatalog.ts) appends one adaptively-selected event to the end of
   * a level's route, past every slot the level itself declares. Before this
   * test existed, `rerollUpcomingEvents` had no coverage at all and indexed
   * into `slots[index]`/`distances[index]` assuming they were always exactly
   * as long as `currentEvents` - true until an appended event made
   * `currentEvents` longer. In real play (Level 3 -> Level 4, both live-
   * rerollable) that threw inside the requestAnimationFrame loop and froze
   * the drive outright.
   */
  it('leaves an event past the end of the level\'s own slots untouched, rather than throwing', () => {
    const injected = asEvent(makeVariant({ id: 'level3.borrowed-remediation', remediation: true }), 5000);
    const currentEvents = [asEvent(slots[0][0], 1000), asEvent(slots[1][0], 2000), injected];

    expect(() =>
      rerollUpcomingEvents(currentEvents, slots, distances, 0, 500, 'speed_control', undefined, () => 0.5)
    ).not.toThrow();

    const result = rerollUpcomingEvents(currentEvents, slots, distances, 0, 500, 'speed_control', undefined, () => 0.5);
    expect(result[2]).toEqual(injected);
  });

  /**
   * Proves the `remediation` marker check does real work beyond the index
   * bound, not just the same thing twice: a marked event sitting *within*
   * the level's own slot range (index < slots.length) would pass an
   * index-only guard straight through to `slots[index]` and get rerolled
   * like ordinary level content - silently discarding the deliberate pick
   * and replacing it with an unrelated one from that position's pool. Not
   * how the selector places content today (always appended past the end), but the
   * whole point of checking the marker is to stay correct if that ever
   * changes.
   */
  it('never rerolls a remediation-marked event even if it sits inside the level\'s own slot range', () => {
    const injected = asEvent(makeVariant({ id: 'level3.borrowed-remediation', remediation: true }), 1000);
    const currentEvents = [injected, asEvent(slots[1][0], 2000)];

    const result = rerollUpcomingEvents(currentEvents, slots, distances, 0, 500, null, undefined, () => 0.99);

    expect(result[0]).toEqual(injected);
  });

  it('draws from a coverage record when one is supplied', () => {
    const currentEvents = [asEvent(slots[0][0], 1000), asEvent(slots[1][0], 2000)];
    const result = rerollUpcomingEvents(currentEvents, slots, distances, 0, 500, null, {});

    expect(slots[1].map(v => v.id)).toContain(result[1].id);
  });
});
