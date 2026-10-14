/**
 * The traffic that drives itself.
 *
 * What matters here is the one property a scripted path could never have: a
 * driver who eases off genuinely gets more room. Every other NPC in the game is
 * a function of the player's own distance, so the gap it leaves is a fact about
 * where you are rather than about how fast you got there — and a following
 * distance you cannot open by slowing down is not a following distance.
 */
import { describe, expect, it } from 'vitest';
import { advanceRoadTraffic, headwaySeconds, joiningLane, leadLane, type RoadTraffic } from './roadTraffic';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const level = { id: 7, speedLimit: 100 } as LevelConfig;

const leadEvent = (npc: Partial<NonNullable<ScenarioEvent['npc']>> = {}): ScenarioEvent =>
  ({
    id: 'test.lead',
    triggerAtDistance: 3000,
    type: 'obstacle_ahead',
    description: '',
    correctAction: 'brake',
    points: 10,
    penaltyMessage: '',
    rewardMessage: '',
    duration: 0,
    npc: {
      path: 'travelling_ahead',
      vehicleKind: 'van',
      label: 'the van ahead',
      approachSpan: 1000,
      entryHeadway: 2,
      speed: { cruise: 0.6 },
      ...npc,
    },
  }) as ScenarioEvent;

/** Runs the player forward at a fixed speed, advancing the traffic each frame. */
const drive = (
  event: ScenarioEvent,
  { from, frames, playerKph }: { from: number; frames: number; playerKph: number }
) => {
  const traffic: RoadTraffic = new Map();
  let distance = from;
  for (let frame = 0; frame < frames; frame++) {
    advanceRoadTraffic(traffic, level, [event], distance);
    distance += playerKph * 0.05;
  }
  return { traffic, distance, lead: traffic.get(event.id) };
};

