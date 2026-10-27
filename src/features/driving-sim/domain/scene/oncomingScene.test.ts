/**
 * What a vehicle coming the other way puts on the road.
 *
 * The answer is: itself, and nothing else. The generic `npc-oncoming` scene
 * used to paint a left-turn arrow on the carriageway under every ordinary
 * oncoming vehicle — copied from `oncoming-left-turn`, where an arrow is the
 * point, into a scene where nothing turns. It surfaced under the bus on Level
 * 8's blind bend and under the car behind Level 6's double yellow line, in both
 * cases telling the driver about a manoeuvre no scenario had declared.
 *
 * The arrow is a marking, so it carries no body: removing it must move the
 * picture and leave the collision geometry exactly as it was. That is asserted
 * here rather than left to the goldens, which would only say *something*
 * changed.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { SceneNode } from './SceneNode';

const FROZEN_NOW = 1_700_000_000_000;

/** Every node on the board with the player `ahead` units short of an event. */
const sceneAt = (level: LevelConfig, event: ScenarioEvent, ahead: number): SceneNode[] =>
  composeWorldFrame(
    {
      level,
      distance: event.triggerAtDistance - ahead,
      handled: new Set<number>(),
      curves: curvesForLevel(level),
    },
    { playerLane: 2, traffic: new Map(), now: () => FROZEN_NOW }
  ).nodes;

const arrows = (nodes: SceneNode[]) =>
  nodes.filter(
    node => node.kind === 'road-marking' && node.marking.mark === 'lane-arrow'
  );

/** The two scenarios in the game whose traffic simply comes the other way. */
const ORDINARY_ONCOMING = LEVELS.flatMap(level =>
  level.events
    .filter(event => event.npc?.path === 'oncoming_through')
    .map(event => ({ level, event }))
);

describe('a vehicle coming the other way', () => {
  it('is something the roster actually contains, so these assertions bite', () => {
    expect(ORDINARY_ONCOMING.map(({ event }) => event.id).sort()).toEqual([
      'level6.no-overtake-double-yellow',
      'level8.blind-bend',
    ]);
  });

  it('paints no lane arrow, at any point of its approach', () => {
    // Across the window rather than at one distance: an arrow drawn only while
    // the vehicle is at a particular row would pass a single-point check.
    const painted: string[] = [];
    for (const { level, event } of ORDINARY_ONCOMING) {
      for (const ahead of [400, 300, 200, 120, 60, 0, -40]) {
        for (const node of arrows(sceneAt(level, event, ahead))) {
          const marking = node.kind === 'road-marking' ? node.marking : null;
          painted.push(
            `${event.id} at ${ahead}: ${marking && 'direction' in marking ? marking.direction : '?'}`
          );
        }
      }
    }
    expect(painted).toEqual([]);
  });

  it('still puts the declared vehicle on the road', () => {
    // The other half of the fix: the arrow went, the bus did not.
    for (const { level, event } of ORDINARY_ONCOMING) {
      const drawn = sceneAt(level, event, 120).filter(
        node => node.kind === 'scripted-vehicle' && node.npc === event.npc
      );
      expect(drawn.length, `${event.id} lost its oncoming vehicle`).toBe(1);
    }
  });

  it('keeps the line each of these scenarios is actually about', () => {
    // Both of them turn on a solid centre line — Level 6's scenario *is* the
    // double yellow, and Level 8's bend grades the lane it divides. The line is
    // declared on the level's own paint rather than composed as a node, so that
    // is where it is asserted: removing an arrow nobody declared must not take
    // the marking that was declared with it.
    for (const { level, event } of ORDINARY_ONCOMING) {
      const solid = (level.paint?.spans ?? []).filter(span => span.art === 'double_solid_yellow');
      const covering = solid.find(
        span => span.from <= event.triggerAtDistance && span.to >= event.triggerAtDistance
      );
      expect(covering, `${event.id} lost its solid centre line`).toBeDefined();
    }
  });

  it('leaves the collision geometry untouched', () => {
    // An arrow is paint. Everything solid on these roads is solid because a
    // vehicle or a fixture declared it, and this is the assertion that says the
    // change was to the picture alone.
    for (const { level, event } of ORDINARY_ONCOMING) {
      for (const ahead of [300, 120, 60, 0]) {
        const nodes = sceneAt(level, event, ahead);
        const bodies = nodes.flatMap(node => node.solids ?? []);
        // Nothing solid came from a marking, at any point of the approach.
        const fromMarkings = nodes
          .filter(node => node.kind === 'road-marking')
          .flatMap(node => node.solids ?? []);
        expect(fromMarkings, `${event.id} at ${ahead}`).toEqual([]);
        // And wherever the vehicle is on the road, its own body still is.
        const onRoad = nodes.some(node => node.kind === 'scripted-vehicle' && node.npc === event.npc);
        if (onRoad) {
          expect(bodies.some(body => body.kind === 'vehicle'), `${event.id} at ${ahead}`).toBe(true);
        }
      }
    }
  });
});

describe('a scenario that genuinely is about a turn across you', () => {
  it('keeps its arrow', () => {
    // The scene the generic one borrowed from. Authored deliberately here
    // because no level currently declares it — which is exactly why it needed
    // protecting: an unused branch is the easiest thing to delete by accident
    // while removing its copy.
    const { level, event } = ORDINARY_ONCOMING.find(
      entry => entry.event.id === 'level8.blind-bend'
    )!;
    const turning = {
      ...event,
      npc: undefined,
      scenePrefab: { kind: 'oncoming_left_turn' },
    } as unknown as ScenarioEvent;
    const staged: LevelConfig = {
      ...level,
      events: level.events.map(other => (other.id === event.id ? turning : other)),
    };
    const drawn = arrows(sceneAt(staged, turning, 60));
    expect(drawn.length, 'the declared left turn lost its arrow').toBe(1);
    const marking = drawn[0].kind === 'road-marking' ? drawn[0].marking : null;
    expect(marking && 'direction' in marking ? marking.direction : null).toBe('left');
  });
});
