/**
 * Where the road is, including the bit of it behind the car.
 *
 * The camera shows about 100 units behind the driver, and a drive begins at the
 * route's own zero. Those two facts together mean a route is always being asked
 * about points that fall before its first segment — and answering "there is no
 * route here" made the acceleration lane stop dead at the car's back bumper on
 * the opening frame, which reads as a lane that begins underneath you.
 */
import { describe, expect, it } from 'vitest';
import type { RouteLayout } from '@/features/driving-sim/domain/scenario/scenarioScene';
import { LANE_WIDTH, ROAD_WIDTH } from './vehiclePhysics';
import {
  auxiliaryAt,
  auxiliaryCentreX,
  drivableBounds,
  isOnAuxiliaryLane,
  roadsideAt,
  segmentAt,
  separatorAt,
  widenForAuxiliary,
} from './routeGeometry';

const route: RouteLayout = {
  segments: [
    {
      from: 0,
      to: 2100,
      roadside: 'expressway',
      auxiliary: {
        role: 'acceleration',
        taperIn: 0,
        taperOut: 420,
        separator: { kind: 'island', from: 0, to: 1400 },
      },
    },
    { from: 2100, to: 7600, roadside: 'expressway' },
    { from: 7600, to: 8800, roadside: 'expressway', auxiliary: { role: 'deceleration', taperIn: 420, taperOut: 0 } },
    { from: 8800, to: 11900, roadside: 'toll_approach' },
  ],
};

describe('a route read behind its own start', () => {
  it('reads as the opening segment rather than as no route at all', () => {
    expect(segmentAt(-120, route)?.from).toBe(0);
    expect(roadsideAt(-120, route)).toBe('expressway');
  });

  it('carries the opening segment’s auxiliary lane back with it, at full width', () => {
    expect(auxiliaryAt(-120, route)).toEqual({ role: 'acceleration', width: LANE_WIDTH });
  });

  it('still ends where the route ends', () => {
    expect(segmentAt(12_000, route)).toBeNull();
    expect(auxiliaryAt(12_000, route)).toBeNull();
    expect(roadsideAt(12_000, route)).toBe('mixed');
  });
});

describe('an auxiliary lane across its taper', () => {
  it('is a full lane until the taper starts and nothing by the time it ends', () => {
    expect(auxiliaryAt(1000, route)?.width).toBe(LANE_WIDTH);
    expect(auxiliaryAt(1680, route)?.width).toBeCloseTo(LANE_WIDTH, 5);
    expect(auxiliaryAt(1890, route)?.width).toBeCloseTo(LANE_WIDTH / 2, 5);
    expect(auxiliaryAt(2100, route)).toBeNull();
  });

  it('opens the other way round where the lane is a deceleration lane', () => {
    expect(auxiliaryAt(7600, route)).toBeNull();
    expect(auxiliaryAt(7810, route)?.width).toBeCloseTo(LANE_WIDTH / 2, 5);
    expect(auxiliaryAt(8500, route)?.width).toBe(LANE_WIDTH);
  });

  it('widens the drivable bounds by exactly what it is worth here', () => {
    const bounds = { min: 100, max: 360 };
    expect(widenForAuxiliary(bounds, auxiliaryAt(1890, route))).toEqual({
      min: 100,
      max: 360 + LANE_WIDTH / 2,
    });
    expect(widenForAuxiliary(bounds, auxiliaryAt(3000, route))).toEqual(bounds);
  });
});

describe('telling the auxiliary lane apart from the outermost through lane', () => {
  it('reads a car beyond the carriageway as being on it, and one inside as not', () => {
    const roadX = 100;
    expect(isOnAuxiliaryLane(roadX + ROAD_WIDTH + 20, roadX)).toBe(true);
    expect(isOnAuxiliaryLane(roadX + ROAD_WIDTH - 20, roadX)).toBe(false);
  });

  it('centres a vehicle travelling it in the middle of what is there', () => {
    const aux = auxiliaryAt(1890, route)!;
    expect(auxiliaryCentreX(100, aux)).toBe(100 + ROAD_WIDTH + LANE_WIDTH / 4);
  });
});

describe('a slip road divided from the carriageway beside it', () => {
  const roadX = 100;
  const HALF_CAR = 20;
  const lanes = { min: roadX + HALF_CAR, max: roadX + ROAD_WIDTH - HALF_CAR };
  const at = (distance: number, x: number) =>
    drivableBounds(lanes, x, distance, route, roadX, HALF_CAR);

  it('is two roads before the opening and one after it', () => {
    expect(separatorAt(600, route)).not.toBeNull();
    expect(separatorAt(1500, route)).toBeNull();
  });

  it('will not let a driver on the slip road steer onto the expressway', () => {
    // The whole defect this replaced: the two were one min/max interval, so a
    // car could cross from the first frame of the drive and "merge before the
    // lane ends" was measuring a move nobody had to make.
    const onSlip = at(600, roadX + ROAD_WIDTH + 30);
    expect(onSlip.min).toBeGreaterThan(roadX + ROAD_WIDTH);
  });

  it('will not let a driver on the expressway steer onto the slip road either', () => {
    const onRoad = at(600, roadX + 120);
    expect(onRoad.max).toBeLessThan(roadX + ROAD_WIDTH);
  });

  it('opens at the opening, so the merge can be made', () => {
    const merging = at(1600, roadX + ROAD_WIDTH + 30);
    expect(merging.min).toBe(lanes.min);
    expect(merging.max).toBeGreaterThan(roadX + ROAD_WIDTH);
  });

  it('holds the corridor until the whole car is past the nose', () => {
    // A car is a length of road. Asked only about its own centre it could start
    // across with its tail still alongside the nose, which the collision pass
    // reads as driving into it.
    const justPast = at(1420, roadX + ROAD_WIDTH + 30);
    expect(justPast.min).toBeGreaterThan(roadX + ROAD_WIDTH);
  });

  it('never puts the nose inside the through lanes', () => {
    for (let distance = 0; distance < 1400; distance += 100) {
      const nose = separatorAt(distance, route)!;
      expect(nose.x - nose.width / 2).toBeGreaterThanOrEqual(ROAD_WIDTH - nose.width);
    }
  });

  it('does not divide a lane that is not there', () => {
    // Past the taper there is no auxiliary lane, so a nose beside it would be a
    // nose in the verge.
    expect(auxiliaryAt(2200, route)).toBeNull();
    expect(separatorAt(2200, route)).toBeNull();
  });
});
