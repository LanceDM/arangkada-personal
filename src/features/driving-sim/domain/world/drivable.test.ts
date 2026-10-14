/**
 * A road you can get down, and obstacles you can actually hit.
 *
 * Each of these records a bug that shipped: a work-zone barrier made solid and
 * then narrowed past until the car was funnelled safely by it, and a bend that
 * swung the road faster than the wheel could answer.
 *
 * A barrier the car can never reach has exactly the consequence of one it
 * drives through: none.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { createLevel3 } from '@/features/driving-sim/domain/scenario/content/levels/level3/level3';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CAR_HEIGHT,
  CAR_WIDTH,
  LANE_WIDTH,
  ROAD_EFFECT_SPAN,
  ROAD_WIDTH,
  laneBounds,
  laneCentreX,
  moveLeft,
  moveRight,
  resolveLaneRole,
  roadXAt,
  type LaneIndex,
} from './vehiclePhysics';
import { curvesForLevel } from './roadCurves';
import { composeWorldFrame } from './composeWorldFrame';
import type { WorldBody } from './WorldBody';

/** Where the player's car sits on screen, which is the row an obstacle must occupy. */
const CAR_Y = CANVAS_HEIGHT - 120;

const FROZEN_NOW = 1_700_000_000_000;

/** Fixed levels, plus enough Level 3 rolls to see most of its pool. */
const rosters = (rolls: number): LevelConfig[] => [
  ...LEVELS.filter(level => level.id !== 3),
  ...Array.from({ length: rolls }, () => createLevel3()),
];

/** The surface effect in force at this point of the route, if any. */
const surfaceAt = (level: LevelConfig, distance: number) =>
  level.events.find(
    event =>
      event.effect && Math.abs(distance - event.triggerAtDistance) <= (event.effect.span ?? ROAD_EFFECT_SPAN)
  )?.effect;

/** Everything solid on the car's own row, at one point of one level's route. */
const solidsOnTheCarsRow = (level: LevelConfig, distance: number, curves: ReturnType<typeof curvesForLevel>) =>
  composeWorldFrame(
    { level, distance, handled: new Set<number>(), curves },
    { playerLane: 2, now: () => FROZEN_NOW }
  ).colliders.filter(body => CAR_Y - CAR_HEIGHT / 2 < body.y + body.height && CAR_Y + CAR_HEIGHT / 2 > body.y);

const overlaps = (x: number, body: WorldBody) =>
  x - CAR_WIDTH / 2 < body.x + body.width && x + CAR_WIDTH / 2 > body.x;

/** Whether some drivable x on this row touches `body`. */
const reachable = (body: WorldBody, bounds: { min: number; max: number }) => {
  for (let x = bounds.min; x <= bounds.max; x += 1) if (overlaps(x, body)) return true;
  return false;
};

describe('every route', () => {
  it('leaves a way through, and leaves every obstacle reachable', () => {
    const blocked: string[] = [];
    const unreachable = new Set<string>();

    for (const level of rosters(12)) {
      const curves = curvesForLevel(level);
      for (const event of level.events) {
        for (let d = event.triggerAtDistance - 230; d <= event.triggerAtDistance + 60; d += 4) {
          if (d < 0) continue;
          const bodies = solidsOnTheCarsRow(level, d, curves);
          if (bodies.length === 0) continue;

          const surface = surfaceAt(level, d);
          const bounds = laneBounds(roadXAt(d, curves), surface?.narrowsTo ?? 1, surface?.openSide ?? 'centre');

          let anyClear = false;
          for (let x = bounds.min; x <= bounds.max && !anyClear; x += 1) {
            if (!bodies.some(body => overlaps(x, body))) anyClear = true;
          }
          if (!anyClear) blocked.push(`L${level.id} @${d}: no way through`);

          for (const body of bodies) {
            // Crossing traffic sweeps the width over time, which a single
            // frame cannot see, so it is exempt from the reachability rule.
            if (/crossing on the main road/.test(body.label)) continue;
            // A taper's job is to funnel you away from the closure, so a cone
            // alongside a car that has already been funnelled is out of reach
            // by design. The barrier at the end of it is not — see below.
            if (/traffic cone/.test(body.label)) continue;
            if (!reachable(body, bounds)) unreachable.add(`L${level.id} ${body.label}`);
          }
        }
      }
    }

    expect(blocked).toEqual([]);
    expect([...unreachable]).toEqual([]);
  });

  it('leaves the lane a sign sends you to clear of everything the scene puts down', () => {
    // The work zone's own answer is a lane: `requiredLane: 'inner'` sends the
    // driver to the lane beside the centre line and closes the curb lane. The
    // taper used to reach 17px past the closure's own edge, which put a cone
    // over the middle of that lane — so holding the lane the sign asked for
    // ended the run, and the only clear line left was the oncoming half.
    const blocked: string[] = [];

    for (const level of rosters(25)) {
      const curves = curvesForLevel(level);
      const oncoming = level.paint?.oncomingLanes ?? 0;
      for (const event of level.events) {
        const requirement = event.requiredLane;
        if (!requirement) continue;
        const lane = resolveLaneRole(requirement.lane, oncoming);

        for (let d = event.triggerAtDistance - 230; d <= event.triggerAtDistance + 60; d += 3) {
          if (d < 0) continue;
          const roadX = roadXAt(d, curves);
          const x = laneCentreX(lane, roadX);
          // Only where the car can actually sit: a narrowing that has closed
          // the required lane's centre is a separate (and legitimate) squeeze,
          // already covered by the way-through check above.
          const surface = surfaceAt(level, d);
          const bounds = laneBounds(roadX, surface?.narrowsTo ?? 1, surface?.openSide ?? 'centre');
          if (x < bounds.min || x > bounds.max) continue;

          for (const body of solidsOnTheCarsRow(level, d, curves)) {
            // A scripted vehicle is somebody else on the road, and meeting one
            // in your lane is the event; this is about the scenery the scene
            // itself lays down.
            if (body.kind === 'vehicle' || body.kind === 'pedestrian') continue;
            if (overlaps(x, body)) blocked.push(`${event.id} @${d}: ${body.label} in the required lane`);
          }
        }
      }
    }

    expect([...new Set(blocked)]).toEqual([]);
  });

  it('keeps a work-zone barrier something the car can still hit', () => {
    // The specific case the general rule above was written for, kept separate
    // so a roster that stops rolling roadwork fails loudly rather than quietly
    // checking nothing.
    let seen = 0;
    let reachableCount = 0;

    for (const level of rosters(25)) {
      const curves = curvesForLevel(level);
      for (const event of level.events) {
        for (let d = event.triggerAtDistance - 200; d <= event.triggerAtDistance + 60; d += 3) {
          if (d < 0) continue;
          const surface = surfaceAt(level, d);
          const bounds = laneBounds(roadXAt(d, curves), surface?.narrowsTo ?? 1, surface?.openSide ?? 'centre');
          for (const body of solidsOnTheCarsRow(level, d, curves)) {
            if (!/closure barrier/.test(body.label)) continue;
            seen += 1;
            if (reachable(body, bounds)) reachableCount += 1;
          }
        }
      }
    }

    expect(seen).toBeGreaterThan(0);
    expect(reachableCount).toBeGreaterThan(0);
  });
});