describe('a vehicle travelling ahead', () => {
  it('joins in the lane the car is in where its scenario names none, and keeps it', () => {
    const event = leadEvent();
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [event], 2100, 2);
    expect(traffic.get(event.id)?.lane).toBe(2);
    // The car changing lanes afterwards does not drag the vehicle with it.
    advanceRoadTraffic(traffic, level, [event], 2105, 3);
    expect(traffic.get(event.id)?.lane).toBe(2);

    // A scenario that names the lane keeps to it, wherever the car is.
    const named = leadEvent({ lane: 'curb' });
    const elsewhere: RoadTraffic = new Map();
    advanceRoadTraffic(elsewhere, level, [named], 2100, 2);
    expect(elsewhere.get(named.id)?.lane).toBeUndefined();
  });

  it('waits to join your lane until no other scenario is being answered', () => {
    // Level 12's traffic stop is what puts the car in the curb lane. A vehicle
    // that joined while it was still being answered joined the lane the car
    // was about to leave.
    const event = leadEvent();
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [event], 2100, 2, 'level12.ticket-issued.top-in-hand');
    expect(traffic.has(event.id)).toBe(false);
    advanceRoadTraffic(traffic, level, [event], 2200, 3, null);
    expect(traffic.get(event.id)?.lane).toBe(3);

    // Its own scenario opening first does not hold it back.
    const own: RoadTraffic = new Map();
    advanceRoadTraffic(own, level, [event], 2100, 2, event.id);
    expect(own.get(event.id)?.lane).toBe(2);

    // Nor does anything hold back a vehicle whose lane is named.
    const named = leadEvent({ lane: 'curb' });
    const elsewhere: RoadTraffic = new Map();
    advanceRoadTraffic(elsewhere, level, [named], 2100, 2, 'some.other.scenario');
    expect(elsewhere.has(named.id)).toBe(true);
  });

  it('joins on the car\'s own side of the road, however far over the center line the car is', () => {
    const twoWay = { ...level, paint: { oncomingLanes: 2 } } as LevelConfig;
    for (const playerLane of [0, 1] as const) {
      const traffic: RoadTraffic = new Map();
      advanceRoadTraffic(traffic, twoWay, [leadEvent()], 2100, playerLane);
      expect(traffic.get('test.lead')?.lane, `car in lane ${playerLane}`).toBe(2);
    }
    expect(joiningLane(3, 2)).toBe(3);
    // A one-way road has no oncoming side to keep it off.
    expect(joiningLane(0, 0)).toBe(0);
  });

  it('is in one lane for the scene and the grade: named, else joined, else the car\'s', () => {
    const { npc } = leadEvent();
    const { npc: curb } = leadEvent({ lane: 'curb' });
    const vehicle = { distance: 0, speed: 0, braking: false, lane: 2 as const };
    expect(leadLane(curb!, vehicle, 2, 2)).toBe(3);
    expect(leadLane(npc!, vehicle, 2, 3)).toBe(2);
    expect(leadLane(npc!, undefined, 2, 3)).toBe(3);
    expect(leadLane(npc!, null, 2)).toBe(3);
  });

  it('does not exist until its event is within range', () => {
    const event = leadEvent();
    const { lead } = drive(event, { from: 1500, frames: 1, playerKph: 100 });
    expect(lead).toBeUndefined();
  });

  it('joins the road at the gap its scenario declared, in seconds of road', () => {
    const event = leadEvent();
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [event], 2100);
    // Two seconds at 100 km/h: the car covers 5 units a frame, 300 a second.
    expect(traffic.get(event.id)?.distance).toBe(2100 + 600);
  });

  it('joins at the same number of seconds on a slower road', () => {
    // What makes a following-distance scenario practisable somewhere other than
    // the level it was written for: the gap is a time, so the same declaration
    // is the same task at 100 and at 50, rather than a comfortable gap on one
    // road and most of a stopping distance on another.
    const event = leadEvent({ entryHeadway: 3 });
    const gapOn = (speedLimit: number) => {
      const traffic: RoadTraffic = new Map();
      advanceRoadTraffic(traffic, { ...level, speedLimit } as LevelConfig, [event], 2100);
      const lead = traffic.get(event.id)!;
      return headwaySeconds(2100, speedLimit, lead);
    };
    expect(gapOn(100)).toBeCloseTo(3, 5);
    expect(gapOn(50)).toBeCloseTo(3, 5);
  });

  it('never joins behind the player, however late they arrive', () => {
    const event = leadEvent();
    const traffic: RoadTraffic = new Map();
    // Past the trigger already: there is nothing left to introduce.
    advanceRoadTraffic(traffic, level, [event], 3200);
    expect(traffic.size).toBe(0);
  });

  it('travels at the share of the limit it declared', () => {
    const event = leadEvent({ speed: { cruise: 0.6 } });
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [event], 2100);
    const before = traffic.get(event.id)!.distance;
    advanceRoadTraffic(traffic, level, [event], 2105);
    // 60 km/h is 3 road units a frame, the same arithmetic the player's car uses.
    expect(traffic.get(event.id)!.distance - before).toBeCloseTo(3, 5);
  });

  it('opens the gap for a driver who eases off, and closes it for one who does not', () => {
    const fast = drive(leadEvent(), { from: 2100, frames: 200, playerKph: 100 });
    const slow = drive(leadEvent(), { from: 2100, frames: 200, playerKph: 50 });

    const fastGap = fast.lead!.distance - fast.distance;
    const slowGap = slow.lead!.distance - slow.distance;

    expect(fastGap).toBeLessThan(600);
    expect(slowGap).toBeGreaterThan(600);
  });

  it('slows on the run-in, shows it, and picks its speed back up afterwards', () => {
    const event = leadEvent({ speed: { cruise: 0.6, slowsTo: 0.3, slowsFrom: 400 } });
    const traffic: RoadTraffic = new Map();
    // Driven rather than teleported, because the vehicle's own progress is what
    // is being measured: a player who jumps forward leaves it behind and it is
    // retired, which is a different (and correct) behaviour.
    const seen: Array<{ at: number; braking: boolean; speed: number }> = [];
    for (let distance = 2100; distance < 3200; distance += 50 * 0.05) {
      advanceRoadTraffic(traffic, level, [event], distance);
      const lead = traffic.get(event.id);
      if (lead) seen.push({ at: distance, braking: lead.braking, speed: lead.speed });
    }

    const at = (distance: number) => seen.find(row => row.at >= distance)!;

    // Well before the slow-down band: cruising, nothing to show.
    expect(at(2200).braking).toBe(false);
    expect(at(2200).speed).toBeCloseTo(60, 1);

    // Inside it: shedding speed, and saying so, before the gap has closed.
    expect(at(2650).braking).toBe(true);

    // Past the event: picking its speed back up rather than crawling the rest
    // of the level in front of a driver who has already been graded on it.
    const last = seen[seen.length - 1];
    expect(last.braking).toBe(false);
    expect(last.speed).toBeGreaterThan(level.speedLimit * 0.3);
    expect(last.speed).toBeLessThanOrEqual(level.speedLimit * 0.6);
  });

  it('is retired only once it is off the bottom of the frame', () => {
    const event = leadEvent({ speed: { cruise: 0.1 } });
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [event], 2100);

    // 300 units behind is the bottom edge of the corridor; still on the books.
    advanceRoadTraffic(traffic, level, [event], 2700 + 300);
    expect(traffic.has(event.id)).toBe(true);

    advanceRoadTraffic(traffic, level, [event], 2700 + 400);
    expect(traffic.has(event.id)).toBe(false);
  });

  it('leaves every other kind of scripted vehicle alone', () => {
    const crossing = { ...leadEvent(), npc: { path: 'crossing_from_left', vehicleKind: 'car', label: 'x' } } as ScenarioEvent;
    const traffic: RoadTraffic = new Map();
    advanceRoadTraffic(traffic, level, [crossing], 2100);
    expect(traffic.size).toBe(0);
  });
});

describe('headway', () => {
  const lead = (distance: number) => ({ distance, speed: 60, braking: false });

  it('is the time it would take to reach where the vehicle ahead is now', () => {
    // 300 units ahead at 100 km/h: the car covers 5 units a frame, 300 a second.
    expect(headwaySeconds(0, 100, lead(300))).toBeCloseTo(1, 5);
    expect(headwaySeconds(0, 50, lead(300))).toBeCloseTo(2, 5);
  });

  it('is unbounded when there is nothing ahead, or the car is not moving', () => {
    expect(headwaySeconds(0, 100, undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(headwaySeconds(0, 0, lead(300))).toBe(Number.POSITIVE_INFINITY);
  });

  it('is zero once the vehicle is behind you', () => {
    expect(headwaySeconds(400, 100, lead(300))).toBe(0);
  });
});
