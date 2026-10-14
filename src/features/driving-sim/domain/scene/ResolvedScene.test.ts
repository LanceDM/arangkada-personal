// What every event in the game puts on the road, checked against the real
// level roster. `resolveScene` is pure and canvas-free, which is the whole
// reason it was split out of `drawEvents`: the choice of scene is now a value
// that can be asserted on, where before it only existed as a side effect of
// painting and could only be checked by looking at the screen.
import { describe, it, expect } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { resolveScene, pedestriansFor } from './ResolvedScene';

/**
 * The events `resolveScene` is actually responsible for.
 *
 * Checkpoints, markings, signed scenes and vehicle emergencies are dispatched
 * on their own declared data before the scene is ever consulted, and
 * zero-visibility weather draws nothing on the carriageway at all. Mirrors the
 * guard order at the top of `drawEvents`.
 */
const ownsItsScene = (event: ScenarioEvent) =>
  !event.inspection &&
  !event.marking &&
  !(event.sign && event.scene) &&
  !event.emergency &&
  event.effect?.visibility === undefined;

const everyResolvedScene = () =>
  LEVELS.flatMap((level: LevelConfig) =>
    level.events
      .filter(ownsItsScene)
      .map(event => ({
        level,
        event,
        scene: resolveScene(event, { isTutorialLevel: level.id === 0 }),
      }))
  );

/** A minimal event, for the cases that are about the classifier rather than content. */
const anEvent = (overrides: Partial<ScenarioEvent>): ScenarioEvent => ({
  id: 'test.event',
  triggerAtDistance: 100,
  type: 'obstacle_ahead',
  description: '',
  correctAction: 'brake',
  points: 10,
  penaltyMessage: '',
  rewardMessage: '',
  duration: 100,
  ...overrides,
});

describe('resolveScene over the real level roster', () => {
  it('gives every event a scene it can actually draw', () => {
    for (const { event, scene } of everyResolvedScene()) {
      expect(scene.kind, `${event.id} has no scene`).toBeTruthy();
    }
  });

  // The '?' compliance glyph is the end of the keyword chain: it means the
  // renderer was handed an event, found no declared scene and matched no
  // keyword, and drew a question mark on the road rather than the situation.
  // Nothing in the game should reach it, and this is the check that says so
  // when a description is reworded.
  it('never falls all the way through to the unknown-scene glyph', () => {
    const fellThrough = everyResolvedScene()
      .filter(({ scene }) => scene.kind === 'compliance-icon' && scene.glyph === '❓')
      .map(({ event }) => `${event.id}: "${event.description.slice(0, 60)}"`);

    expect(fellThrough).toEqual([]);
  });

  it('draws no crossing without somebody on it', () => {
    for (const { event, scene } of everyResolvedScene()) {
      if (scene.kind !== 'open-road-crossing') continue;
      expect(scene.pedestrians.length, `${event.id} has an empty crossing`).toBeGreaterThan(0);
      // Exactly the people the event marked solid can be hit. A crossing with
      // nothing solid on it is one a driver can legally ignore, which for a
      // "stop for the pedestrian" event is the bug rather than the lesson.
      expect(
        scene.pedestrians.some(person => person.solid),
        `${event.id} has a crossing nobody can be hurt on`
      ).toBe(true);
    }
  });
});

// The specific question this refactor started from: level 2 and level 5 both
// say "pedestrian crossing", and looked like two implementations of one thing.
// They are not, and this pins down which is which so a later tidy-up cannot
// quietly merge them.
describe('level 2 and level 5 crossings are different world objects', () => {
  const find = (id: string) => {
    const event = LEVELS.flatMap(level => level.events).find(candidate => candidate.id === id);
    if (!event) throw new Error(`no such event: ${id}`);
    return event;
  };

  it('level 2 drives out across a footpath, not a road crossing', () => {
    // A driveway mouth carries the sidewalk across it and has no stop line of
    // its own — genuinely a different piece of road from a zebra on a street.
    const scene = resolveScene(find('level2.drive-out.neighbour'), { isTutorialLevel: false });
    expect(scene.kind).toBe('driveway-crossing');
  });

  it('level 5 is a marked crossing on open road', () => {
    const scene = resolveScene(find('level5.crossing-yield.parent-and-child'), { isTutorialLevel: false });
    expect(scene.kind).toBe('open-road-crossing');
  });
});

describe('the scene comes from what the event declares, never from its prose', () => {
  it('uses the pedestrians an event lists', () => {
    const declared = anEvent({
      type: 'pedestrian_crossing',
      description: 'A lola crosses ahead of you.',
      pedestrians: [{ kind: 'adult', solid: true }, { kind: 'child' }],
    });

    expect(pedestriansFor(declared)).toEqual([
      { kind: 'adult', solid: true },
      { kind: 'child' },
    ]);
  });

  it('puts one adult on a crossing that names nobody, whatever the prose says', () => {
    expect(pedestriansFor(anEvent({ description: 'A lola crosses ahead of you.' })))
      .toEqual([{ kind: 'adult', solid: true }]);
    expect(pedestriansFor(anEvent({ description: 'Somebody steps onto the lane.' })))
      .toEqual([{ kind: 'adult', solid: true }]);
  });

  it('uses the actor an event names', () => {
    const declared = anEvent({
      description: 'A slow vehicle blocks the lane ahead.',
      actor: { kind: 'jeepney' },
    });
    expect(resolveScene(declared, { isTutorialLevel: false }))
      .toEqual({ kind: 'road-actor', actor: { kind: 'jeepney' } });
  });

  it('does not read an actor out of the description', () => {
    // The guarantee this whole module exists for: rewording or translating a
    // sentence shown to the player cannot change what is on the road.
    expect(resolveScene(anEvent({ description: 'A jeepney stops dead ahead of you.' }), { isTutorialLevel: false }))
      .toEqual({ kind: 'generic-hazard' });
  });

  it('takes the scene an event declares outright', () => {
    expect(
      resolveScene(anEvent({ scenePrefab: { kind: 'bend_warning' } }), { isTutorialLevel: false })
    ).toEqual({ kind: 'bend-warning' });
    expect(
      resolveScene(
        anEvent({ type: 'scenario_trigger', scenePrefab: { kind: 'compliance', check: 'phone' } }),
        { isTutorialLevel: false }
      ).kind
    ).toBe('compliance-icon');
  });

  it('reads the same scene however the description is written', () => {
    const scene = (description: string) =>
      resolveScene(
        anEvent({ description, type: 'scenario_trigger', scenePrefab: { kind: 'main_road_junction' } }),
        { isTutorialLevel: false }
      );
    expect(scene('You reach the main road.')).toEqual(scene('Narating mo ang pangunahing kalsada.'));
    expect(scene('').kind).toBe('main-road-junction');
  });

  it('draws a generic hazard when it knows nothing at all', () => {
    expect(resolveScene(anEvent({ description: 'Something is in the way.' }), { isTutorialLevel: false }))
      .toEqual({ kind: 'generic-hazard' });
  });
});
