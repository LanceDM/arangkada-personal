/**
 * The road shows no more of the answer than `scenarioSupport` does.
 *
 * The briefing, the road prompt and the lane strip have asked
 * `scenarioSupport(event, h)` since support levels were added, but the road was composed without
 * h, so it marked the graded lane at every level: a gantry lit over it, a turn
 * drawn starting from it, the pavement arrow in it painted yellow, and Level
 * 7's board calling it YOUR LANE. At `none` a player could read off the road
 * what the text had been rewritten not to say.
 *
 * These hold the four markers to `showsResponse`, over every scenario in the
 * game, pooled and borrowed variants included, and hold that nothing solid
 * moves with h: support decides what is drawn, never what can be hit.
 */
import { describe, expect, it } from 'vitest';
import type { SupportLevel } from '@/domain/learner/competency';
import { LEVELS, getPooledSlots } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { scenarioSupport } from '@/features/driving-sim/domain/scenario/scenarioSupport';
import { composeWorldFrame } from '@/features/driving-sim/domain/world/composeWorldFrame';
import { laneEdges, resolveLaneRole, roadXAt } from '@/features/driving-sim/domain/world/vehiclePhysics';
import type { SceneNode } from './SceneNode';

const LEVELS_ALL: SupportLevel[] = ['full', 'cue', 'none'];

/** Frozen clock, so the scenes with moving parts compare equal to themselves. */
const FROZEN_NOW = 1_700_000_000_000;

/** Every event in the game, Level 12's borrowed pools included, on the level that plays it. */
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
    for (const slot of getPooledSlots(level.id)?.slots ?? []) {
      for (const variant of slot) take({ ...variant, triggerAtDistance: 0 } as ScenarioEvent);
    }
  }
  return rows;
};

const TRIGGER = 1200;

/**
 * One event alone on its level's carriageway, over its approach and as it is
 * reached, answered and not. The route is left off so its own gantry, which
 * `the route's lane gantry` below takes on its own, cannot be counted here.
 */
const framesOf = (level: LevelConfig, event: ScenarioEvent, support: SupportLevel) => {
  const probe: LevelConfig = { ...level, route: undefined, events: [{ ...event, triggerAtDistance: TRIGGER }] };
  return [[] as number[], [TRIGGER]].flatMap(handled =>
    [-600, -400, -180, 0].map(offset =>
      composeWorldFrame(
        { level: probe, distance: TRIGGER + offset, handled: new Set(handled), curves: [], support },
        { playerLane: 2, now: () => FROZEN_NOW }
      )
    )
  );
};

type Marker =
  | { kind: 'gantry'; lane: number }
  | { kind: 'turn-path'; lane: number }
  | { kind: 'arrow'; x: number }
  | { kind: 'your-lane'; lane: number };

/** The road's markers of a graded lane, in one frame's nodes. */
const markersIn = (nodes: SceneNode[]): Marker[] =>
  nodes.flatMap((node): Marker[] => {
    if (node.kind === 'road-marking' && node.marking.mark === 'turn-lane') {
      return [{ kind: 'gantry', lane: node.marking.lane }];
    }
    if (node.kind === 'junction' && node.shape.turnPath) {
      return [{ kind: 'turn-path', lane: node.shape.turnPath.lane }];
    }
    if (node.kind === 'road-marking' && node.marking.mark === 'lane-arrow' && node.marking.color === '#facc15') {
      return [{ kind: 'arrow', x: node.marking.x }];
    }
    if (node.kind === 'overhead-gantry') {
      return node.panels.filter(panel => panel.tone === 'target').map(panel => ({ kind: 'your-lane', lane: panel.lane }));
    }
    return [];
  });

const markersOf = (level: LevelConfig, event: ScenarioEvent, support: SupportLevel) =>
  framesOf(level, event, support).flatMap(frame => markersIn(frame.nodes));

const gradedLane = (level: LevelConfig, event: ScenarioEvent) =>
  resolveLaneRole((event.maneuver ?? event.requiredLane)!.lane, level.paint?.oncomingLanes ?? 0);

