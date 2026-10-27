/**
 * What a road crash puts on the road.
 *
 * Reported from a playtest as "the crashed vehicle looks like a plain square",
 * and it was: `broken_down` drew a 32x44 rounded rectangle with a gradient and
 * a small warning triangle, while the scenario's own words promised "a van in
 * the creek and a car slewed across the lane, smoking. People are moving
 * between them". Two of those three things were not declared anywhere, so no
 * renderer could have drawn them.
 *
 * The fix is one prefab rather than three things a level remembers to place
 * together, and these are the properties that keep it honest: the wreck is the
 * only solid, its body is the shape that is drawn, and the scene comes from a
 * declaration rather than from the event's id or its prose.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { ROAD_ACTORS } from '@/features/driving-sim/domain/world/roadActors';
import { crashSceneNodes } from './prefabs';
import type { SceneNode } from './SceneNode';

const FROZEN_NOW = 1_700_000_000_000;
const level9 = LEVELS.find(level => level.id === 9)!;
const crash = level9.events.find(event => event.id === 'level9.crash-at-the-bottom')!;

const sceneAt = (ahead: number) =>
  composeWorldFrame(
    {
      level: level9,
      distance: crash.triggerAtDistance - ahead,
      handled: new Set<number>(),
      curves: curvesForLevel(level9),
    },
    { playerLane: 2, traffic: new Map(), now: () => FROZEN_NOW }
  );

const kinds = (nodes: readonly SceneNode[]) => nodes.map(node => node.kind);

describe('a crash the driver arrives at', () => {
  it('is declared as a crash, not assembled by hand or guessed from prose', () => {
    // The scene comes from `scenePrefab`. Nothing reads the event's id and
    // nothing reads its description — `sceneDeclaration.test.ts` enforces the
    // second across the whole game; this states the first for this scene.
    expect(crash.scenePrefab).toEqual({ kind: 'road_crash' });
    expect(crash.actor).toBeUndefined();
  });

  it('puts the wreck, the scene it sits in, and the people on the road together', () => {
    const nodes = sceneAt(120).nodes;
    expect(kinds(nodes)).toContain('road-situation');
    expect(kinds(nodes)).toContain('road-actor');
    expect(kinds(nodes)).toContain('pedestrian-group');

    const backdrop = nodes.find(node => node.kind === 'road-situation');
    expect(backdrop && backdrop.kind === 'road-situation' && backdrop.situation.situation).toBe(
      'crash-scene'
    );
    const wreck = nodes.find(node => node.kind === 'road-actor');
    expect(wreck && wreck.kind === 'road-actor' && wreck.actor.kind).toBe('crashed_car');
  });

  it('makes the wreck solid and nothing else', () => {
    // The van in the water and the debris are scenery: a driver cannot hit
    // something off the carriageway, and a debris field that ended the run
    // would be a different scenario.
    const { nodes, colliders } = sceneAt(120);
    expect(colliders).toHaveLength(1);
    expect(colliders[0].label).toBe('a wrecked car across the lane');

    const fromBackdrop = nodes
      .filter(node => node.kind === 'road-situation')
      .flatMap(node => node.solids ?? []);
    expect(fromBackdrop).toEqual([]);
  });

  it('draws the wreck at the size it can be hit at', () => {
    // The sprite is drawn around the actor's own position and the body is built
    // from the same geometry, so the picture and the hitbox cannot drift.
    const spec = ROAD_ACTORS.crashed_car;
    const { nodes, colliders } = sceneAt(120);
    const wreck = nodes.find(node => node.kind === 'road-actor')!;
    expect(wreck.kind).toBe('road-actor');
    if (wreck.kind !== 'road-actor') return;
    // `bodyAt` takes a centre and stores a corner, so the body is the sprite's
    // own position squared off around it.
    expect(colliders[0].x + colliders[0].width / 2).toBe(wreck.x);
    expect(colliders[0].y + colliders[0].height / 2).toBe(wreck.y);
    expect(colliders[0].width).toBe(spec.width);
    expect(colliders[0].height).toBe(spec.height);
  });

  it('lies across the lane rather than along it', () => {
    // Which is what makes it read as a wreck rather than as stopped traffic,
    // and what a driver has to stop short of.
    const spec = ROAD_ACTORS.crashed_car;
    expect(spec.width).toBeGreaterThan(spec.height);
  });

  it('stays on the road for the whole approach', () => {
    // A wreck that appeared only at the last moment would be a scenario the
    // driver could not have stopped for.
    for (const ahead of [400, 300, 200, 120, 60, 0]) {
      const { colliders } = sceneAt(ahead);
      expect(colliders.length, `nothing solid ${ahead} out`).toBe(1);
    }
  });
});

describe('the crash prefab', () => {
  it('is what the scene is built from, so a level never assembles one', () => {
    // Called directly with the same arguments the composition passes, and the
    // shape of what comes back is the contract: a backdrop and a solid wreck.
    const nodes = crashSceneNodes({ roadX: 100, screenY: 300, oncomingLanes: 2 });
    expect(kinds(nodes)).toEqual(['road-situation', 'road-actor']);
    expect(nodes.flatMap(node => node.solids ?? [])).toHaveLength(1);
  });

  it('paints the backdrop before the wreck, so the wreck is on top of it', () => {
    const nodes = crashSceneNodes({ roadX: 100, screenY: 300, oncomingLanes: 2 });
    expect(nodes[0].kind).toBe('road-situation');
    expect(nodes[1].kind).toBe('road-actor');
  });
});

describe('what the crash scenario claims', () => {
  it('claims nothing the road does not put there', () => {
    // Each noun in the description has to be something declared. The van and
    // the water come from the backdrop, the car from the actor, the people from
    // the event's own `pedestrians`.
    const words = crash.description.toLowerCase();
    expect(words).toContain('van');
    expect(words).toContain('creek');
    expect(words).toContain('car');
    expect(crash.pedestrians?.length, 'people are described but none are declared').toBeGreaterThan(
      0
    );
  });
});
