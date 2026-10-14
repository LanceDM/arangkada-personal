/**
 * What a briefing says is on the road is on the road while it is read.
 *
 * A scenario answered with the car is frozen once, the moment it becomes
 * active, and its situation is read with the world held still. So a
 * vehicle the situation describes has to be there, where it says, on that
 * frame - at every theta, since theta moves the frame. The first play-test found
 * two in Level 8 that were not.
 *
 * Each scenario is driven alone on a level's own road, from well before it,
 * by a driver who holds a lane and an ordinary speed.
 */
import { describe, expect, it } from 'vitest';
import { DrivingFSM } from '@/features/driving-sim/domain/fsm/DrivingFSM';
import { LEVELS } from '@/features/driving-sim/domain/scenario/levelCatalog';
import type { LevelConfig, ScenarioEvent } from '@/features/driving-sim/domain/scenario/scenarioDefinition';
import { SLOTS as level8Slots } from '@/features/driving-sim/domain/scenario/content/levels/level8';
import type { SceneNode } from '@/features/driving-sim/domain/scene/SceneNode';
import { laneCentreX, laneOf, roadXAt, ROAD_WIDTH, type LaneIndex } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { createDrivingSession, NO_INPUT, type InputState } from './DrivingSession';

const INNER = 2 as LaneIndex;
const CURB = 3 as LaneIndex;
const THETAS = [0.75, 1, 1.5];

/** Where the scenario stands on its one-event road, and where the drive starts. */
const AT = 2400;
const START = 600;

const variant = (id: string) => level8Slots.flat().find(candidate => candidate.id === id)!;
const roadOf = (levelId: number) => LEVELS.find(level => level.id === levelId)!;

/** A level's own road, with this scenario on it and nothing else. */
const alone = (levelId: number, id: string): { level: LevelConfig; event: ScenarioEvent } => {
  const event = { ...variant(id), triggerAtDistance: AT } as ScenarioEvent;
  return { level: { ...roadOf(levelId), events: [event], roadLength: AT + 1500 }, event };
};

interface Briefed {
  /** The car's lane on the frame the scenario was frozen to be read. */
  lane: LaneIndex;
  /** The scenario's own vehicle on that frame, if the scene drew one. */
  vehicle: Extract<SceneNode, { kind: 'scripted-vehicle' }> | undefined;
  roadX: number;
  /** How far ahead the scenario was when it was frozen. */
  ahead: number;
}

/** Drives up to the scenario in `lane` until it is frozen to be read, and reports that frame. */
const atBriefing = (level: LevelConfig, event: ScenarioEvent, lane: LaneIndex, theta: number): Briefed => {
  const realPerformanceNow = performance.now;
  const realDateNow = Date.now;
  const realRandom = Math.random;
  let clock = 1_760_000_000_000;
  performance.now = () => clock;
  Date.now = () => clock;
  Math.random = () => 0.5;
  try {
    const fsm = new DrivingFSM();
    const session = createDrivingSession({ level, fsm, signCoverage: {}, initialDistance: START });
    fsm.setTransitionParams({ approachScale: theta, reactionScale: 1 });
    let previous: InputState = NO_INPUT;
    for (let frame = 0; frame < 4000; frame++) {
      clock = 1_760_000_000_000 + frame * (1000 / 60);
      const snapshot = session.getSnapshot();
      const scene = session.getFrame()?.scene;
      const car = scene?.car;
      const distance = car?.distance ?? START;
      const roadX = roadXAt(distance, scene?.curves ?? []);
      if (snapshot.briefingEvent?.id === event.id) {
        return {
          lane: snapshot.lane as LaneIndex,
          vehicle: scene?.nodes.find(
            (node): node is Extract<SceneNode, { kind: 'scripted-vehicle' }> =>
              node.kind === 'scripted-vehicle' && node.npc === event.npc
          ),
          roadX,
          ahead: event.triggerAtDistance - distance,
        };
      }
      const target = laneCentreX(lane, roadX);
      const x = car?.x ?? target;
      const input: InputState = {
        ...NO_INPUT,
        throttle: snapshot.targetSpeed < 30 && !previous.throttle,
        left: x > target + 4,
        right: x < target - 4,
      };
      previous = input;
      session.update(input);
    }
    throw new Error(`${event.id} was never frozen to be read`);
  } finally {
    performance.now = realPerformanceNow;
    Date.now = realDateNow;
    Math.random = realRandom;
  }
};

describe('level8.let-them-out: "A jeepney is waiting at the mouth of a side street on your right"', () => {
  // Practised on Levels 9-11 as `general_rules`, so driven on one of those
  // roads as well as its own.
  for (const levelId of [8, 10]) {
    it(`is, on Level ${levelId}'s road, at every theta`, () => {
      const { level, event } = alone(levelId, 'level8.let-them-out');
      for (const theta of THETAS) {
        const briefed = atBriefing(level, event, INNER, theta);
        expect(briefed.vehicle?.at.active, `theta ${theta}: on the road`).toBe(true);
        // Nosed out at the mouth on the right, and not still on its way there.
        expect(briefed.vehicle!.at.x, `theta ${theta}: at the mouth`).toBeCloseTo(briefed.roadX + ROAD_WIDTH - 24, 0);
        expect(briefed.vehicle!.at.heading, `theta ${theta}: facing across the road`).toBeCloseTo(-Math.PI / 2);
      }
    }, 60_000);
  }
});

describe('level8.two-seconds: "A loaded truck is in your lane"', () => {
  // Level 8, where the bend before it leaves a driver in the curb lane, and
  // Level 12, which borrows it onto a road the car runs nearest the center
  // line on, as the levels it is practised on do.
  for (const levelId of [8, 12]) {
    for (const lane of [INNER, CURB]) {
      it(`is, on Level ${levelId}'s road, for a driver in lane ${lane}, at every theta`, () => {
        const { level, event } = alone(levelId, 'level8.two-seconds');
        for (const theta of THETAS) {
          const briefed = atBriefing(level, event, lane, theta);
          expect(briefed.lane, `theta ${theta}`).toBe(lane);
          expect(briefed.vehicle?.at.active, `theta ${theta}: on the road`).toBe(true);
          expect(laneOf(briefed.vehicle!.at.x, briefed.roadX), `theta ${theta}: in the car's lane`).toBe(lane);
        }
      }, 60_000);
    }
  }
});