describe('the road marks a graded lane only where the support level shows the response', () => {
  it('marks none at cue or none, on any scenario in the game', () => {
    const marked = everyEvent().flatMap(({ level, event }) =>
      (['cue', 'none'] as const)
        .filter(support => markersOf(level, event, support).length > 0)
        .map(support => `level ${level.id} ${event.id} at ${support}`)
    );

    expect(marked).toEqual([]);
  });

  it('marks exactly what it did at full, over the lane the scenario grades', () => {
    const marked = new Set<string>();
    const wrong: string[] = [];
    for (const { level, event } of everyEvent()) {
      const markers = markersOf(level, event, 'full');
      if (markers.length === 0) continue;
      // Asked of the same function the briefing asks, rather than of h.
      expect(scenarioSupport(event, 'full').showsResponse).toBe(true);
      marked.add(event.id);
      const lane = gradedLane(level, event);
      // The probe road is straight, so every frame's carriageway starts where
      // the road does at any distance.
      const edges = laneEdges(roadXAt(TRIGGER, []));
      for (const marker of markers) {
        const at =
          marker.kind === 'arrow'
            ? edges.findIndex((edge, i) => i < edges.length - 1 && marker.x >= edge && marker.x < edges[i + 1])
            : marker.lane;
        if (at !== lane) wrong.push(`${event.id}: ${marker.kind} over lane ${at}, graded ${lane}`);
      }
    }

    expect(wrong).toEqual([]);
    // The scenarios the play-test found marked: twelve signed and
    // bend scenes of Level 3 (five of them borrowed by Level 12), Level 4's
    // chevron and pavement arrows, and Level 6's two turns.
    expect([...marked].sort()).toEqual([
      'level3.bend-warning.chevron-markers',
      'level3.bend-warning.double-curve',
      'level3.bend-warning.hairpin-bend',
      'level3.bend-warning.sharp-turn',
      'level3.bend-warning.winding-road',
      'level3.lane-guidance.advance-direction',
      'level3.lane-guidance.hospital-service',
      'level3.lane-guidance.interchange-lane',
      'level3.lane-guidance.stay-right-unless-passing',
      'level3.priority-yield.left-turner-give-way',
      'level3.priority-yield.t-junction',
      'level3.route-restriction.turn-if-clear',
      'level4.lane-change.chevron',
      'level4.lane-change.pavement-arrows',
      'level6.left-turn-centre-lane',
      'level6.right-turn-curb-lane',
    ]);
  });

  it('leaves every solid where it was, at every support level', () => {
    const moved = everyEvent()
      .filter(({ level, event }) => {
        const [full, ...rest] = LEVELS_ALL.map(support =>
          JSON.stringify(framesOf(level, event, support).map(frame => frame.colliders))
        );
        return rest.some(colliders => colliders !== full);
      })
      .map(({ level, event }) => `level ${level.id} ${event.id}`);

    expect(moved).toEqual([]);
  });
});

describe("the route's lane gantry", () => {
  const level7 = LEVELS.find(level => level.id === 7)!;

  /** Every frame of Level 7 the lane gantry is on screen, at one support level. */
  const gantries = (support: SupportLevel) => {
    const frames: Array<Extract<SceneNode, { kind: 'overhead-gantry' }>> = [];
    for (let distance = 0; distance < level7.roadLength; distance += 50) {
      const { nodes } = composeWorldFrame(
        { level: level7, distance, handled: new Set(), curves: [], support },
        { playerLane: 2, now: () => FROZEN_NOW }
      );
      for (const node of nodes) {
        if (node.kind === 'overhead-gantry' && node.panels.length === 4) frames.push(node);
      }
    }
    return frames;
  };

  it('calls the lane this car is graded on YOUR LANE at full, and nowhere below it', () => {
    expect(gantries('full').length).toBeGreaterThan(0);
    expect(gantries('full').every(gantry => gantry.panels.some(panel => panel.badge === 'YOUR LANE'))).toBe(true);

    for (const support of ['cue', 'none'] as const) {
      const shown = gantries(support);
      expect(shown.length).toBe(gantries('full').length);
      for (const gantry of shown) {
        expect(gantry.panels.some(panel => panel.tone === 'target' || panel.badge === 'YOUR LANE')).toBe(false);
        // The table itself is still there, Lane 1's restriction included: that
        // is what the board says, not what the scenario asks.
        expect(gantry.panels.map(panel => panel.top)).toEqual(['LANE 1', 'LANE 2', 'LANE 3', 'LANE 4']);
        expect(gantry.panels[0]).toMatchObject({ tone: 'restricted', badge: 'ONLY' });
        expect(gantry.panels[1]).toMatchObject({ tone: 'lane' });
      }
    }
  });

  it('leaves every solid on the route where it was, at every support level', () => {
    for (let distance = 0; distance < level7.roadLength; distance += 250) {
      const [full, ...rest] = LEVELS_ALL.map(support =>
        JSON.stringify(
          composeWorldFrame(
            { level: level7, distance, handled: new Set(), curves: [], support },
            { playerLane: 2, now: () => FROZEN_NOW }
          ).colliders
        )
      );
      for (const colliders of rest) expect(colliders).toBe(full);
    }
  });
});