describe('every bend', () => {
  it('is one a lane-holding driver can actually hold', () => {
    const failures: string[] = [];
    let checked = 0;
    const seen = new Set<string>();

    for (const level of rosters(30)) {
      const curves = curvesForLevel(level);
      if (curves.length === 0) continue;
      const oncoming = level.paint?.oncomingLanes ?? 0;
      // Distance covered per frame at the fastest the car may legally go.
      const perFrame = level.speedLimit * 0.05;

      for (const event of level.events) {
        if (!event.effect?.curve) continue;
        const label = `L${level.id} ${event.sign?.name ?? event.scene ?? event.id}`;
        if (seen.has(label)) continue;
        seen.add(label);
        checked += 1;

        // The bend's real reach, read off the road rather than recomputed, so
        // this cannot drift from what is actually drawn.
        const span = curves.find(curve => curve.at === event.triggerAtDistance)?.span;
        if (span === undefined) continue;

        const lane: LaneIndex = event.requiredLane
          ? resolveLaneRole(event.requiredLane.lane, oncoming)
          : resolveLaneRole('middle', oncoming);

        const from = event.triggerAtDistance - span - 60;
        let x = laneCentreX(lane, roadXAt(from, curves));
        let worstDrift = 0;
        let pushedFrames = 0;
        let offScreen = 0;

        for (let d = from; d <= event.triggerAtDistance + span + 60; d += perFrame) {
          const roadX = roadXAt(d, curves);
          // The road has to stay on the canvas, sidewalks and all.
          offScreen = Math.max(offScreen, -(roadX - 25), roadX + ROAD_WIDTH + 25 - CANVAS_WIDTH);

          // A model driver steers for the middle of the lane the sign asked
          // for, at the rate the car actually steers.
          const target = laneCentreX(lane, roadX);
          x = target > x ? moveRight(x, roadX) : moveLeft(x, roadX);
          if (Math.abs(target - x) < 2.5) x = target;
          worstDrift = Math.max(worstDrift, Math.abs(x - target));

          const bounds = laneBounds(roadX);
          if (x < bounds.min - 0.001 || x > bounds.max + 0.001) pushedFrames += 1;
        }

        if (pushedFrames > 0) {
          failures.push(`${label}: carried a lane-holding driver off the road on ${pushedFrames} frame(s)`);
        }
        if (worstDrift > LANE_WIDTH / 2) {
          failures.push(`${label}: road swings ${worstDrift.toFixed(0)}px ahead of the wheel`);
        }
        if (offScreen > 0) {
          failures.push(`${label}: the road leaves the canvas by ${offScreen.toFixed(0)}px`);
        }
      }
    }

    expect(failures).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });
});

describe('a narrowing', () => {
  it('never claims a jolt without a rough surface drawn to justify it', () => {
    // A jolt with nothing on screen to explain it reads as hitting something
    // invisible. Only the two scenes that draw a rough surface may cause one.
    // The scenes that paint a surface a jolt can be attributed to: a hump and
    // broken tarmac you can see, standing water you can see being thrown, and
    // the polished sheen a skid happens on.
    const JOLTING_SCENES = ['hump', 'uneven', 'flood', 'wet'];
    const everyEvent: ScenarioEvent[] = rosters(30).flatMap(level => level.events);

    const unexplained = everyEvent
      .filter(event => event.effect?.jarringAbove !== undefined)
      .filter(event => !JOLTING_SCENES.includes(event.scene ?? ''))
      .map(event => `${event.id} (${event.scene ?? 'no scene'}): jolts with no rough surface on screen`);

    expect([...new Set(unexplained)]).toEqual([]);
  });
});
