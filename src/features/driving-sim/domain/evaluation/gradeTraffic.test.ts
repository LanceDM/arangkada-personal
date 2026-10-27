/**
 * Grading a driver against the traffic around them.
 *
 * Two requirements are measured over a whole window rather than read off one
 * instant: the time gap kept to the vehicle ahead, and whether an overtake was
 * actually completed. Both exist because the thing they replaced was a single
 * sample — a speed at a sign, a lane at a trigger point — which could be
 * satisfied without the manoeuvre the feedback then claimed.
 *
 * So the assertions below are as much about what must *fail* as what must pass.
 * A pass that was never finished, or a gap that was closed and then reopened,
 * must not come out as success, because the reward text describes a sequence.
 */
import { describe, expect, it } from 'vitest';
import {
  acceptableLanes,
  createTelemetry,
  gradeEvent,
  isSatisfiedEarly,
  recordTraffic,
  type EventTelemetry,
} from './eventTelemetry';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import type { LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';

/** A four-lane one-way expressway: lane 0 is Lane 1, the overtaking lane. */
const level = {
  id: 7,
  speedLimit: 100,
  paint: { oncomingLanes: 0, base: 'edge_line', spans: [] },
} as unknown as LevelConfig;

const baseEvent = (extra: Partial<ScenarioEvent>): ScenarioEvent =>
  ({
    id: 'test.event',
    triggerAtDistance: 1000,
    type: 'scenario_trigger',
    description: '',
    correctAction: 'accelerate',
    points: 25,
    penaltyMessage: 'generic penalty',
    rewardMessage: 'generic reward',
    duration: 0,
    ...extra,
  }) as ScenarioEvent;

const followingEvent = baseEvent({
  type: 'obstacle_ahead',
  correctAction: 'brake',
  following: { seconds: 2, tooCloseMessage: 'you were inside two seconds' },
});

const overtakeEvent = baseEvent({
  type: 'overtaking_zone',
  overtake: {
    passingLane: 'inner',
    // Larger than the two bodies put together, as every scenario's must be.
    clearBy: 170,
    neverPassedMessage: 'you never completed the pass',
    wrongLaneMessage: 'you drew level outside Lane 1',
    neverReturnedMessage: 'you stayed in Lane 1',
    cutInMessage: 'you came back across too soon',
  },
});

/** Replays a run of frames through the traffic recorder. */
const record = (
  event: ScenarioEvent,
  frames: Array<{
    lane: LaneIndex;
    speed?: number;
    headway?: number;
    gapToLead?: number | null;
    /** Ahead in the car's lane; by default, whenever it is ahead at all. */
    followed?: boolean;
    onAuxiliary?: boolean;
    auxiliaryShare?: number;
  }>
): EventTelemetry => {
  const telemetry = createTelemetry(100, frames[0].lane);
  for (const frame of frames) {
    recordTraffic(telemetry, event, level, {
      lane: frame.lane,
      speed: frame.speed ?? 100,
      headway: frame.headway ?? Number.POSITIVE_INFINITY,
      gapToLead: frame.gapToLead ?? null,
      followed: frame.followed ?? (frame.gapToLead != null && frame.gapToLead < 0),
      onAuxiliary: frame.onAuxiliary ?? false,
      auxiliaryShare: frame.auxiliaryShare ?? 0,
    });
  }
  return telemetry;
};

/** A whole pass, frame by frame: behind, alongside, clear, and back. */
const passFrames = (lanes: { behind: LaneIndex; alongside: LaneIndex; ahead: LaneIndex }) => [
  { lane: lanes.behind, gapToLead: -400 },
  { lane: lanes.behind, gapToLead: -200 },
  { lane: lanes.alongside, gapToLead: -40 },
  { lane: lanes.alongside, gapToLead: 40 },
  { lane: lanes.ahead, gapToLead: 200 },
  { lane: lanes.ahead, gapToLead: 320 },
];

describe('a following gap', () => {
  it('fails when the closest gap fell inside the requirement', () => {
    const telemetry = record(followingEvent, [
      { lane: 1, headway: 3.1, gapToLead: -900 },
      { lane: 1, headway: 1.4, gapToLead: -400 },
      { lane: 1, headway: 2.6, gapToLead: -700 },
    ]);
    const grade = gradeEvent(telemetry, followingEvent, level);
    expect(grade.action).toBe('too_close');
    expect(grade.penaltyMessage).toBe('you were inside two seconds');
  });

  it('passes when the gap was held, and quotes the gap it actually measured', () => {
    const telemetry = record(followingEvent, [
      { lane: 1, headway: 3.4, gapToLead: -1000 },
      { lane: 1, headway: 2.4, gapToLead: -700 },
      { lane: 1, headway: 2.9, gapToLead: -850 },
    ]);
    const grade = gradeEvent(telemetry, followingEvent, level);
    expect(grade.action).toBe('brake');
    expect(grade.rewardMessage).toContain('2.4 seconds');
    expect(grade.rewardMessage).toContain('2-second');
  });

  it('cannot be failed by a window in which nothing was ever ahead', () => {
    // No vehicle on the road: there was no gap to keep, so the event falls
    // through to the ordinary grade rather than being scored against a
    // measurement that never happened.
    const telemetry = record(followingEvent, [{ lane: 1 }, { lane: 1 }]);
    expect(telemetry.headwayFrames).toBe(0);
    expect(gradeEvent(telemetry, followingEvent, level).action).not.toBe('too_close');
  });

  it('counts only the frames the vehicle is ahead in the car\'s lane', () => {
    // Followed at three seconds, then passed in the next lane: the road
    // distance to it falls to nothing as the car draws level, which is no gap
    // the car was keeping.
    const telemetry = record(followingEvent, [
      { lane: 1, headway: 3.2, gapToLead: -900 },
      { lane: 1, headway: 3, gapToLead: -850 },
      { lane: 2, headway: 0.8, gapToLead: -200, followed: false },
      { lane: 2, headway: 0, gapToLead: 30, followed: false },
    ]);
    const grade = gradeEvent(telemetry, followingEvent, level);
    expect(grade.action).toBe('brake');
    expect(grade.rewardMessage).toContain('3 seconds');
  });

  it('still fails a gap lost while following, whatever lane the car moved to after', () => {
    const telemetry = record(followingEvent, [
      { lane: 1, headway: 1.4, gapToLead: -400 },
      { lane: 2, headway: 0, gapToLead: 50, followed: false },
    ]);
    expect(gradeEvent(telemetry, followingEvent, level).action).toBe('too_close');
  });

  it('passes a car that was never behind it in its lane, and says so', () => {
    const telemetry = record(followingEvent, [
      { lane: 2, headway: 1.1, gapToLead: -300, followed: false },
      { lane: 2, headway: 0.2, gapToLead: -60, followed: false },
      { lane: 2, headway: 0, gapToLead: 80, followed: false },
    ]);
    expect(telemetry.leadFrames).toBe(3);
    expect(telemetry.followedFrames).toBe(0);
    const grade = gradeEvent(telemetry, followingEvent, level);
    expect(grade.action).toBe('brake');
    expect(grade.rewardMessage).toContain('never behind it in its lane');
  });

  it('reads a car stopped behind it, in its lane, as following it', () => {
    // Stopped, the gap is unlimited and nothing is measured; but the car was
    // behind it the whole time, so this is not the never-followed pass.
    const telemetry = record(followingEvent, [
      { lane: 1, speed: 0, gapToLead: -300 },
      { lane: 1, speed: 0, gapToLead: -280 },
    ]);
    expect(telemetry.followedFrames).toBe(2);
    expect(gradeEvent(telemetry, followingEvent, level).rewardMessage).toBeUndefined();
  });

  it('leaves the gap a merge joins into as it was: measured whatever the lane', () => {
    // The merge's gap is to the traffic on the carriageway, which is never in
    // the auxiliary lane the car is leaving.
    const merging = baseEvent({});
    const telemetry = record(merging, [{ lane: 3, headway: 1.2, gapToLead: -200, followed: false }]);
    expect(telemetry.headwayFrames).toBe(1);
    expect(telemetry.minHeadway).toBe(1.2);
  });

  it('never settles early, however wide the gap is right now', () => {
    const telemetry = record(followingEvent, [{ lane: 1, headway: 9, gapToLead: -2000 }]);
    expect(isSatisfiedEarly(telemetry, followingEvent, level, 1, 20, true)).toBe(false);
  });
});

describe('an overtake', () => {
  it('passes only when every phase was seen: out, level, clear, and back', () => {
    const telemetry = record(overtakeEvent, passFrames({ behind: 1, alongside: 0, ahead: 1 }));
    const progress = telemetry.overtake;
    expect(progress).toMatchObject({
      pulledOut: true,
      passedInLane: true,
      passedElsewhere: false,
      cleared: true,
      returned: true,
      cutIn: false,
    });

    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('accelerate');
    expect(grade.rewardMessage).toContain('Lane 1');
  });

  it('fails a driver who never left their lane', () => {
    const telemetry = record(overtakeEvent, [
      { lane: 1, gapToLead: -400 },
      { lane: 1, gapToLead: -200 },
    ]);
    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('no_overtake');
    expect(grade.penaltyMessage).toBe('you never completed the pass');
  });

  it('fails a driver who drew level from the wrong side', () => {
    const telemetry = record(overtakeEvent, passFrames({ behind: 1, alongside: 3, ahead: 1 }));
    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('undertake');
    expect(grade.penaltyMessage).toBe('you drew level outside Lane 1');
  });

  it('fails a driver who pulled out and then gave up short of the vehicle', () => {
    const telemetry = record(overtakeEvent, [
      { lane: 1, gapToLead: -400 },
      { lane: 0, gapToLead: -320 },
      { lane: 0, gapToLead: -280 },
    ]);
    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('incomplete_overtake');
  });

  it('fails a driver who cut back in before they were clear', () => {
    const telemetry = record(overtakeEvent, [
      { lane: 1, gapToLead: -400 },
      { lane: 0, gapToLead: -200 },
      { lane: 0, gapToLead: -20 },
      { lane: 1, gapToLead: 60 },
    ]);
    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('cut_in');
    expect(grade.penaltyMessage).toBe('you came back across too soon');
  });

  it('fails a driver who passed and then kept the overtaking lane', () => {
    const telemetry = record(overtakeEvent, [
      { lane: 1, gapToLead: -400 },
      { lane: 0, gapToLead: -20 },
      { lane: 0, gapToLead: 200 },
      { lane: 0, gapToLead: 400 },
    ]);
    const grade = gradeEvent(telemetry, overtakeEvent, level);
    expect(grade.action).toBe('held_passing_lane');
    expect(grade.penaltyMessage).toBe('you stayed in Lane 1');
  });

  it('never settles early, even mid-pass in exactly the right lane', () => {
    const telemetry = record(overtakeEvent, [{ lane: 0, gapToLead: -60 }]);
    expect(isSatisfiedEarly(telemetry, overtakeEvent, level, 0, 100, true)).toBe(false);
  });

  it('records nothing at all while the vehicle being passed is not on the road', () => {
    const telemetry = record(overtakeEvent, [{ lane: 0 }, { lane: 1 }]);
    expect(telemetry.overtake.pulledOut).toBe(false);
  });
});

describe('a strict lane requirement', () => {
  it('accepts every lane outside the one it names, so the cue and the grade agree', () => {
    const event = baseEvent({
      requiredLane: {
        lane: 'middle',
        strict: true,
        hint: 'keep out of Lane 1',
        wrongLaneMessage: 'you were in Lane 1',
      },
    });
    // Lane 1 (index 0) is the median lane; everything from Lane 2 outwards is a
    // travelling lane and satisfies "keep out of the overtaking lane".
    expect(acceptableLanes(event, level)).toEqual([1, 2, 3]);

    const clean = createTelemetry(100, 3);
    expect(gradeEvent(clean, event, level).action).toBe('accelerate');

    const strayed = createTelemetry(100, 0);
    expect(gradeEvent(strayed, event, level).action).toBe('wrong_lane');
  });

  it('still names exactly one lane when it is not strict', () => {
    const event = baseEvent({
      requiredLane: { lane: 'curb', hint: 'take the exit lane', wrongLaneMessage: 'wrong lane' },
    });
    expect(acceptableLanes(event, level)).toEqual([3]);
  });
});
