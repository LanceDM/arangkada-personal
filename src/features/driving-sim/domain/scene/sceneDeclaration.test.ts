/**
 * Every scenario says what it puts on the road.
 *
 * The scene used to be recovered from the event's player-facing `description`,
 * which made the picture a function of prose: rewording a sentence, or
 * translating one, silently changed what was drawn and what could be hit.
 *
 * These are the tests that keep that from coming back. The first walks the
 * whole roster and fails on any event whose scene is not fully determined by
 * declared data. The second rewrites every description in the game and asserts
 * the named scene is unchanged. The third goes further and composes the actual
 * nodes, with both the prose and the sign asset filenames rewritten - an image
 * name once decided who was standing at a crossing, so renaming a file in
 * `public/` moved the world.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, getRerollableSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { resolveScene } from './ResolvedScene';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';

/**
 * The events `resolveScene` is responsible for. Checkpoints, markings,
 * signed scenes and vehicle failures are dispatched on their own declared data
 * before the scene is resolved, and zero-visibility weather draws nothing on
 * the carriageway. Mirrors the guard order in `eventSceneNodes`.
 *
 * A `bay` is declared data too, and composes beside whatever else the event
 * puts on the road (see `declaredBay`), so an event whose whole scene is the
 * space it asks the driver to pull into has declared one — `resolveScene`
 * naming it `nothing` is that division of labour, not a missing declaration.
 */
const ownsItsScene = (event: ScenarioEvent) =>
  !event.inspection &&
  !event.marking &&
  !(event.sign && event.scene) &&
  !event.emergency &&
  !event.bay &&
  event.effect?.visibility === undefined;

/** Every event in the game, pooled variants included. */
const everyEvent = (): Array<{ level: LevelConfig; event: ScenarioEvent }> => {
  const rows: Array<{ level: LevelConfig; event: ScenarioEvent }> = [];
  for (const level of LEVELS) {
    const seen = new Set<string>();
    const take = (event: ScenarioEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      rows.push({ level, event });
    };
    level.events.forEach(take);
    const pools = getRerollableSlots(level.id);
    if (!pools) continue;
    for (const slot of pools.slots) {
      for (const variant of slot) take({ ...variant, triggerAtDistance: 0 } as ScenarioEvent);
    }
  }
  return rows;
};

const sceneOf = (level: LevelConfig, event: ScenarioEvent) =>
  resolveScene(event, { isTutorialLevel: level.id === 0 });

/** Frozen clock, so the scenes with moving parts compare equal to themselves. */
const FROZEN_NOW = 1_700_000_000_000;

/**
 * The scene one event actually composes, over its whole visible approach and
 * both before and after it is answered.
 *
 * No global clock stub: every moving pose in a frame is taken from the `now`
 * this passes in, so two compositions a microsecond apart are the same scene.
 */
const nodesOf = (level: LevelConfig, event: ScenarioEvent): string => {
  const trigger = 1200;
  const probe: LevelConfig = { ...level, events: [{ ...event, triggerAtDistance: trigger }] };
  const frames: unknown[] = [];
  for (const handled of [[] as number[], [trigger]]) {
    for (const offset of [-600, -180, 0]) {
      frames.push(
        composeWorldFrame(
          { level: probe, distance: trigger + offset, handled: new Set(handled), curves: [] },
          { playerLane: 2, now: () => FROZEN_NOW }
        )
      );
    }
  }
  // The filename itself rides along on a sign node for the React plate card to
  // show; the canvas never reads it. Dropping it from the comparison is what
  // makes the assertion "nothing about the scene depends on this string".
  return JSON.stringify(frames, (key, value) => (key === 'image' ? undefined : value));
};

describe('every scenario declares its own scene', () => {
  it('leaves no event resolving to nothing for want of a declaration', () => {
    // `nothing` is the end of the road for an event that declared no scene and
    // whose other fields say nothing either — which is exactly the case the
    // description keywords used to cover.
    const undeclared = everyEvent()
      .filter(({ event }) => ownsItsScene(event))
      .filter(({ level, event }) => sceneOf(level, event).kind === 'nothing')
      .map(({ event }) => `${event.id} (${event.type})`);

    expect(undeclared).toEqual([]);
  });

  it('draws the same scene whatever the description says', () => {
    const rewritten = everyEvent()
      .filter(({ event }) => ownsItsScene(event))
      .filter(({ level, event }) => {
        const asWritten = sceneOf(level, event);
        // Two rewrites, in both of the game's languages, plus an empty one: if
        // any keyword still reaches the scene, one of them will move it.
        const variants = ['', 'Ingat sa daan.', 'A jeepney gives way at the roundabout crossing.'];
        return variants.some(
          description =>
            JSON.stringify(sceneOf(level, { ...event, description })) !== JSON.stringify(asWritten)
        );
      })
      .map(({ event }) => event.id);

    expect(rewritten).toEqual([]);
  });

  it('composes the same scene whatever the prose and the asset filenames say', () => {
    const moved = everyEvent()
      .filter(({ level, event }) => {
        const asWritten = nodesOf(level, event);
        const renamed: ScenarioEvent = {
          ...event,
          description: 'Ingat sa daan.',
          ...(event.sign ? { sign: { ...event.sign, image: 'renamed-asset.png' } } : {}),
          ...(event.lawCitation ? { lawCitation: 'RA 0000' } : {}),
        };
        return nodesOf(level, renamed) !== asWritten;
      })
      .map(({ event }) => event.id);

    expect(moved).toEqual([]);
  });
});
