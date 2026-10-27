/**
 * The rider who filters past you.
 *
 * Every other vehicle on this road is somewhere the driver can point at: ahead,
 * behind, across, coming the other way. This one is beside the door, and it
 * gets there by travelling — from behind, level, then gone — because a pass the
 * driver is only *told* about is a pass they cannot hold their line for.
 *
 * The two things that make it a scenario rather than an obstacle are asserted
 * here: it covers the whole path on screen, and it leaves room beside a car
 * sitting properly in its lane. A rider drawn on the lane line at this road's
 * scale is already touching a centred car, which turns "hold your line" into a
 * collision the driver could do nothing about.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import {
  CAR_WIDTH,
  LANE_WIDTH,
  ROAD_CENTRE_X,
  distanceToScreenY,
  laneCentreX,
  resolveLaneRole,
} from '@/features/driving-sim/domain/world/vehiclePhysics';
import { npcHitbox, npcTransform, type NpcRoadContext } from './updateNpcVehicles';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';

const level8 = LEVELS.find(level => level.id === 8)!;
const filtering = level8.events.find(event => event.npc?.path === 'filtering_past')!;
const spec = filtering.npc!;

const ROAD: NpcRoadContext = { oncomingLanes: level8.paint?.oncomingLanes ?? 2 };
/** The player's own row, which is where the pass is measured against. */
const PLAYER_ROW = distanceToScreenY(0, 0);

/** The rider's pose with the player this far short of the scenario's point. */
const poseAt = (ahead: number, vehicle: NpcVehicleSpec = spec) =>
  npcTransform(
    vehicle,
    filtering.triggerAtDistance,
    filtering.triggerAtDistance - ahead,
    ROAD_CENTRE_X,
    PLAYER_ROW,
    false,
    ROAD
  );

/** Every pose across the approach, from first sight to the trigger. */
const wholeApproach = (step = 5) => {
  const span = spec.approachSpan ?? 340;
  const poses = [];
  for (let ahead = span; ahead >= 0; ahead -= step) poses.push(poseAt(ahead));
  return poses;
};

describe('a motorcycle filtering past', () => {
  it('travels the whole way from behind the driver to ahead of them', () => {
    // The requirement in one assertion: it is genuinely behind at some point,
    // genuinely level at some point, and genuinely gone by the end. Narrating
    // a pass that never happened on screen is the failure this rules out.
    const active = wholeApproach().filter(pose => pose.active);
    expect(active.length).toBeGreaterThan(10);
    expect(active.some(pose => pose.y > PLAYER_ROW + 40), 'never behind the car').toBe(true);
    expect(
      active.some(pose => Math.abs(pose.y - PLAYER_ROW) < 30),
      'never alongside the car'
    ).toBe(true);
    expect(active.some(pose => pose.y < PLAYER_ROW - 60), 'never gets ahead').toBe(true);
  });

  it('only ever moves up the frame', () => {
    // It is overtaking. A rider who slides backwards at any point in the
    // approach is a rider the driver watches twice.
    const rows = wholeApproach().filter(pose => pose.active).map(pose => pose.y);
    const backwards = rows.filter((y, i) => i > 0 && y > rows[i - 1] + 0.001);
    expect(backwards).toEqual([]);
  });

  it('stays on one line across the road for the whole pass', () => {
    // Its lane is the scenario. A rider that wandered while asking the driver
    // not to would make the drift they are graded on unmeasurable.
    const xs = new Set(wholeApproach().filter(pose => pose.active).map(pose => Math.round(pose.x)));
    expect(xs.size).toBe(1);
  });

  it('leaves room beside a car sitting in the middle of its lane', () => {
    // The one that was wrong. At 65-wide lanes, a 40-wide car and a 24-wide
    // rider, squarely on the lane line leaves half a pixel — so a driver doing
    // everything right was inside the rider's body for the whole pass.
    const inner = resolveLaneRole('inner', ROAD.oncomingLanes);
    const carRightEdge = laneCentreX(inner, ROAD_CENTRE_X) + CAR_WIDTH / 2;
    const alongside = wholeApproach().find(
      pose => pose.active && Math.abs(pose.y - PLAYER_ROW) < 30
    )!;
    const body = npcHitbox(spec, alongside)!;
    expect(body.x, 'the rider overlaps a correctly positioned car').toBeGreaterThan(carRightEdge);
  });

  it('leaves less room than a lane change, so moving over still reaches it', () => {
    // The other half of the same number. The clearance has to be wide enough to
    // grade a wander inside and narrow enough that a driver who changes lane
    // outright genuinely arrives at somebody.
    const inner = resolveLaneRole('inner', ROAD.oncomingLanes);
    const carRightEdge = laneCentreX(inner, ROAD_CENTRE_X) + CAR_WIDTH / 2;
    const alongside = wholeApproach().find(
      pose => pose.active && Math.abs(pose.y - PLAYER_ROW) < 30
    )!;
    const body = npcHitbox(spec, alongside)!;
    expect(body.x - carRightEdge).toBeLessThan(LANE_WIDTH);
    // And the scenario's own tolerance is inside that clearance, which is what
    // makes the verdict land before the contact rather than after it.
    expect(filtering.lineHold!.maxDrift).toBeLessThan(body.x - carRightEdge);
  });

  it('is on the road before the driver is asked to do anything about it', () => {
    // The scenario is read at the top of its window. Something that only
    // appears afterwards is a rider the briefing described and the road did not.
    const warning = filtering.warningDistance ?? 0;
    expect(poseAt(Math.min(warning, spec.approachSpan ?? 340) - 10).active).toBe(true);
  });

  it('takes the same line whichever way the road is painted', () => {
    // Reusable rather than Level 8's: the line is read off the level's own lane
    // layout, so a one-way street puts the rider inside the driver's lanes
    // rather than on a centre line that road does not have.
    const oneWay = npcTransform(
      spec,
      filtering.triggerAtDistance,
      filtering.triggerAtDistance - 100,
      ROAD_CENTRE_X,
      PLAYER_ROW,
      false,
      { oncomingLanes: 0 }
    );
    expect(oneWay.active).toBe(true);
    expect(oneWay.x).toBeGreaterThan(ROAD_CENTRE_X);
    expect(oneWay.x).toBeLessThan(ROAD_CENTRE_X + LANE_WIDTH * 4);
    // A different road, so a different line — the point is that it moved with
    // the layout rather than staying where Level 8's paint happened to put it.
    expect(oneWay.x).not.toBe(poseAt(100).x);
  });

  it('holds still while the drive is frozen for reading', () => {
    // Everything carrying its own motion holds through a briefing.
    // This one carries none — its whole position comes from the player's
    // distance — so a frozen frame draws it exactly where it was.
    const before = poseAt(120);
    const again = poseAt(120);
    expect(again).toEqual(before);
  });
});
