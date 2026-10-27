/**
 * Traffic coming up behind, at the speed its scenario says.
 *
 * This path was written for an ambulance, and its fixed screen-space steps are
 * right for one: a siren crosses the frame in about a second and a half, which
 * is what having one behind you feels like. An ordinary sedan borrowed the same
 * constants and could not do its job — "give the overtaking lane back" needs a
 * car the driver can see coming, understand, and be overtaken by, and at seven
 * pixels a frame it was alongside before any of that happened.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import { paceOf } from '@/features/driving-sim/domain/world/DrivingPace';
import { npcTransform, type NpcRoadContext } from './updateNpcVehicles';
import type { NpcVehicleSpec } from '@/features/driving-sim/domain/scenario/scenarioScene';

const level7 = LEVELS.find(level => level.id === 7)!;
const sedan = level7.events.find(event => event.npc?.path === 'closing_from_behind')!;
const ambulanceLevel = LEVELS.find(
  level => level.id !== 7 && level.events.some(event => event.npc?.path === 'closing_from_behind')
)!;
const ambulance = ambulanceLevel.events.find(event => event.npc?.path === 'closing_from_behind')!;

const ROAD_X = 100;

/**
 * Runs the vehicle up the frame the way the world does: carrying its own row
 * from frame to frame, with the player's lane already clear so it is passing.
 */
const rowsWhilePassing = (
  spec: NpcVehicleSpec,
  triggerAtDistance: number,
  level: { speedLimit: number; pace?: object },
  playerSpeed: number,
  frames: number
): number[] => {
  const rows: number[] = [];
  let followerY: number | null = null;
  // The world seeds this from the transform's own first frame; so does this.
  let passing = false;
  const road: NpcRoadContext = {
    oncomingLanes: 0,
    speedLimit: level.speedLimit,
    pace: paceOf(level as never),
    playerSpeed,
    // Out of its way from the start, so it is committed to passing.
    playerLane: 1,
    chaseLane: 0,
  };
  for (let frame = 0; frame < frames; frame++) {
    const at = npcTransform(spec, triggerAtDistance, triggerAtDistance - 300, ROAD_X, 0, false, {
      ...road,
      followerY,
      followerPassing: passing,
    });
    followerY = at.y;
    passing = at.passing ?? passing;
    rows.push(at.y);
  }
  return rows;
};

describe("Level 7's faster traffic", () => {
  it('declares its own speeds rather than borrowing the ambulance constants', () => {
    expect(sedan.npc!.closing).toBeDefined();
    expect(sedan.npc!.vehicleKind).not.toBe('ambulance');
  });

  it('takes seconds to come up and pass, not a fraction of one', () => {
    const rows = rowsWhilePassing(sedan.npc!, sedan.triggerAtDistance, level7, 99, 600);
    const travelled = rows[0] - rows[rows.length - 1];
    const perFrame = travelled / rows.length;
    // A whole canvas is 700 rows. At this rate it takes several seconds to
    // cross one, which is the point: there is time to see it and react.
    expect(perFrame).toBeGreaterThan(0);
    expect(700 / perFrame / 60).toBeGreaterThan(2.5);
  });

  it('never jumps: no frame moves it more than the frame before by much', () => {
    const rows = rowsWhilePassing(sedan.npc!, sedan.triggerAtDistance, level7, 99, 400);
    for (let i = 2; i < rows.length; i++) {
      const step = rows[i - 1] - rows[i];
      const previous = rows[i - 2] - rows[i - 1];
      expect(Math.abs(step - previous)).toBeLessThan(1);
    }
  });

  it('closes faster on a slower driver, because it is a speed and not an animation', () => {
    const slow = rowsWhilePassing(sedan.npc!, sedan.triggerAtDistance, level7, 60, 200);
    const fast = rowsWhilePassing(sedan.npc!, sedan.triggerAtDistance, level7, 99, 200);
    const closed = (rows: number[]) => rows[0] - rows[rows.length - 1];
    expect(closed(slow)).toBeGreaterThan(closed(fast));
  });

  it('holds its motion while the world is frozen', () => {
    // A vehicle that kept coming while a panel was up would arrive having
    // covered the gap in the reader's own time.
    const at = npcTransform(sedan.npc!, sedan.triggerAtDistance, sedan.triggerAtDistance - 300, ROAD_X, 0, false, {
      oncomingLanes: 0,
      speedLimit: level7.speedLimit,
      pace: paceOf(level7),
      playerSpeed: 99,
      playerLane: 1,
      chaseLane: 0,
      followerY: 420,
      followerPassing: true,
      frozen: true,
    });
    expect(at.y).toBe(420);
  });
});

describe('the emergency vehicle this path was written for', () => {
  it('declares no profile, so nothing about it has changed', () => {
    expect(ambulance.npc!.closing).toBeUndefined();
  });

  it('still crosses the frame in about a second and a half', () => {
    const rows = rowsWhilePassing(
      ambulance.npc!,
      ambulance.triggerAtDistance,
      ambulanceLevel,
      50,
      120
    );
    const perFrame = (rows[0] - rows[rows.length - 1]) / rows.length;
    // Seven pixels a frame, the constant it has always used: 700 rows of
    // canvas in about a second and three quarters.
    expect(perFrame).toBeCloseTo(7, 0);
    expect(700 / perFrame / 60).toBeLessThan(2);
  });
});
