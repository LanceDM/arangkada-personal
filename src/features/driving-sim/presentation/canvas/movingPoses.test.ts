/**
 * The moving parts of a scene are posed once, by the world.
 *
 * Two scenes have parts that move on a clock rather than on the player's
 * distance: the wave of traffic crossing a main road, and the pedestrian
 * walking a signalised crossing. Each was computed twice — once by the scene
 * composition to build the collider, and again by the renderer to draw the
 * sprite, each from its own `Date.now()`.
 *
 * Neither golden could see it. Both stub `Date.now` to one frozen instant for
 * the whole run, which is exactly the condition under which two reads of a
 * clock agree — so the duplication was invisible in the only place the two
 * halves are compared.
 *
 * These tests do the opposite. The world is given one clock and the ambient
 * environment another, far enough apart that the wave has passed and the walker
 * has crossed half the road. A renderer that reads the ambient clock then
 * paints somewhere the collider is not, and says so.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, getRerollableSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { curvesForLevel } from '@/features/driving-sim/domain/world/roadCurves';
import { roadAtFor } from '@/features/driving-sim/domain/world/eventPlacement';
import {
  MAIN_ROAD_CYCLE_MS,
  SIGNAL_CROSSING_WALK_MS,
} from '@/features/driving-sim/domain/world/sceneGeometry';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { WorldBody } from '@/features/driving-sim/domain/world/WorldBody';
import { recordingCanvasContext } from './rendering/recordingCanvas';
import { renderScene } from './rendering/renderScene';

/** The centre a `bodyAt` body was built around — the sprite's own origin. */
const centreOf = (body: WorldBody): [number, number] => [
  body.x + body.width / 2,
  body.y + body.height / 2,
];

/**
 * The instant the world is told it is. Chosen inside the traffic half of the
 * main road's cycle, so there is a wave to compare against a gap.
 */
const SCENE_NOW = 1_700_000_000_000;

/**
 * What the ambient `Date.now()` says instead. Half a cycle away for each scene:
 * the main road's wave has passed and the walker is across the carriageway, so
 * a renderer reading this clock is not off by a pixel — it draws a different
 * scene entirely.
 */
const AMBIENT_NOW = SCENE_NOW + MAIN_ROAD_CYCLE_MS / 2 + SIGNAL_CROSSING_WALK_MS / 2;

/** Composes the frame around one event, with the world on its own clock. */
const frameFor = (level: LevelConfig, event: ScenarioEvent, { cleared }: { cleared: boolean }) => {
  const trigger = 1200;
  const probe: LevelConfig = { ...level, events: [{ ...event, triggerAtDistance: trigger }] };
  const curves = curvesForLevel(probe);
  const distance = trigger - 120;
  const frame = composeWorldFrame(
    { level: probe, distance, handled: new Set(cleared ? [trigger] : []), curves },
    { playerLane: 2, now: () => SCENE_NOW }
  );
  return { frame, roadAt: roadAtFor(distance, curves) };
};

/** Every event in the game, pooled variants included, so these run on real content. */
const everyEvent = (): Array<{ level: LevelConfig; event: ScenarioEvent }> => {
  const rows: Array<{ level: LevelConfig; event: ScenarioEvent }> = [];
  for (const level of LEVELS) {
    for (const event of level.events) rows.push({ level, event });
    const pools = getRerollableSlots(level.id);
    if (!pools) continue;
    for (const slot of pools.slots) {
      for (const variant of slot) rows.push({ level, event: variant as ScenarioEvent });
    }
  }
  return rows;
};

type MainRoadJunction = Extract<SceneNode, { kind: 'main-road-junction' }>;
type SignalisedCrossing = Extract<SceneNode, { kind: 'crossing'; style: 'signalized' }>;

const isMainRoadJunction = (node: SceneNode): node is MainRoadJunction =>
  node.kind === 'main-road-junction';

const isSignalisedCrossing = (node: SceneNode): node is SignalisedCrossing =>
  node.kind === 'crossing' && node.style === 'signalized';

/** The first real scenario whose composed scene contains the node wanted. */
const sceneWith = <T extends SceneNode>(
  wanted: (node: SceneNode) => node is T,
  cleared: boolean,
  what: string
): { node: T; roadAt: (y: number) => number } => {
  for (const { level, event } of everyEvent()) {
    const { frame, roadAt } = frameFor(level, event, { cleared });
    const node = frame.nodes.find(wanted);
    if (node) return { node, roadAt };
  }
  throw new Error(`no scenario in the game composes ${what}`);
};

/** Runs `body` with the ambient `Date.now()` pinned to `ambient`. */
const withAmbientClock = <T>(ambient: number, body: () => T): T => {
  const realNow = Date.now;
  Date.now = () => ambient;
  try {
    return body();
  } finally {
    Date.now = realNow;
  }
};

/** Paints `nodes` with the ambient clock pinned, and reports the op stream. */
const paint = (nodes: readonly SceneNode[], roadAt: (y: number) => number, ambient: number) =>
  withAmbientClock(ambient, () => {
    const { ctx, recording } = recordingCanvasContext();
    renderScene(ctx, nodes, roadAt);
    return recording().ops;
  });

/** `x,y` of every op of the form `name(x,y,…)`, for the ops that place a sprite. */
const positionsOf = (ops: readonly string[], name: string, rest: string): Array<[number, number]> =>
  ops
    .filter(op => op.startsWith(`${name}(`) && op.includes(rest))
    .map(op => {
      const [x, y] = op.slice(name.length + 1, -1).split(',').map(Number);
      return [x, y] as [number, number];
    });

