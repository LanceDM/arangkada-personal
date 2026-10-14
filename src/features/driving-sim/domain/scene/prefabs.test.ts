/**
 * The scene model's structural promises.
 *
 * Not what the game looks like — the render and collision goldens pin that —
 * but the rules the model is supposed to make true: one junction shared by
 * every level that has one, configuration that changes only what it names, a
 * collider for every solid thing that comes from the node drawing it, and one
 * resolution of a scene per event per frame.
 */
import { describe, expect, it, vi } from 'vitest';
import { collisionSamples, FROZEN_NOW } from '@/features/driving-sim/domain/world/collisionSamples';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { placeVisibleEvents } from '@/features/driving-sim/domain/world/eventPlacement';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from './SceneNode';
import { junctionNode } from './prefabs';
import { resolveScene } from './ResolvedScene';

vi.mock('./ResolvedScene', async importOriginal => {
  const actual = await importOriginal<typeof import('./ResolvedScene')>();
  return { ...actual, resolveScene: vi.fn(actual.resolveScene) };
});

/** Every frame the collision golden covers: every level, every event, cleared and not. */
const everyFrame = () =>
  collisionSamples().map(sample => ({
    levelId: sample.levelId,
    frame: composeWorldFrame(
      {
        level: sample.level,
        distance: sample.distance,
        handled: new Set(sample.handled),
        curves: curvesForLevel(sample.level),
      },
      { playerLane: sample.playerLane, now: () => FROZEN_NOW }
    ),
  }));

const junctionsByLevel = () => {
  const byConfiguration = new Map<string, Set<number>>();
  for (const { levelId, frame } of everyFrame()) {
    for (const node of frame.nodes) {
      if (node.kind !== 'junction') continue;
      const { side, control, crossTraffic, crosswalk } = node.shape;
      const key = `side=${side ?? '-'} control=${control} cross=${crossTraffic} walk=${crosswalk}`;
      if (!byConfiguration.has(key)) byConfiguration.set(key, new Set());
      byConfiguration.get(key)!.add(levelId);
    }
  }
  return byConfiguration;
};

describe('the junction prefab', () => {
  it('is what every level with a junction places', () => {
    const configurations = junctionsByLevel();
    const levels = new Set([...configurations.values()].flatMap(set => [...set]));

    // Six levels build a junction. None of them implements one.
    expect(levels.size).toBeGreaterThanOrEqual(2);
    expect(configurations.size).toBeGreaterThan(1);
  });

  it('is shared between levels, not copied per level', () => {
    // The point of a prefab: at least one configuration is placed by more than
    // one level, so a change to the junction reaches both.
    const shared = [...junctionsByLevel().entries()].filter(([, levels]) => levels.size > 1);

    expect(shared.length).toBeGreaterThan(0);
  });

  it('changes only the property it is configured with', () => {
    const at = { roadX: 100, screenY: 300 };
    const plain = junctionNode(at) as Extract<SceneNode, { kind: 'junction' }>;
    const controlled = junctionNode({ ...at, control: 'give-way' }) as typeof plain;

    const differing = (Object.keys(controlled.shape) as Array<keyof typeof controlled.shape>).filter(
      key => plain.shape[key] !== controlled.shape[key]
    );

    expect(differing).toEqual(['control']);
    expect(plain.shape.control).toBe('none');
    expect(controlled.shape.control).toBe('give-way');
  });
});

describe('a frame', () => {
  it('gives every solid a node it belongs to', () => {
    const orphaned = everyFrame().filter(({ frame }) => {
      const fromNodes = frame.nodes.flatMap(node => node.solids ?? []);
      return JSON.stringify(fromNodes) !== JSON.stringify(frame.colliders);
    });

    // Not "the counts agree" — the same bodies, in the same painter order,
    // because `firstCarCollision` reports the first body it overlaps.
    expect(orphaned).toHaveLength(0);
  });

  it('lets a scripted vehicle carry its own body', () => {
    // The last collider that was produced outside the scene model. If it goes
    // back to being appended by the frame composer, no node here owns one.
    const solidVehicles = everyFrame().flatMap(({ frame }) =>
      frame.nodes.filter(node => node.kind === 'scripted-vehicle' && (node.solids?.length ?? 0) > 0)
    );

    expect(solidVehicles.length).toBeGreaterThan(0);
  });

  it('resolves each event scene exactly once', () => {
    /** Mirrors the guard order in `eventSceneNodes`: these never reach the resolver. */
    const ownsItsScene = (event: ScenarioEvent) =>
      Boolean(event.inspection) ||
      Boolean(event.marking) ||
      Boolean(event.sign && event.scene) ||
      Boolean(event.emergency) ||
      event.effect?.visibility !== undefined;

    const unresolved: string[] = [];
    const resolvedTwice: string[] = [];

    for (const sample of collisionSamples()) {
      const view = {
        level: sample.level,
        distance: sample.distance,
        handled: new Set(sample.handled),
        curves: curvesForLevel(sample.level),
      };
      const expected = placeVisibleEvents(view)
        .map(placement => placement.event)
        .filter(event => !ownsItsScene(event))
        .map(event => event.id);

      vi.mocked(resolveScene).mockClear();
      composeWorldFrame(view, { playerLane: sample.playerLane, now: () => FROZEN_NOW });
      const resolved = vi.mocked(resolveScene).mock.calls.map(call => call[0].id);

      // Counted against what the frame should have resolved, not against a
      // second run of the same code: it used to be resolved twice per event -
      // once by the frame composer to place the scripted vehicle, once by the
      // scene builder to build the nodes - and comparing two runs would have
      // reported both as agreeing.
      if (resolved.length !== new Set(resolved).size) resolvedTwice.push(...resolved);
      if (JSON.stringify(resolved) !== JSON.stringify(expected)) unresolved.push(...expected);
    }

    expect(resolvedTwice).toEqual([]);
    expect(unresolved).toEqual([]);
  });
});
