/**
 * A car on the acceleration lane is not in Lane 4.
 *
 * Lane 4 is the lane it is about to merge *into*. Saying the driver is already
 * there says the manoeuvre is done — on the one screen whose whole job is to
 * tell them it is not. The cause is `laneOf`, which clamps anything beyond the
 * carriageway to the outermost through lane, and the fix is that nothing about
 * where the car is comes from `laneOf` alone any more.
 */
import { describe, expect, it } from 'vitest';
import type { RoadPosition } from '@/features/driving-sim/domain/world/routeGeometry';
import { roadPositionCue } from './roadPositionLabel';

const onSlipRoad = (crossingOpen: boolean): RoadPosition => ({
  place: 'acceleration-lane',
  lane: null,
  auxiliary: 'acceleration',
  crossingOpen,
});

const inLane = (lane: 0 | 1 | 2 | 3): RoadPosition => ({
  place: 'through-lane',
  lane,
  auxiliary: 'acceleration',
  crossingOpen: true,
});

const merge = { intoLane: 3, minSpeed: 60, speed: 80 };

describe('what the screen calls where the car is', () => {
  it('never calls the acceleration lane a through lane', () => {
    for (const open of [true, false]) {
      const cue = roadPositionCue(onSlipRoad(open), merge);
      expect(cue.place).toBe('ACCELERATION LANE');
      expect(cue.place).not.toMatch(/LANE [1-4]/);
    }
  });

  it('says to wait while the two roads are still divided', () => {
    const cue = roadPositionCue(onSlipRoad(false), merge);
    expect(cue.action).toMatch(/WAIT/);
    expect(cue.tone).toBe('wait');
  });

  it('asks for the merge only once crossing is physically allowed', () => {
    expect(roadPositionCue(onSlipRoad(false), merge).action).not.toMatch(/MERGE INTO/);
    const open = roadPositionCue(onSlipRoad(true), merge);
    expect(open.action).toBe('MERGE INTO LANE 4');
    expect(open.tone).toBe('go');
  });

  it('says Lane 4 only once the car is in the carriageway', () => {
    expect(roadPositionCue(inLane(3), merge).place).toBe('LANE 4');
    expect(roadPositionCue(inLane(1), merge).place).toBe('LANE 2');
  });

  it('confirms the merge once the car is in the lane it was joining', () => {
    const done = roadPositionCue(inLane(3), merge);
    expect(done.action).toBe('MERGED');
    expect(done.tone).toBe('done');
    // And says nothing of the sort about a lane that was not the one asked for.
    expect(roadPositionCue(inLane(1), merge).action).toBeNull();
  });

  it('names the speed floor either way, and says which side of it the car is on', () => {
    // The number every time: telling a driver already doing eighty to "build
    // speed" is the screen inventing a fault.
    expect(roadPositionCue(onSlipRoad(true), { ...merge, speed: 40 }).note).toBe('UNDER 60 km/h');
    expect(roadPositionCue(onSlipRoad(true), { ...merge, speed: 80 }).note).toBe('60 km/h MIN MET');
    // And nothing at all where no merge is being asked for.
    expect(roadPositionCue(onSlipRoad(true)).note).toBeNull();
  });

  it('never relies on colour alone', () => {
    // Every tone carries words. A driver who cannot tell amber from green gets
    // the same instruction as one who can.
    for (const position of [onSlipRoad(false), onSlipRoad(true), inLane(3)]) {
      const cue = roadPositionCue(position, merge);
      expect(cue.action, `${cue.tone} said nothing`).toBeTruthy();
    }
  });

  it('names the deceleration lane and the toll approach as themselves', () => {
    const decel: RoadPosition = {
      place: 'deceleration-lane', lane: null, auxiliary: 'deceleration', crossingOpen: true,
    };
    const toll: RoadPosition = {
      place: 'toll-approach', lane: 2, auxiliary: null, crossingOpen: false,
    };
    expect(roadPositionCue(decel).place).toBe('DECELERATION LANE');
    expect(roadPositionCue(toll).place).toBe('TOLL APPROACH');
  });
});