/** Where `drawPedestrian` put its figure: the translate before its skin fill. */
/**
 * Where each pedestrian sprite was placed, read off the transform it was drawn
 * under rather than off the op that happens to follow it.
 *
 * The skin fill is what identifies a person; how many strokes the sprite lays
 * down before reaching it is not something this test has an opinion about.
 */
const SKIN = 'fillStyle=#deb887';
const pedestrianOrigins = (ops: readonly string[]): Array<[number, number]> => {
  const origins: Array<[number, number]> = [];
  ops.forEach((op, index) => {
    if (!op.startsWith('translate(')) return;
    const nextTranslate = ops.findIndex((later, at) => at > index && later.startsWith('translate('));
    const end = nextTranslate === -1 ? ops.length : nextTranslate;
    if (!ops.slice(index + 1, end).includes(SKIN)) return;
    const [x, y] = op.slice('translate('.length, -1).split(',').map(Number);
    origins.push([x, y]);
  });
  return origins;
};

const round = ([x, y]: [number, number]): [number, number] => [
  Math.round(x * 1000) / 1000,
  Math.round(y * 1000) / 1000,
];

const mainRoad = (cleared: boolean) =>
  sceneWith(isMainRoadJunction, cleared, 'a main-road junction');

const signalised = (cleared: boolean) =>
  sceneWith(isSignalisedCrossing, cleared, 'a signalised crossing');

describe('the wave crossing a main road', () => {
  it('draws the vehicles it made solid, not the ones the ambient clock would have', () => {
    const { node, roadAt } = mainRoad(false);
    expect(node.traffic.clear).toBe(false);
    expect(node.traffic.cars).toHaveLength(2);

    // The shadow under each crossing car is drawn at its own position.
    const drawn = positionsOf(paint([node], roadAt, AMBIENT_NOW), 'ellipse', ',26,6,0,0,');

    expect(drawn.map(([x, y]) => round([x, y - 14]))).toEqual(
      node.traffic.cars.map(car => round([car.x, car.y]))
    );
    // ...and those are the same vehicles the collision pass tests.
    expect((node.solids ?? []).map(body => round(centreOf(body)))).toEqual(
      node.traffic.cars.map(car => round([car.x, car.y]))
    );
  });

  it('paints the same junction whatever the ambient clock says', () => {
    const { node, roadAt } = mainRoad(false);

    // Half a cycle apart: under a renderer that read the clock itself, one of
    // these draws two cars and the other draws an empty junction.
    expect(paint([node], roadAt, SCENE_NOW)).toEqual(paint([node], roadAt, AMBIENT_NOW));
  });

  it('takes away the vehicles and their colliders together once yielded', () => {
    const { node, roadAt } = mainRoad(true);

    expect(node.traffic.clear).toBe(true);
    expect(node.traffic.cars).toEqual([]);
    expect(node.solids ?? []).toEqual([]);

    const ops = paint([node], roadAt, AMBIENT_NOW);
    expect(positionsOf(ops, 'ellipse', ',26,6,0,0,')).toEqual([]);
    // The scene says so out loud, from the same `clear` the colliders came from.
    expect(ops.filter(op => op.startsWith('fillText(CLEAR'))).toHaveLength(1);
    expect(ops.filter(op => op.startsWith('fillText(TRAFFIC'))).toHaveLength(0);
  });
});

describe('the pedestrian on a signalised crossing', () => {
  it('draws the walker it made solid, not the one the ambient clock would have', () => {
    const { node, roadAt } = signalised(false);
    expect(node.walker).not.toBeNull();

    const drawn = pedestrianOrigins(paint([node], roadAt, AMBIENT_NOW));

    expect(drawn).toHaveLength(1);
    expect(round(drawn[0])).toEqual(round([node.walker!.x, node.walker!.y]));

    const body = (node.solids ?? [])[0];
    expect(body).toBeDefined();
    expect(round(centreOf(body))).toEqual(round([node.walker!.x, node.walker!.y]));
  });

  it('paints the same crossing whatever the ambient clock says', () => {
    const { node, roadAt } = signalised(false);

    expect(paint([node], roadAt, SCENE_NOW)).toEqual(paint([node], roadAt, AMBIENT_NOW));
  });

  it('takes away the walker and their collider together once cleared', () => {
    const { node, roadAt } = signalised(true);

    expect(node.walker).toBeNull();
    expect(node.solids ?? []).toEqual([]);
    expect(pedestrianOrigins(paint([node], roadAt, AMBIENT_NOW))).toEqual([]);
  });
});

describe('a composed frame', () => {
  it('depends on the clock it was given, not on the one in the room', () => {
    // The general form of the two cases above, over every scenario in the game.
    // Any scene that reaches for `Date.now()` instead of the frame's own clock
    // shows up here: both compositions are told the same scene time, so every
    // node must match however far apart the ambient clock says they were taken.
    const drifted: string[] = [];

    for (const { level, event } of everyEvent()) {
      for (const cleared of [false, true]) {
        const nodesAt = (ambient: number) =>
          withAmbientClock(ambient, () =>
            JSON.stringify(frameFor(level, event, { cleared }).frame.nodes)
          );
        if (nodesAt(SCENE_NOW) !== nodesAt(AMBIENT_NOW)) drifted.push(event.id);
      }
    }

    expect([...new Set(drifted)]).toEqual([]);
  });
});

describe('the renderer', () => {
  it('refuses a node kind it has no renderer for', () => {
    // `assertNever` is a compile-time check first — `tsc -b` fails on an
    // unhandled kind. This is the runtime half, so the guard cannot be
    // silently weakened to a no-op default.
    const unknown = { kind: 'not-a-scene-node' } as unknown as SceneNode;
    const { ctx } = recordingCanvasContext();

    expect(() => renderScene(ctx, [unknown], () => 0)).toThrow(/scene node/);
  });
});
