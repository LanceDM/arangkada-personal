import { describe, it, expect } from 'vitest';
import { computeWarningDistances, actionZoneFor, uiReactionPhase, approachFraction, computeApproachRooms, computeApproachFloors, cutsceneFreezeLead, stoppingDistanceFrom, PERCEPTION_REACTION_SECONDS, } from './eventScheduler';
import { ACTION_ZONE_ENTER, ACTION_ZONE_EXIT, CHECKPOINT_ZONE_ENTER, CHECKPOINT_ZONE_EXIT, REACTION_ZONE_ENTER, WARNING_START_RUNWAY, WARNING_ZONE_MARGIN, } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { DEFAULT_PACE, unitsForSeconds } from '@/features/driving-sim/domain/world/DrivingPace';
import { TUTORIAL_ACTION_ZONE_ENTER, TUTORIAL_ACTION_ZONE_EXIT } from './tutorial';
import { noStandingStretch } from '@/features/driving-sim/domain/evaluation/eventTelemetry';
import type { ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';

const ev = (triggerAtDistance: number, warningDistance?: number): ScenarioEvent => ({
  id: `e${triggerAtDistance}`,
  triggerAtDistance,
  type: 'scenario_trigger',
  description: '',
  correctAction: 'brake',
  points: 10,
  penaltyMessage: '',
  rewardMessage: '',
  duration: 100,
  ...(warningDistance !== undefined ? { warningDistance } : {}),
});

describe('computeWarningDistances', () => {
  it('clamps a warning to the room before the event, never below the floor', () => {
    // Two events far apart: the authored warning fits and is used as-is.
    const map = computeWarningDistances([ev(4000, 300), ev(1000, 200)]);
    expect(map.get(1000)).toBe(200);
    expect(map.get(4000)).toBe(300);
  });

  it('never returns less than ACTION_ZONE_ENTER even when events are tight', () => {
    // Second event crowds the first: room is small, so the warning floors out.
    const map = computeWarningDistances([ev(1000, 900), ev(1000 + ACTION_ZONE_ENTER / 2, 900)]);
    for (const value of map.values()) expect(value).toBeGreaterThanOrEqual(ACTION_ZONE_ENTER);
  });

  it('is keyed by triggerAtDistance regardless of input order', () => {
    const map = computeWarningDistances([ev(3000), ev(500), ev(1500)]);
    expect([...map.keys()].sort((a, b) => a - b)).toEqual([500, 1500, 3000]);
  });
});

describe('actionZoneFor', () => {
  const base = { isCheckpoint: false, isParking: false, isTutorial: false, warningDistance: 88 };

  it('uses the checkpoint runway for checkpoints and parking', () => {
    expect(actionZoneFor({ ...base, isCheckpoint: true })).toEqual({ enter: CHECKPOINT_ZONE_ENTER, exit: CHECKPOINT_ZONE_EXIT });
    expect(actionZoneFor({ ...base, isParking: true })).toEqual({ enter: CHECKPOINT_ZONE_ENTER, exit: CHECKPOINT_ZONE_EXIT });
  });

  it('uses the tutorial zones on the tutorial level', () => {
    expect(actionZoneFor({ ...base, isTutorial: true })).toEqual({ enter: TUTORIAL_ACTION_ZONE_ENTER, exit: TUTORIAL_ACTION_ZONE_EXIT });
  });

  it('uses the clamped warning distance for an ordinary event, falling back to the default', () => {
    expect(actionZoneFor(base)).toEqual({ enter: 88, exit: ACTION_ZONE_EXIT });
    expect(actionZoneFor({ ...base, warningDistance: undefined })).toEqual({ enter: ACTION_ZONE_ENTER, exit: ACTION_ZONE_EXIT });
  });

  it('prioritises the checkpoint runway over the tutorial zones', () => {
    expect(actionZoneFor({ ...base, isCheckpoint: true, isTutorial: true }).enter).toBe(CHECKPOINT_ZONE_ENTER);
  });

  it('stays open past the point until the car is clear of where it may not stand', () => {
    expect(actionZoneFor({ ...base, noStanding: { from: -120, to: 256 } })).toEqual({ enter: 88, exit: 256 });
    expect(actionZoneFor({ ...base, noStanding: null })).toEqual({ enter: 88, exit: ACTION_ZONE_EXIT });
  });

  it('measures the room after a place a car may not stand from where that stretch ends', () => {
    // The hydrant's four meters reach past it, so the next approach may open
    // only once the car is clear of them, not 20 units past the hydrant.
    const hydrant: ScenarioEvent = { ...ev(1000, 340), avoid: ['stop'], noStandingWithin: 4 };
    const exit = actionZoneFor({ ...base, noStanding: noStandingStretch(hydrant) }).exit;
    expect(exit).toBeGreaterThan(ACTION_ZONE_EXIT);
    const rooms = computeApproachRooms([hydrant, ev(1800, 340)], false);
    expect(rooms.get(1800)).toBeCloseTo(1800 - (1000 + exit) - WARNING_ZONE_MARGIN);
  });
});

describe('uiReactionPhase', () => {
  it('is the UI band at REACTION_ZONE_ENTER, distinct from the FSM reaction guard', () => {
    expect(uiReactionPhase(-(REACTION_ZONE_ENTER + 1))).toBe('approach');
    expect(uiReactionPhase(-REACTION_ZONE_ENTER)).toBe('react');
    expect(uiReactionPhase(0)).toBe('react');
  });
});

describe('approachFraction', () => {
  it('runs 1 at the announcement edge down to 0 at the trigger, clamped', () => {
    expect(approachFraction(-100, 100)).toBe(1);
    expect(approachFraction(-50, 100)).toBe(0.5);
    expect(approachFraction(0, 100)).toBe(0);
    expect(approachFraction(20, 100)).toBe(0); // past the trigger stays clamped at 0
  });
});

describe('computeApproachRooms', () => {
  it('reaches back to the start runway for the first event, less the margin', () => {
    expect(computeApproachRooms([ev(1000)], false).get(1000)).toBe(1000 - WARNING_START_RUNWAY - WARNING_ZONE_MARGIN);
  });

  it("reaches back to where the previous event's own zone closes, less the margin", () => {
    const after = (previous: ScenarioEvent, isTutorial = false) =>
      computeApproachRooms([previous, ev(2000)], isTutorial).get(2000);
    expect(after(ev(1000))).toBe(2000 - (1000 + ACTION_ZONE_EXIT) - WARNING_ZONE_MARGIN);
    // A checkpoint's zone stays open past its line for longer than a road
    // event's, and the room is measured from where it actually closes.
    const checkpoint = { ...ev(1000), inspection: { title: '', items: [] } } as unknown as ScenarioEvent;
    expect(after(checkpoint)).toBe(2000 - (1000 + CHECKPOINT_ZONE_EXIT) - WARNING_ZONE_MARGIN);
    expect(after(ev(1000), true)).toBe(2000 - (1000 + TUTORIAL_ACTION_ZONE_EXIT) - WARNING_ZONE_MARGIN);
  });
});

describe('computeApproachFloors', () => {
  const STOP = 150;
  const floorOf = (event: ScenarioEvent, isTutorial = false) =>
    computeApproachFloors([event], isTutorial, STOP).get(event.triggerAtDistance);

  it("gives a road event a stop's worth", () => {
    expect(floorOf(ev(1000))).toBe(STOP);
  });

  it("keeps a cutscene's freeze point ahead as well as a stop", () => {
    const roundabout = { ...ev(1000), cutscene: true, scene: 'roundabout' } as ScenarioEvent;
    expect(floorOf(roundabout)).toBe(Math.max(STOP, cutsceneFreezeLead(roundabout)));
    expect(cutsceneFreezeLead(roundabout)).toBeGreaterThan(cutsceneFreezeLead(ev(1000)));
  });

  it('will not let theta narrow a zone that is itself the runway, the lesson or the verdict', () => {
    const fixed: ScenarioEvent[] = [
      { ...ev(1000), inspection: { title: '', items: [] } } as unknown as ScenarioEvent,
      { ...ev(1000), parkingCutscene: true, bay: { side: 'right' } } as unknown as ScenarioEvent,
      { ...ev(1000), overtake: {} } as unknown as ScenarioEvent,
      { ...ev(1000), merge: {} } as unknown as ScenarioEvent,
      { ...ev(1000), lineHold: {} } as unknown as ScenarioEvent,
    ];
    for (const event of fixed) expect(floorOf(event)).toBe(Number.POSITIVE_INFINITY);
    expect(floorOf(ev(1000), true)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('stoppingDistanceFrom', () => {
  it('is a perception-reaction second at speed, then the brake', () => {
    const braking = stoppingDistanceFrom(60, DEFAULT_PACE) - unitsForSeconds(PERCEPTION_REACTION_SECONDS, 60, DEFAULT_PACE);
    // 60 km/h shed at 1.2 a frame, each frame's speed covered at 0.05 a km/h.
    let expected = 0;
    for (let speed = 60 - 1.2; speed > 0; speed -= 1.2) expected += speed * 0.05;
    expect(braking).toBeCloseTo(expected, 6);
  });

  it('grows with speed, and with a softer brake', () => {
    expect(stoppingDistanceFrom(80, DEFAULT_PACE)).toBeGreaterThan(stoppingDistanceFrom(40, DEFAULT_PACE));
    expect(stoppingDistanceFrom(60, { ...DEFAULT_PACE, brakingScale: 0.7 }))
      .toBeGreaterThan(stoppingDistanceFrom(60, DEFAULT_PACE));
  });

  it('is nothing for a car already at rest', () => {
    expect(stoppingDistanceFrom(0, DEFAULT_PACE)).toBe(0);
  });
});
