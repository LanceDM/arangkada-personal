/**
 * What the briefing and the mission panel say a level asks of the player must
 * be what the drive scores: every scored decision counted, the pass mark
 * reachable, and every speed the route grades against named.
 */
import { describe, expect, it } from 'vitest';
import { getPooledSlots, LEVELS, levelWithEvents, rollLeansToWeakArea } from './levelCatalog';
import {
  compositionParts,
  missionComposition,
  postedLimits,
  postedLimitsLine,
} from './missionComposition';
import type { LevelConfig, ScenarioEvent } from './scenarioDefinition';

const level = (id: number): LevelConfig => LEVELS.find(entry => entry.id === id)!;

const pooledVariant = (levelId: number, id: string): ScenarioEvent =>
  getPooledSlots(levelId)!.slots.flat().find(variant => variant.id === id)! as ScenarioEvent;

describe('a level counted the way the drive scores it', () => {
  it('counts the garage, the road and the crash scene, and their maximum', () => {
    const counted = Object.fromEntries(
      LEVELS.map(entry => {
        const { road, garage, aftermath, maxScore } = missionComposition(entry);
        return [entry.id, [road, garage, aftermath, maxScore]];
      })
    );
    expect(counted).toEqual({
      0: [5, 0, 0, 85],
      1: [5, 0, 0, 110],
      2: [0, 11, 0, 220],
      3: [8, 0, 0, 165],
      4: [5, 0, 0, 110],
      5: [8, 0, 0, 180],
      6: [8, 0, 0, 175],
      7: [7, 0, 0, 165],
      8: [6, 0, 0, 170],
      9: [6, 0, 4, 270],
      10: [7, 4, 0, 215],
      11: [10, 0, 0, 225],
      12: [8, 0, 0, 200],
    });
  });

  it('puts every pass mark within reach, and Level 2 only with its garage', () => {
    for (const entry of LEVELS) expect(missionComposition(entry).maxScore).toBeGreaterThanOrEqual(entry.requiredScore);
    const level2 = level(2);
    expect(level2.events).toEqual([]);
    expect(missionComposition(level2).garage).toBe(11);
  });

  it('names a practice item apart and scores it as nothing, as the game does', () => {
    const level8 = level(8);
    const practice = { ...pooledVariant(3, 'level3.speed.min-40'), remediation: true } as ScenarioEvent;
    const withPractice = { ...level8, events: [...level8.events, practice] };
    const composition = missionComposition(withPractice);
    expect(composition.road).toBe(6);
    expect(composition.practice).toBe(1);
    expect(composition.maxScore).toBe(missionComposition(level8).maxScore);
    expect(compositionParts(composition)).toEqual(['6 road events', '+1 practice (not scored)']);
  });

  it('says nothing of a road that grades nothing, beside a garage', () => {
    const level2 = level(2);
    const practice = { ...pooledVariant(3, 'level3.speed.min-40'), remediation: true } as ScenarioEvent;
    expect(compositionParts(missionComposition({ ...level2, events: [practice] }))).toEqual(['11 garage checks', '+1 practice (not scored)']);
    expect(compositionParts(missionComposition({ ...level2, garage: undefined }))).toEqual(['0 road events']);
  });

  it('lists the parts in the order they are played', () => {
    expect(compositionParts(missionComposition(level(2)))).toEqual(['11 garage checks']);
    expect(compositionParts(missionComposition(level(9)))).toEqual(['6 road events', '4 crash-scene steps']);
    expect(compositionParts(missionComposition(level(10)))).toEqual(['4 garage checks', '7 road events']);
  });
});

describe('the speeds a route grades against', () => {
  it("names Level 7's merge minimum, its exit ramp and its toll", () => {
    expect(postedLimits(level(7))).toEqual([
      { speed: 60, rule: 'minimum' },
      { speed: 60, rule: 'maximum' },
      { speed: 40, rule: 'maximum' },
    ]);
    expect(postedLimitsLine(postedLimits(level(7)))).toBe(
      'Other limits on this route: minimum 60 km/h, 60 km/h, 40 km/h.'
    );
  });

  it('names what a roll posts, and leaves out a maximum equal to the road limit', () => {
    const rolled = (id: string) => levelWithEvents(3, [pooledVariant(3, id)])!;
    expect(postedLimits(rolled('level3.speed.min-40'))).toEqual([{ speed: 40, rule: 'minimum' }]);
    expect(postedLimits(rolled('level3.speed.max-20'))).toEqual([{ speed: 20, rule: 'maximum' }]);
    const atTheLimit = { ...pooledVariant(3, 'level3.speed.max-20'), postedSpeed: 40 };
    expect(postedLimits(levelWithEvents(3, [atTheLimit])!)).toEqual([]);
    expect(postedLimitsLine([])).toBeNull();
  });

  it("names Level 10's bus on the grade", () => {
    expect(postedLimits(level(10))).toEqual([{ speed: 20, rule: 'maximum' }]);
  });
});

describe("the levels whose roll leans toward a weak area", () => {
  it('are Levels 1-5 alone', () => {
    expect(LEVELS.filter(entry => rollLeansToWeakArea(entry.id)).map(entry => entry.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
